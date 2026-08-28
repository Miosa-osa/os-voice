use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::WhisperModel;
use crate::transcription::TranscriptionOutput;

// Audio is transcribed incrementally while the user is still speaking. Once
// enough audio has accumulated, the buffer is cut at a stretch of silence
// (never mid-word), the cut segment is decoded in the background with the
// text so far as context, and only the short tail remains to decode when the
// session is finalized.
const MIN_SEGMENT_SECS: f32 = 8.0;
const MAX_SEGMENT_SECS: f32 = 25.0;
const SILENCE_FRAME_SECS: f32 = 0.1;
// Plosive closures and inter-word gaps are well under 200 ms; only a sustained
// pause is a safe place to cut.
const SILENCE_RUN_FRAMES: usize = 4;
const MIN_TAIL_SECS: f32 = 0.3;
const SILENCE_FLOOR: f32 = 0.004;
const SILENCE_RATIO: f32 = 0.15;
const CONTEXT_TAIL_CHARS: usize = 300;

pub type SegmentResult = Result<TranscriptionOutput, ApiError>;

#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub model: WhisperModel,
    pub sample_rate: u32,
    pub language: Option<String>,
    pub initial_prompt: Option<String>,
    pub device_id: Option<String>,
}

pub struct ReadySegment {
    pub config: SessionConfig,
    pub samples: Vec<f32>,
    pub prompt: Option<String>,
}

pub struct FinalizedSession {
    pub config: SessionConfig,
    pub committed: String,
    pub tail: Vec<f32>,
    pub inference_device: Option<String>,
    pub in_flight: Option<JoinHandle<SegmentResult>>,
}

impl FinalizedSession {
    pub fn tail_prompt(&self) -> Option<String> {
        context_prompt(self.config.initial_prompt.as_deref(), &self.committed)
    }

    pub fn tail_is_worth_decoding(&self) -> bool {
        let min_samples = (MIN_TAIL_SECS * self.config.sample_rate as f32) as usize;
        self.tail.len() >= min_samples && !is_silent(&self.tail, self.config.sample_rate)
    }
}

struct Session {
    config: SessionConfig,
    pending: Vec<f32>,
    committed: String,
    inference_device: Option<String>,
    in_flight: Option<JoinHandle<SegmentResult>>,
}

impl Session {
    fn commit(&mut self, output: TranscriptionOutput) {
        append_text(&mut self.committed, &output.text);
        self.inference_device = Some(output.inference_device);
    }
}

#[derive(Default)]
struct SessionStore {
    sessions: HashMap<Uuid, Session>,
}

#[derive(Clone, Default)]
pub struct TranscriptionSessionRegistry {
    inner: Arc<Mutex<SessionStore>>,
}

impl TranscriptionSessionRegistry {
    pub async fn create(&self, config: SessionConfig) -> Uuid {
        let session_id = Uuid::new_v4();
        let session = Session {
            config,
            pending: Vec::new(),
            committed: String::new(),
            inference_device: None,
            in_flight: None,
        };

        let mut store = self.inner.lock().await;
        store.sessions.insert(session_id, session);
        session_id
    }

    pub async fn append_samples(&self, session_id: Uuid, samples: Vec<f32>) -> Option<usize> {
        let mut store = self.inner.lock().await;
        let session = store.sessions.get_mut(&session_id)?;
        session.pending.extend(samples);
        Some(session.pending.len())
    }

    /// Folds in a finished background segment and, if enough audio has
    /// accumulated since the last cut, hands back the next segment to decode.
    pub async fn take_ready_segment(
        &self,
        session_id: Uuid,
    ) -> Result<Option<ReadySegment>, ApiError> {
        let mut store = self.inner.lock().await;
        let Some(session) = store.sessions.get_mut(&session_id) else {
            return Ok(None);
        };

        if let Some(handle) = session.in_flight.as_ref() {
            if !handle.is_finished() {
                return Ok(None);
            }
        }
        if let Some(handle) = session.in_flight.take() {
            session.commit(join_segment(handle).await?);
        }

        let Some(cut) = find_cut_point(&session.pending, session.config.sample_rate) else {
            return Ok(None);
        };
        let samples: Vec<f32> = session.pending.drain(..cut).collect();
        if is_silent(&samples, session.config.sample_rate) {
            return Ok(None);
        }

        Ok(Some(ReadySegment {
            config: session.config.clone(),
            prompt: context_prompt(session.config.initial_prompt.as_deref(), &session.committed),
            samples,
        }))
    }

    pub async fn set_in_flight(&self, session_id: Uuid, handle: JoinHandle<SegmentResult>) {
        let mut store = self.inner.lock().await;
        match store.sessions.get_mut(&session_id) {
            Some(session) => session.in_flight = Some(handle),
            None => handle.abort(),
        }
    }

    pub async fn take(&self, session_id: Uuid) -> Option<FinalizedSession> {
        let mut store = self.inner.lock().await;
        let session = store.sessions.remove(&session_id)?;
        Some(FinalizedSession {
            config: session.config,
            committed: session.committed,
            tail: session.pending,
            inference_device: session.inference_device,
            in_flight: session.in_flight,
        })
    }

    pub async fn remove(&self, session_id: Uuid) -> bool {
        let mut store = self.inner.lock().await;
        match store.sessions.remove(&session_id) {
            Some(session) => {
                if let Some(handle) = session.in_flight {
                    handle.abort();
                }
                true
            }
            None => false,
        }
    }
}

pub async fn join_segment(handle: JoinHandle<SegmentResult>) -> SegmentResult {
    handle.await.map_err(|err| {
        ApiError::internal(
            "segment_task_failed",
            format!("background transcription task failed: {err}"),
        )
    })?
}

pub fn append_text(committed: &mut String, text: &str) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    if !committed.is_empty() {
        committed.push(' ');
    }
    committed.push_str(text);
}

fn context_prompt(initial_prompt: Option<&str>, committed: &str) -> Option<String> {
    let base = initial_prompt.map(str::trim).unwrap_or("");
    let tail = committed_tail(committed);
    let prompt = match (base.is_empty(), tail.is_empty()) {
        (true, true) => return None,
        (false, true) => base.to_string(),
        (true, false) => tail.to_string(),
        (false, false) => format!("{base} {tail}"),
    };
    Some(prompt)
}

fn committed_tail(committed: &str) -> &str {
    if committed.len() <= CONTEXT_TAIL_CHARS {
        return committed;
    }
    let start = committed.len() - CONTEXT_TAIL_CHARS;
    let start = committed[start..]
        .find(' ')
        .map(|offset| start + offset + 1)
        .unwrap_or(start);
    let mut start = start;
    while !committed.is_char_boundary(start) {
        start += 1;
    }
    &committed[start..]
}

fn frame_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let energy: f32 = samples.iter().map(|s| s * s).sum();
    (energy / samples.len() as f32).sqrt()
}

fn silence_threshold(frames: &[f32]) -> f32 {
    let mean = frames.iter().sum::<f32>() / frames.len().max(1) as f32;
    (mean * SILENCE_RATIO).max(SILENCE_FLOOR)
}

fn is_silent(samples: &[f32], sample_rate: u32) -> bool {
    let frame_len = ((SILENCE_FRAME_SECS * sample_rate as f32) as usize).max(1);
    let loudest = samples
        .chunks(frame_len)
        .map(frame_rms)
        .fold(0.0f32, f32::max);
    loudest < SILENCE_FLOOR * 2.0
}

/// Returns the sample index to cut a segment at, or None if the buffer should
/// keep accumulating. Prefers the latest sustained silence once
/// MIN_SEGMENT_SECS of audio is buffered; past MAX_SEGMENT_SECS it cuts at the
/// quietest stretch so a segment never outgrows a single Whisper window.
pub fn find_cut_point(samples: &[f32], sample_rate: u32) -> Option<usize> {
    let rate = sample_rate as f32;
    let min_len = (MIN_SEGMENT_SECS * rate) as usize;
    if samples.len() < min_len {
        return None;
    }

    let frame_len = ((SILENCE_FRAME_SECS * rate) as usize).max(1);
    let frames: Vec<f32> = samples.chunks_exact(frame_len).map(frame_rms).collect();
    if frames.len() < SILENCE_RUN_FRAMES {
        return None;
    }
    let threshold = silence_threshold(&frames);
    let first_frame = min_len / frame_len;
    let run_middle = |start: usize| {
        (start * frame_len + (SILENCE_RUN_FRAMES * frame_len) / 2).min(samples.len())
    };

    let latest_run = (first_frame..=frames.len() - SILENCE_RUN_FRAMES)
        .rev()
        .find(|start| {
            frames[*start..*start + SILENCE_RUN_FRAMES]
                .iter()
                .all(|rms| *rms < threshold)
        });
    if let Some(start) = latest_run {
        return Some(run_middle(start));
    }

    let max_len = (MAX_SEGMENT_SECS * rate) as usize;
    if samples.len() < max_len {
        return None;
    }
    let last_start = (max_len / frame_len).min(frames.len() - SILENCE_RUN_FRAMES);
    let quietest = (first_frame..=last_start)
        .min_by(|a, b| {
            let energy = |start: usize| {
                frames[start..start + SILENCE_RUN_FRAMES]
                    .iter()
                    .sum::<f32>()
            };
            energy(*a).total_cmp(&energy(*b))
        })
        .unwrap_or(last_start);
    Some(run_middle(quietest))
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 16_000;

    fn tone(secs: f32, amplitude: f32) -> Vec<f32> {
        (0..(secs * RATE as f32) as usize)
            .map(|i| amplitude * ((i as f32) * 0.3).sin())
            .collect()
    }

    #[test]
    fn keeps_accumulating_below_minimum() {
        let audio = tone(5.0, 0.2);
        assert_eq!(find_cut_point(&audio, RATE), None);
    }

    #[test]
    fn cuts_at_latest_silence_once_minimum_reached() {
        let mut audio = tone(9.0, 0.2);
        audio.extend(tone(0.5, 0.0));
        audio.extend(tone(2.0, 0.2));
        let cut = find_cut_point(&audio, RATE).expect("cut point");
        let silence_start = (9.0 * RATE as f32) as usize;
        let silence_end = silence_start + (0.5 * RATE as f32) as usize;
        assert!(cut >= silence_start && cut <= silence_end, "cut={cut}");
    }

    #[test]
    fn ignores_brief_dips_inside_speech() {
        let mut audio = tone(9.0, 0.2);
        audio.extend(tone(0.15, 0.0));
        audio.extend(tone(3.0, 0.2));
        assert_eq!(find_cut_point(&audio, RATE), None);
    }

    #[test]
    fn continuous_speech_waits_until_maximum() {
        let audio = tone(20.0, 0.2);
        assert_eq!(find_cut_point(&audio, RATE), None);
        let audio = tone(26.0, 0.2);
        let cut = find_cut_point(&audio, RATE).expect("forced cut");
        assert!(cut >= (MIN_SEGMENT_SECS * RATE as f32) as usize);
        assert!(cut <= (MAX_SEGMENT_SECS * RATE as f32) as usize + 1);
    }

    #[test]
    fn detects_silent_segments() {
        assert!(is_silent(&tone(2.0, 0.001), RATE));
        assert!(!is_silent(&tone(2.0, 0.1), RATE));
    }

    #[test]
    fn context_prompt_keeps_recent_text_and_base_prompt() {
        let committed = "word ".repeat(200);
        let prompt = context_prompt(Some("Glossary"), &committed).unwrap();
        assert!(prompt.starts_with("Glossary "));
        assert!(prompt.len() <= "Glossary ".len() + CONTEXT_TAIL_CHARS + 1);
        assert_eq!(context_prompt(None, ""), None);
    }

    #[test]
    fn append_text_joins_with_single_space() {
        let mut committed = String::new();
        append_text(&mut committed, "  Hello ");
        append_text(&mut committed, "");
        append_text(&mut committed, "world.");
        assert_eq!(committed, "Hello world.");
    }
}
