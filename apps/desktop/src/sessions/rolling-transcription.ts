import type {
  LocalSidecarStreamingSession,
  LocalSidecarTranscribeOutput,
} from "../sidecars/local-transcription.sidecar";
import { mergeTranscriptions } from "../utils/transcribe.utils";

export const createRollingTranscriptionSession = async (
  createSession: () => Promise<LocalSidecarStreamingSession>,
  sampleRate: number,
): Promise<LocalSidecarStreamingSession> => {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Invalid rolling transcription sample rate");
  }
  const segmentSamples = Math.max(1, Math.round(sampleRate * 30));
  const minimumSegmentSamples = Math.round(sampleRate * 18);
  const overlapSamples = Math.round(sampleRate * 3);
  const frameSamples = Math.max(1, Math.round(sampleRate * 0.02));
  const pauseSamples = Math.max(1, Math.round(sampleRate * 0.2));
  let active: LocalSidecarStreamingSession | null = await createSession();
  let activeSamples = 0;
  let silentSamples = 0;
  let overlap = new Float32Array(0);
  let queue = Promise.resolve();
  let failure: Error | undefined;
  let cancelled = false;
  let finalResult: Promise<LocalSidecarTranscribeOutput> | null = null;
  const retiring = new Set<LocalSidecarStreamingSession>();
  let mergedResult = Promise.resolve<LocalSidecarTranscribeOutput | null>(null);

  const retire = (session: LocalSidecarStreamingSession) => {
    retiring.add(session);
    const result = session
      .finalize()
      .catch((error: unknown) => {
        failure ??= error instanceof Error ? error : new Error(String(error));
        return null;
      })
      .finally(() => {
        session.cleanup();
        retiring.delete(session);
      });
    mergedResult = Promise.all([mergedResult, result])
      .then(([previous, current]) => {
        if (!current) return previous;
        const section = current.text.trim().replace(/\s+/g, " ");
        if (!previous) return { ...current, text: section };
        if (!section) return previous;
        const text = mergeTranscriptions([previous.text, section]);
        if (previous.text && text === `${previous.text} ${section}`) {
          throw new Error(
            "Unable to reconcile overlapping transcription sections",
          );
        }
        return { ...current, text };
      })
      .catch((error: unknown) => {
        failure ??= error instanceof Error ? error : new Error(String(error));
        return null;
      });
  };

  const retainOverlap = (samples: Float32Array) => {
    const kept = Math.min(overlapSamples, overlap.length + samples.length);
    const next = new Float32Array(kept);
    const fromSamples = Math.min(kept, samples.length);
    const fromPrevious = kept - fromSamples;
    if (fromPrevious > 0)
      next.set(overlap.subarray(overlap.length - fromPrevious));
    next.set(samples.subarray(samples.length - fromSamples), fromPrevious);
    overlap = next;
  };

  return {
    writeAudioChunk: (samples) => {
      if (cancelled || finalResult || failure) return;
      const chunk = new Float32Array(samples);
      queue = queue
        .then(async () => {
          let offset = 0;
          while (offset < chunk.length && !cancelled && !failure) {
            if (!active) {
              const session = await createSession();
              if (cancelled) {
                session.cleanup();
                return;
              }
              active = session;
              active.writeAudioChunk(overlap);
              activeSamples = overlap.length;
            }
            const available = Math.min(
              segmentSamples - activeSamples,
              chunk.length - offset,
            );
            let count = 0;
            let boundary = false;
            while (count < available) {
              const frameLength = Math.min(frameSamples, available - count);
              let energy = 0;
              for (let i = 0; i < frameLength; i++) {
                const sample = chunk[offset + count + i];
                energy += sample * sample;
              }
              silentSamples =
                energy / frameLength < 0.000009
                  ? silentSamples + frameLength
                  : 0;
              count += frameLength;
              if (
                activeSamples + count >= minimumSegmentSamples &&
                silentSamples >= pauseSamples
              ) {
                boundary = true;
                break;
              }
            }
            const part = chunk.subarray(offset, offset + count);
            active.writeAudioChunk(part);
            retainOverlap(part);
            activeSamples += count;
            offset += count;
            if (boundary || activeSamples === segmentSamples) {
              retire(active);
              active = null;
              activeSamples = 0;
              silentSamples = 0;
            }
          }
        })
        .catch((error: unknown) => {
          failure ??= error instanceof Error ? error : new Error(String(error));
        });
    },
    finalize: () => {
      if (finalResult) return finalResult;
      const started = performance.now();
      finalResult = (async () => {
        await queue;
        if (cancelled) throw new Error("Transcription cancelled");
        if (active) {
          retire(active);
          active = null;
        }
        const output = await mergedResult;
        if (failure) throw failure;
        if (cancelled) throw new Error("Transcription cancelled");
        if (!output) throw new Error("No transcription result");
        return {
          ...output,
          durationMs: Math.round(performance.now() - started),
        };
      })();
      return finalResult;
    },
    cleanup: () => {
      cancelled = true;
      active?.cleanup();
      active = null;
      for (const session of retiring) session.cleanup();
      overlap = new Float32Array(0);
    },
  };
};
