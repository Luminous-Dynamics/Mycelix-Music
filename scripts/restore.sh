#!/bin/bash
# ============================================================================
# Database Restore Script
# ============================================================================
# Restores PostgreSQL database from backup
# Usage: ./restore.sh <backup_file>
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_FILE=$1
ENCRYPTION_PASSWORD=${BACKUP_ENCRYPTION_PASSWORD:-""}

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Mycelix Music - Database Restore${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# Validate Input
# ============================================================================

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ No backup file specified${NC}"
    echo ""
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh /var/backups/mycelix/ 2>/dev/null || echo "  No backups found"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL not set${NC}"
    exit 1
fi

# ============================================================================
# Confirmation
# ============================================================================

echo -e "${YELLOW}⚠️  WARNING: This will replace the current database!${NC}"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "Database: $DATABASE_URL"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Restore cancelled${NC}"
    exit 0
fi

echo ""

# ============================================================================
# Create Safety Backup
# ============================================================================

echo -e "${YELLOW}[1/5] Creating safety backup of current database...${NC}"

SAFETY_BACKUP="/tmp/mycelix_pre_restore_$(date +%Y%m%d_%H%M%S).sql"

if pg_dump "$DATABASE_URL" --format=plain --no-owner --file="$SAFETY_BACKUP" 2>&1; then
    echo -e "${GREEN}  ✓ Safety backup created: $SAFETY_BACKUP${NC}"
else
    echo -e "${RED}  ✗ Safety backup failed${NC}"
    read -p "Continue without safety backup? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        exit 1
    fi
fi

echo ""

# ============================================================================
# Prepare Backup File
# ============================================================================

echo -e "${YELLOW}[2/5] Preparing backup file...${NC}"

TEMP_DIR=$(mktemp -d)
WORKING_FILE=""

# Decrypt if encrypted
if [[ "$BACKUP_FILE" == *.enc ]]; then
    if [ -z "$ENCRYPTION_PASSWORD" ]; then
        echo -e "${RED}✗ Backup is encrypted but no password provided${NC}"
        echo "  Set BACKUP_ENCRYPTION_PASSWORD environment variable"
        exit 1
    fi

    echo "  Decrypting backup..."
    DECRYPTED_FILE="$TEMP_DIR/backup.sql.gz"

    if openssl enc -aes-256-cbc -d \
        -in "$BACKUP_FILE" \
        -out "$DECRYPTED_FILE" \
        -pass pass:"$ENCRYPTION_PASSWORD"; then
        echo -e "${GREEN}  ✓ Backup decrypted${NC}"
        WORKING_FILE="$DECRYPTED_FILE"
    else
        echo -e "${RED}  ✗ Decryption failed - wrong password?${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
else
    WORKING_FILE="$BACKUP_FILE"
fi

# Decompress if compressed
if [[ "$WORKING_FILE" == *.gz ]]; then
    echo "  Decompressing backup..."
    SQL_FILE="$TEMP_DIR/backup.sql"

    if gunzip -c "$WORKING_FILE" > "$SQL_FILE"; then
        echo -e "${GREEN}  ✓ Backup decompressed${NC}"
        WORKING_FILE="$SQL_FILE"
    else
        echo -e "${RED}  ✗ Decompression failed${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
fi

echo ""

# ============================================================================
# Drop Existing Database
# ============================================================================

echo -e "${YELLOW}[3/5] Dropping existing database...${NC}"

# Extract database name from DATABASE_URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Drop all tables (safer than dropping entire database)
if psql "$DATABASE_URL" -c "
    DO \$\$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END \$\$;
" > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Existing tables dropped${NC}"
else
    echo -e "${RED}  ✗ Failed to drop existing tables${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""

# ============================================================================
# Restore Database
# ============================================================================

echo -e "${YELLOW}[4/5] Restoring database...${NC}"

if psql "$DATABASE_URL" < "$WORKING_FILE" 2>&1 | tee /tmp/restore.log; then
    echo -e "${GREEN}  ✓ Database restored successfully${NC}"
else
    echo -e "${RED}  ✗ Restore failed${NC}"
    echo ""
    echo "Error log:"
    tail -20 /tmp/restore.log
    echo ""
    echo -e "${YELLOW}Attempting to restore safety backup...${NC}"

    if [ -f "$SAFETY_BACKUP" ]; then
        psql "$DATABASE_URL" < "$SAFETY_BACKUP"
        echo -e "${GREEN}  ✓ Safety backup restored${NC}"
    fi

    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""

# ============================================================================
# Verify Restore
# ============================================================================

echo -e "${YELLOW}[5/5] Verifying restore...${NC}"

# Check table count
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}  ✓ Found $TABLE_COUNT tables${NC}"
else
    echo -e "${RED}  ✗ No tables found - restore may have failed${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check row counts for key tables
echo "  Checking data integrity..."

for table in songs plays artists; do
    if psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');" | grep -q t; then
        ROW_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
        echo "    $table: $ROW_COUNT rows"
    fi
done

echo ""

# ============================================================================
# Cleanup
# ============================================================================

echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

if [ -f "$SAFETY_BACKUP" ]; then
    echo "Safety backup available at: $SAFETY_BACKUP"
    echo "(You can delete this after verifying the restore)"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Database restore completed successfully${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify application functionality"
echo "  2. Check data integrity"
echo "  3. Delete safety backup if everything looks good:"
echo "     rm $SAFETY_BACKUP"
echo ""
