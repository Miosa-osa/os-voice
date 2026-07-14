use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DictationEvent {
    pub id: String,
    pub timestamp: i64,
    pub word_count: i64,
    pub char_count: i64,
    pub app_name: Option<String>,
    pub app_target_id: Option<String>,
    pub tone_id: Option<String>,
    pub correction_count: i64,
    pub transcription_duration_ms: Option<i64>,
    pub postprocess_duration_ms: Option<i64>,
}
