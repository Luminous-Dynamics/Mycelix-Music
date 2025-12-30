//! Song Routes - Core music catalog operations
//!
//! Handles song CRUD, streaming, and play recording

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

/// Song model
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Song {
    pub id: Uuid,
    pub song_hash: String,
    pub title: String,
    pub artist_address: String,
    pub ipfs_hash: String,
    pub strategy_id: String,
    pub payment_model: String,
    pub plays: i64,
    pub earnings: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Create song request
#[derive(Debug, Deserialize)]
pub struct CreateSongRequest {
    pub title: String,
    pub artist_address: String,
    pub ipfs_hash: String,
    pub strategy_id: String,
    pub payment_model: String,
    pub splits: Vec<Split>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Split {
    pub recipient: String,
    pub basis_points: u32,
    pub role: String,
}

/// Query params for listing songs
#[derive(Debug, Deserialize)]
pub struct ListSongsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub genre: Option<String>,
    pub strategy: Option<String>,
    pub search: Option<String>,
}

/// Record play request
#[derive(Debug, Deserialize)]
pub struct RecordPlayRequest {
    pub listener_address: String,
    pub amount: f64,
    pub payment_type: String,
    pub signature: String,
    pub nonce: String,
}

/// List songs with optional filters
pub async fn list_songs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListSongsQuery>,
) -> Result<Json<Vec<Song>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let songs = sqlx::query_as::<_, Song>(
        r#"
        SELECT id, song_hash, title, artist_address, ipfs_hash,
               strategy_id, payment_model, plays, earnings::float8 as earnings, created_at
        FROM songs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list songs: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(songs))
}

/// Get a single song by ID
pub async fn get_song(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Song>, StatusCode> {
    let song = sqlx::query_as::<_, Song>(
        r#"
        SELECT id, song_hash, title, artist_address, ipfs_hash,
               strategy_id, payment_model, plays, earnings::float8 as earnings, created_at
        FROM songs
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get song: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(song))
}

/// Create a new song
pub async fn create_song(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSongRequest>,
) -> Result<Json<Song>, StatusCode> {
    let id = Uuid::new_v4();
    let song_hash = format!("0x{}", hex::encode(sha2::Sha256::digest(id.as_bytes())));

    let song = sqlx::query_as::<_, Song>(
        r#"
        INSERT INTO songs (id, song_hash, title, artist_address, ipfs_hash, strategy_id, payment_model, plays, earnings)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
        RETURNING id, song_hash, title, artist_address, ipfs_hash,
                  strategy_id, payment_model, plays, earnings::float8 as earnings, created_at
        "#,
    )
    .bind(id)
    .bind(&song_hash)
    .bind(&req.title)
    .bind(&req.artist_address)
    .bind(&req.ipfs_hash)
    .bind(&req.strategy_id)
    .bind(&req.payment_model)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create song: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Created song: {} by {}", song.title, song.artist_address);
    Ok(Json(song))
}

/// Record a play (streaming event)
pub async fn record_play(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<RecordPlayRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Verify signature
    // TODO: Process payment via smart contract
    // TODO: For now, just record the play in DB

    // Update play count and earnings
    let result = sqlx::query(
        r#"
        UPDATE songs
        SET plays = plays + 1, earnings = earnings + $2
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(req.amount)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to record play: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    // Insert play record
    sqlx::query(
        r#"
        INSERT INTO plays (song_id, listener_address, amount, payment_type, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
    )
    .bind(id)
    .bind(&req.listener_address)
    .bind(req.amount)
    .bind(&req.payment_type)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert play record: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Recorded play for song {} by {}", id, req.listener_address);

    Ok(Json(serde_json::json!({
        "success": true,
        "song_id": id,
        "listener": req.listener_address,
        "amount": req.amount,
        "message": "Play recorded. Artist paid instantly!"
    })))
}

use sha2::Digest;
