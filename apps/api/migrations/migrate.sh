#!/bin/bash

# ============================================================================
# Database Migration Runner
# ============================================================================
# Usage:
#   ./migrations/migrate.sh up      # Run all pending migrations
#   ./migrations/migrate.sh down    # Rollback last migration
#   ./migrations/migrate.sh status  # Show migration status
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Database connection
DATABASE_URL="${DATABASE_URL:-postgresql://mycelix:mycelix_dev_pass@localhost:5432/mycelix_music}"

# Migration directory
MIGRATIONS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Command
COMMAND="${1:-up}"

echo ""
echo -e "${BLUE}🔄 Database Migration Runner${NC}"
echo ""

# Function to run SQL file
run_sql_file() {
    local file=$1
    echo -e "${BLUE}Running: $(basename $file)${NC}"
    psql "$DATABASE_URL" -f "$file" --echo-errors --quiet
}

# Function to get current schema version
get_current_version() {
    psql "$DATABASE_URL" -t -c "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;" 2>/dev/null || echo "0"
}

# Function to list pending migrations
list_pending_migrations() {
    local current_version=$(get_current_version)
    local migrations=()

    for file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            local version=$(echo "$filename" | grep -oP '^\d+')

            if [ "$version" -gt "$current_version" ]; then
                migrations+=("$file")
            fi
        fi
    done

    printf '%s\n' "${migrations[@]}" | sort -V
}

# Function to show migration status
show_status() {
    local current_version=$(get_current_version)

    echo "Current schema version: $current_version"
    echo ""
    echo "Applied migrations:"
    psql "$DATABASE_URL" -c "SELECT version, description, applied_at FROM schema_migrations ORDER BY version;" || echo "No migrations applied yet"
    echo ""
    echo "Pending migrations:"

    local pending=$(list_pending_migrations)
    if [ -z "$pending" ]; then
        echo "  None - database is up to date"
    else
        echo "$pending" | while read -r file; do
            echo "  - $(basename $file)"
        done
    fi
    echo ""
}

# Main logic
case "$COMMAND" in
    up)
        echo "Running migrations..."
        echo ""

        local pending=$(list_pending_migrations)

        if [ -z "$pending" ]; then
            echo -e "${GREEN}✅ Database is up to date${NC}"
            exit 0
        fi

        echo "$pending" | while read -r file; do
            run_sql_file "$file"
            echo -e "${GREEN}✅ Applied: $(basename $file)${NC}"
        done

        echo ""
        echo -e "${GREEN}✅ All migrations completed successfully${NC}"
        ;;

    down)
        echo -e "${YELLOW}⚠️  Rolling back last migration...${NC}"
        echo ""

        local current_version=$(get_current_version)

        if [ "$current_version" -eq "0" ]; then
            echo -e "${YELLOW}No migrations to rollback${NC}"
            exit 0
        fi

        # Find rollback file
        local rollback_file="${MIGRATIONS_DIR}/${current_version}_*.down.sql"

        if [ ! -f "$rollback_file" ]; then
            echo -e "${RED}❌ No rollback file found for version $current_version${NC}"
            echo "Expected: ${current_version}_*.down.sql"
            exit 1
        fi

        run_sql_file "$rollback_file"

        # Remove from schema_migrations
        psql "$DATABASE_URL" -c "DELETE FROM schema_migrations WHERE version = $current_version;"

        echo -e "${GREEN}✅ Rolled back version $current_version${NC}"
        ;;

    status)
        show_status
        ;;

    *)
        echo "Usage: $0 {up|down|status}"
        echo ""
        echo "Commands:"
        echo "  up      - Run all pending migrations"
        echo "  down    - Rollback last migration"
        echo "  status  - Show migration status"
        echo ""
        exit 1
        ;;
esac

echo ""
