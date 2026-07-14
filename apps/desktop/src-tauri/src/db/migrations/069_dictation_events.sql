CREATE TABLE IF NOT EXISTS dictation_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    char_count INTEGER NOT NULL,
    app_name TEXT,
    app_target_id TEXT,
    tone_id TEXT,
    correction_count INTEGER NOT NULL DEFAULT 0,
    transcription_duration_ms INTEGER,
    postprocess_duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dictation_events_timestamp ON dictation_events(timestamp DESC);
