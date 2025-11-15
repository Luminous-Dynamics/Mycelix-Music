#!/bin/bash
# ============================================================================
# Database Backup Script
# ============================================================================
# Creates encrypted backups of PostgreSQL database and uploads to S3
# Run daily via cron: 0 2 * * * /path/to/backup.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/mycelix"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="mycelix_backup_${TIMESTAMP}"
ENCRYPTION_PASSWORD=${BACKUP_ENCRYPTION_PASSWORD:-""}

# S3 Configuration (optional)
USE_S3=${USE_S3:-false}
S3_BUCKET=${AWS_BACKUP_BUCKET:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Mycelix Music - Database Backup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# Validate Environment
# ============================================================================

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL not set${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}[1/6] Preparing backup...${NC}"
echo "  Backup name: $BACKUP_NAME"
echo "  Retention: $RETENTION_DAYS days"
echo ""

# ============================================================================
# Database Backup
# ============================================================================

echo -e "${YELLOW}[2/6] Backing up PostgreSQL database...${NC}"

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"

# Dump database
if pg_dump "$DATABASE_URL" \
    --verbose \
    --format=plain \
    --no-owner \
    --no-privileges \
    --file="$BACKUP_FILE" 2>&1 | tee /tmp/backup.log; then

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Database backup complete ($BACKUP_SIZE)${NC}"
else
    echo -e "${RED}  ✗ Database backup failed${NC}"
    cat /tmp/backup.log
    exit 1
fi

echo ""

# ============================================================================
# Compress Backup
# ============================================================================

echo -e "${YELLOW}[3/6] Compressing backup...${NC}"

COMPRESSED_FILE="${BACKUP_FILE}.gz"

if gzip -9 "$BACKUP_FILE"; then
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Backup compressed ($COMPRESSED_SIZE)${NC}"
else
    echo -e "${RED}  ✗ Compression failed${NC}"
    exit 1
fi

echo ""

# ============================================================================
# Encrypt Backup
# ============================================================================

if [ -n "$ENCRYPTION_PASSWORD" ]; then
    echo -e "${YELLOW}[4/6] Encrypting backup...${NC}"

    ENCRYPTED_FILE="${COMPRESSED_FILE}.enc"

    if openssl enc -aes-256-cbc \
        -salt \
        -in "$COMPRESSED_FILE" \
        -out "$ENCRYPTED_FILE" \
        -pass pass:"$ENCRYPTION_PASSWORD"; then

        # Remove unencrypted file
        rm "$COMPRESSED_FILE"
        FINAL_FILE="$ENCRYPTED_FILE"
        echo -e "${GREEN}  ✓ Backup encrypted${NC}"
    else
        echo -e "${RED}  ✗ Encryption failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[4/6] Skipping encryption (no password set)${NC}"
    FINAL_FILE="$COMPRESSED_FILE"
fi

echo ""

# ============================================================================
# Upload to S3 (Optional)
# ============================================================================

if [ "$USE_S3" = "true" ] && [ -n "$S3_BUCKET" ]; then
    echo -e "${YELLOW}[5/6] Uploading to S3...${NC}"

    S3_PATH="s3://${S3_BUCKET}/backups/${BACKUP_NAME}.sql.gz$([ -n "$ENCRYPTION_PASSWORD" ] && echo '.enc')"

    if command -v aws &> /dev/null; then
        if aws s3 cp "$FINAL_FILE" "$S3_PATH" --region "$AWS_REGION"; then
            echo -e "${GREEN}  ✓ Uploaded to S3: $S3_PATH${NC}"
        else
            echo -e "${RED}  ✗ S3 upload failed${NC}"
            # Don't exit - local backup is still valid
        fi
    else
        echo -e "${YELLOW}  ⚠ AWS CLI not installed, skipping S3 upload${NC}"
    fi
else
    echo -e "${YELLOW}[5/6] Skipping S3 upload (not configured)${NC}"
fi

echo ""

# ============================================================================
# Cleanup Old Backups
# ============================================================================

echo -e "${YELLOW}[6/6] Cleaning up old backups...${NC}"

# Remove local backups older than retention period
DELETED=0
while IFS= read -r old_backup; do
    rm "$old_backup"
    ((DELETED++))
done < <(find "$BACKUP_DIR" -name "mycelix_backup_*.sql.gz*" -mtime +$RETENTION_DAYS)

if [ $DELETED -gt 0 ]; then
    echo -e "${GREEN}  ✓ Removed $DELETED old backup(s)${NC}"
else
    echo "  No old backups to remove"
fi

# Cleanup S3 old backups
if [ "$USE_S3" = "true" ] && [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    echo "  Cleaning up old S3 backups..."

    # Get current timestamp in seconds
    NOW=$(date +%s)
    RETENTION_SECONDS=$((RETENTION_DAYS * 86400))

    # List and delete old S3 backups
    aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
        BACKUP_DATE=$(echo "$line" | awk '{print $1 " " $2}')
        BACKUP_FILE=$(echo "$line" | awk '{print $4}')

        if [ -n "$BACKUP_DATE" ]; then
            BACKUP_TIMESTAMP=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || echo "0")
            AGE=$((NOW - BACKUP_TIMESTAMP))

            if [ $AGE -gt $RETENTION_SECONDS ]; then
                aws s3 rm "s3://${S3_BUCKET}/backups/${BACKUP_FILE}"
                echo "    Removed: $BACKUP_FILE"
            fi
        fi
    done
fi

echo ""

# ============================================================================
# Verify Backup
# ============================================================================

echo -e "${YELLOW}Verifying backup integrity...${NC}"

if [ -f "$FINAL_FILE" ]; then
    # Test compressed file integrity
    if [[ "$FINAL_FILE" == *.gz.enc ]]; then
        # Decrypt and test
        if openssl enc -aes-256-cbc -d -in "$FINAL_FILE" -pass pass:"$ENCRYPTION_PASSWORD" | gzip -t; then
            echo -e "${GREEN}  ✓ Backup integrity verified${NC}"
        else
            echo -e "${RED}  ✗ Backup integrity check failed${NC}"
            exit 1
        fi
    elif [[ "$FINAL_FILE" == *.gz ]]; then
        if gzip -t "$FINAL_FILE"; then
            echo -e "${GREEN}  ✓ Backup integrity verified${NC}"
        else
            echo -e "${RED}  ✗ Backup integrity check failed${NC}"
            exit 1
        fi
    fi
else
    echo -e "${RED}  ✗ Backup file not found${NC}"
    exit 1
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Backup completed successfully${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Backup Details:"
echo "  File: $FINAL_FILE"
echo "  Size: $(du -h "$FINAL_FILE" | cut -f1)"
echo "  Timestamp: $TIMESTAMP"
echo "  Encrypted: $([ -n "$ENCRYPTION_PASSWORD" ] && echo "Yes" || echo "No")"
echo "  S3 Upload: $([ "$USE_S3" = "true" ] && echo "Yes" || echo "No")"
echo ""
echo "Retention Policy:"
echo "  Local backups: $RETENTION_DAYS days"
echo "  S3 backups: $RETENTION_DAYS days"
echo ""
