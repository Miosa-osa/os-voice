import { expect, it } from "vitest";
import { decodeAudioPayload, encodeAudioSamples } from "./audio.utils";
it("keeps the sample-rate header out of encoded audio and preserves subarray bounds", () => {
  const buffer = new ArrayBuffer(20);
  new DataView(buffer).setUint32(0, 16000, true);
  new Float32Array(buffer, 4).set([0.25, -0.5, 0.75, 1]);
  const audio = decodeAudioPayload(buffer);
  expect(audio.sampleRate).toBe(16000);
  const bytes = encodeAudioSamples(audio.samples.subarray(1, 3));
  expect(bytes.byteLength).toBe(8);
  expect(
    Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, 2)),
  ).toEqual([-0.5, 0.75]);
});
