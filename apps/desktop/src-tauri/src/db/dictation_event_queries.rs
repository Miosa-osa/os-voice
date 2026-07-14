use sqlx::{Row, SqlitePool};

use crate::domain::DictationEvent;

pub async fn insert_dictation_event(
    pool: SqlitePool,
    event: &DictationEvent,
) -> Result<DictationEvent, sqlx::Error> {
    sqlx::query(
        "INSERT INTO dictation_events (id, timestamp, word_count, char_count, app_name, app_target_id, tone_id, correction_count, transcription_duration_ms, postprocess_duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    )
    .bind(&event.id)
    .bind(event.timestamp)
    .bind(event.word_count)
    .bind(event.char_count)
    .bind(&event.app_name)
    .bind(&event.app_target_id)
    .bind(&event.tone_id)
    .bind(event.correction_count)
    .bind(event.transcription_duration_ms)
    .bind(event.postprocess_duration_ms)
    .execute(&pool)
    .await?;

    Ok(event.clone())
}

pub async fn fetch_dictation_events(
    pool: SqlitePool,
) -> Result<Vec<DictationEvent>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, timestamp, word_count, char_count, app_name, app_target_id, tone_id, correction_count, transcription_duration_ms, postprocess_duration_ms
         FROM dictation_events
         ORDER BY timestamp DESC",
    )
    .fetch_all(&pool)
    .await?;

    let events = rows
        .into_iter()
        .map(|row| DictationEvent {
            id: row.get::<String, _>("id"),
            timestamp: row.get::<i64, _>("timestamp"),
            word_count: row.get::<i64, _>("word_count"),
            char_count: row.get::<i64, _>("char_count"),
            app_name: row.get::<Option<String>, _>("app_name"),
            app_target_id: row.get::<Option<String>, _>("app_target_id"),
            tone_id: row.get::<Option<String>, _>("tone_id"),
            correction_count: row.get::<i64, _>("correction_count"),
            transcription_duration_ms: row.get::<Option<i64>, _>("transcription_duration_ms"),
            postprocess_duration_ms: row.get::<Option<i64>, _>("postprocess_duration_ms"),
        })
        .collect();

    Ok(events)
}
