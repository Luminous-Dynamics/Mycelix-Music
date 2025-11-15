#!/bin/bash

# ============================================================================
# Mycelix Music - Admin CLI
# ============================================================================
# Administrative CLI for platform management
#
# Usage: ./scripts/admin-cli.sh <command> [args...]
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

COMMAND="${1:-help}"

# Database connection
DATABASE_URL="${DATABASE_URL:-postgresql://mycelix:mycelix_dev_pass@localhost:5432/mycelix_music}"

# Functions
show_help() {
    echo ""
    echo -e "${BLUE}🎵 Mycelix Music Admin CLI${NC}"
    echo ""
    echo "Commands:"
    echo ""
    echo "  ${GREEN}stats${NC}                Show platform statistics"
    echo "  ${GREEN}artists${NC}              List top artists"
    echo "  ${GREEN}songs [artist]${NC}       List songs (optionally by artist)"
    echo "  ${GREEN}listeners${NC}            List top listeners"
    echo "  ${GREEN}plays <song_id>${NC}      Show plays for a song"
    echo "  ${GREEN}revenue <artist>${NC}     Show revenue for an artist"
    echo "  ${GREEN}cache-clear${NC}          Clear Redis cache"
    echo "  ${GREEN}cache-stats${NC}          Show Redis cache statistics"
    echo "  ${GREEN}db-backup${NC}            Backup database"
    echo "  ${GREEN}db-vacuum${NC}            Vacuum and analyze database"
    echo "  ${GREEN}health${NC}               Check all services health"
    echo "  ${GREEN}logs [service]${NC}       Show logs (api, postgres, redis, all)"
    echo ""
}

show_stats() {
    echo -e "${BLUE}📊 Platform Statistics${NC}"
    echo ""

    # Total songs
    TOTAL_SONGS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM songs;")
    echo "Total Songs:     $TOTAL_SONGS"

    # Total plays
    TOTAL_PLAYS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM plays;")
    echo "Total Plays:     $TOTAL_PLAYS"

    # Total artists
    TOTAL_ARTISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(DISTINCT artist_address) FROM songs;")
    echo "Total Artists:   $TOTAL_ARTISTS"

    # Total listeners
    TOTAL_LISTENERS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(DISTINCT listener_address) FROM plays;")
    echo "Total Listeners: $TOTAL_LISTENERS"

    # Total revenue
    TOTAL_REVENUE=$(psql "$DATABASE_URL" -t -c "SELECT COALESCE(SUM(amount_paid), 0) FROM plays;")
    echo "Total Revenue:   $TOTAL_REVENUE tokens"

    # Plays in last 24h
    PLAYS_24H=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM plays WHERE timestamp > NOW() - INTERVAL '24 hours';")
    echo "Plays (24h):     $PLAYS_24H"

    echo ""
}

list_artists() {
    echo -e "${BLUE}🎨 Top Artists${NC}"
    echo ""
    psql "$DATABASE_URL" -c "
        SELECT
            artist_name,
            COUNT(*) as song_count,
            COALESCE(SUM(p.amount_paid), 0) as total_revenue
        FROM songs s
        LEFT JOIN plays p ON s.song_id = p.song_id
        GROUP BY s.artist_address, s.artist_name
        ORDER BY total_revenue DESC
        LIMIT 10;
    "
}

list_songs() {
    local artist=$1

    echo -e "${BLUE}🎵 Songs${NC}"
    echo ""

    if [ -z "$artist" ]; then
        psql "$DATABASE_URL" -c "
            SELECT
                title,
                artist_name,
                genre,
                payment_model,
                COUNT(p.id) as play_count
            FROM songs s
            LEFT JOIN plays p ON s.song_id = p.song_id
            GROUP BY s.song_id
            ORDER BY play_count DESC
            LIMIT 20;
        "
    else
        psql "$DATABASE_URL" -c "
            SELECT
                title,
                genre,
                payment_model,
                COUNT(p.id) as play_count
            FROM songs s
            LEFT JOIN plays p ON s.song_id = p.song_id
            WHERE s.artist_address = '$artist'
            GROUP BY s.song_id
            ORDER BY play_count DESC;
        "
    fi
}

list_listeners() {
    echo -e "${BLUE}🎧 Top Listeners${NC}"
    echo ""
    psql "$DATABASE_URL" -c "
        SELECT
            listener_address,
            COUNT(*) as total_plays,
            SUM(amount_paid) as total_spent
        FROM plays
        GROUP BY listener_address
        ORDER BY total_plays DESC
        LIMIT 10;
    "
}

show_plays() {
    local song_id=$1

    if [ -z "$song_id" ]; then
        echo -e "${RED}Error: song_id required${NC}"
        echo "Usage: $0 plays <song_id>"
        exit 1
    fi

    echo -e "${BLUE}📊 Plays for Song: $song_id${NC}"
    echo ""
    psql "$DATABASE_URL" -c "
        SELECT
            listener_address,
            timestamp,
            amount_paid,
            payment_type
        FROM plays
        WHERE song_id = '$song_id'
        ORDER BY timestamp DESC
        LIMIT 50;
    "
}

show_revenue() {
    local artist=$1

    if [ -z "$artist" ]; then
        echo -e "${RED}Error: artist_address required${NC}"
        echo "Usage: $0 revenue <artist_address>"
        exit 1
    fi

    echo -e "${BLUE}💰 Revenue for Artist: $artist${NC}"
    echo ""
    psql "$DATABASE_URL" -c "
        SELECT
            s.title,
            COUNT(p.id) as play_count,
            SUM(p.amount_paid) as revenue
        FROM songs s
        LEFT JOIN plays p ON s.song_id = p.song_id
        WHERE s.artist_address = '$artist'
        GROUP BY s.song_id, s.title
        ORDER BY revenue DESC;
    "

    echo ""
    echo "Total Revenue:"
    psql "$DATABASE_URL" -c "
        SELECT SUM(p.amount_paid) as total_revenue
        FROM songs s
        LEFT JOIN plays p ON s.song_id = p.song_id
        WHERE s.artist_address = '$artist';
    "
}

cache_clear() {
    echo -e "${BLUE}🗑️  Clearing Redis cache...${NC}"

    REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

    redis-cli -u "$REDIS_URL" FLUSHALL

    echo -e "${GREEN}✅ Cache cleared${NC}"
}

cache_stats() {
    echo -e "${BLUE}📊 Redis Cache Statistics${NC}"
    echo ""

    REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

    redis-cli -u "$REDIS_URL" INFO stats | grep -E 'keyspace_hits|keyspace_misses'

    echo ""
    echo "Keys by pattern:"
    redis-cli -u "$REDIS_URL" KEYS '*' | cut -d':' -f1 | sort | uniq -c
}

db_backup() {
    echo -e "${BLUE}💾 Backing up database...${NC}"

    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

    echo -e "${GREEN}✅ Backup saved: $BACKUP_FILE${NC}"
}

db_vacuum() {
    echo -e "${BLUE}🧹 Vacuuming database...${NC}"

    psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

    echo -e "${GREEN}✅ Vacuum complete${NC}"
}

check_health() {
    echo -e "${BLUE}🏥 Health Check${NC}"
    echo ""

    # API
    echo -n "API:        "
    if curl -s http://localhost:3100/health > /dev/null; then
        echo -e "${GREEN}✅ UP${NC}"
    else
        echo -e "${RED}❌ DOWN${NC}"
    fi

    # PostgreSQL
    echo -n "PostgreSQL: "
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ UP${NC}"
    else
        echo -e "${RED}❌ DOWN${NC}"
    fi

    # Redis
    echo -n "Redis:      "
    REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
    if redis-cli -u "$REDIS_URL" PING > /dev/null 2>&1; then
        echo -e "${GREEN}✅ UP${NC}"
    else
        echo -e "${RED}❌ DOWN${NC}"
    fi

    echo ""
}

show_logs() {
    local service="${1:-all}"

    case "$service" in
        api)
            docker-compose logs -f api
            ;;
        postgres)
            docker-compose logs -f postgres
            ;;
        redis)
            docker-compose logs -f redis
            ;;
        all|*)
            docker-compose logs -f
            ;;
    esac
}

# Main logic
case "$COMMAND" in
    stats)
        show_stats
        ;;
    artists)
        list_artists
        ;;
    songs)
        list_songs "$2"
        ;;
    listeners)
        list_listeners
        ;;
    plays)
        show_plays "$2"
        ;;
    revenue)
        show_revenue "$2"
        ;;
    cache-clear)
        cache_clear
        ;;
    cache-stats)
        cache_stats
        ;;
    db-backup)
        db_backup
        ;;
    db-vacuum)
        db_vacuum
        ;;
    health)
        check_health
        ;;
    logs)
        show_logs "$2"
        ;;
    help|*)
        show_help
        ;;
esac

echo ""
