use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Term {
    pub id: String,
    pub created_at: i64,
    pub created_by_user_id: String,
    pub source_value: String,
    pub destination_value: String,
    pub is_replacement: bool,
    pub is_deleted: bool,
    /// Plain-language definition of the term, grounded in how the user uses it.
    /// Optional so older rows and freshly-created corrections deserialize cleanly.
    #[serde(default)]
    pub definition: Option<String>,
    /// Category slug (acronym/technical/proper/phrase/word) for grouping.
    #[serde(default)]
    pub category: Option<String>,
    /// Epoch millis of when the definition was last generated.
    #[serde(default)]
    pub last_defined_at: Option<i64>,
}
