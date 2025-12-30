//! Mycelix Music API - Rust/Axum Implementation
//!
//! This is the high-performance Rust backend for Mycelix Music,
//! designed for ecosystem consistency with Mycelix-Core and
//! future Holochain integration.

use axum::{
    routing::{get, post},
    Router,
    http::StatusCode,
    Json,
    extract::State,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod routes;
mod services;
mod models;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub db_pool: sqlx::PgPool,
    pub redis: redis::Client,
    pub ipfs_client: ipfs_api_backend_hyper::IpfsClient,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    services: ServiceStatus,
}

#[derive(Serialize)]
struct ServiceStatus {
    database: bool,
    redis: bool,
    ipfs: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "mycelix_music_api=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Database connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://mycelix:mycelix_dev_pass@localhost:5432/mycelix_music".into());

    let db_pool = sqlx::PgPool::connect(&database_url).await?;
    tracing::info!("Connected to PostgreSQL");

    // Redis connection
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".into());
    let redis = redis::Client::open(redis_url)?;
    tracing::info!("Connected to Redis");

    // IPFS client
    let ipfs_url = std::env::var("IPFS_API_URL")
        .unwrap_or_else(|_| "http://localhost:5001".into());
    let ipfs_client = ipfs_api_backend_hyper::IpfsClient::from_str(&ipfs_url)?;
    tracing::info!("Connected to IPFS");

    // Create app state
    let state = Arc::new(AppState {
        db_pool,
        redis,
        ipfs_client,
    });

    // Build router
    let app = Router::new()
        // Health & Status
        .route("/health", get(health_check))
        .route("/", get(root))

        // Songs
        .route("/api/songs", get(routes::songs::list_songs))
        .route("/api/songs", post(routes::songs::create_song))
        .route("/api/songs/:id", get(routes::songs::get_song))
        .route("/api/songs/:id/play", post(routes::songs::record_play))

        // Artists
        .route("/api/artists/:address", get(routes::artists::get_artist))
        .route("/api/artists/:address/songs", get(routes::artists::get_artist_songs))

        // Analytics
        .route("/api/analytics/artist/:address", get(routes::analytics::artist_analytics))
        .route("/api/analytics/song/:id", get(routes::analytics::song_analytics))
        .route("/api/analytics/top-songs", get(routes::analytics::top_songs))

        // Uploads
        .route("/api/upload", post(routes::uploads::upload_file))

        // Economic Strategies
        .route("/api/strategies", get(routes::strategies::list_strategies))
        .route("/api/strategies/:id/preview", post(routes::strategies::preview_splits))

        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let port = std::env::var("PORT").unwrap_or_else(|_| "3100".into());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("🎵 Mycelix Music API starting on {}", addr);
    tracing::info!("   Vision: Default choice for the entire music industry");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Root endpoint
async fn root() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "name": "Mycelix Music API",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "Decentralized music platform with modular economics",
        "vision": "The default choice for the entire music industry",
        "features": [
            "10-50x artist earnings",
            "Instant settlements",
            "Zero-cost streaming (via Holochain)",
            "Community-owned infrastructure"
        ],
        "docs": "/docs",
        "health": "/health"
    }))
}

/// Health check endpoint
async fn health_check(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(&state.db_pool)
        .await
        .is_ok();

    let redis_ok = state.redis
        .get_connection()
        .map(|_| true)
        .unwrap_or(false);

    // IPFS check (simple version query)
    let ipfs_ok = state.ipfs_client
        .version()
        .await
        .is_ok();

    Json(HealthResponse {
        status: if db_ok && redis_ok { "healthy".into() } else { "degraded".into() },
        version: env!("CARGO_PKG_VERSION").into(),
        services: ServiceStatus {
            database: db_ok,
            redis: redis_ok,
            ipfs: ipfs_ok,
        },
    })
}
