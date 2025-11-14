#!/bin/bash

# Example 1: Upload a Song via API
# This script demonstrates how to upload a song using the REST API

set -e

API_URL="${API_URL:-http://localhost:3100}"

echo "🎵 Mycelix API Example: Upload a Song"
echo ""

# =============================================================================
# 1. Prepare Song Data
# =============================================================================

SONG_DATA=$(cat <<EOF
{
  "song_id": "0x$(openssl rand -hex 32)",
  "title": "Blockchain Beats",
  "artist_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "artist_name": "DJ Satoshi",
  "album": "Decentralized Music Vol. 1",
  "genre": "Electronic",
  "duration": 180,
  "ipfs_hash": "QmExample123456789",
  "cover_art_url": "https://ipfs.io/ipfs/QmCoverArt",
  "payment_model": "pay-per-stream",
  "price_per_stream": "0.01",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

echo "📝 Song Data:"
echo "$SONG_DATA" | jq .
echo ""

# =============================================================================
# 2. Upload to API
# =============================================================================

echo "🚀 Uploading to API..."
echo ""

RESPONSE=$(curl -s -X POST \
  "$API_URL/api/songs" \
  -H "Content-Type: application/json" \
  -d "$SONG_DATA")

# Check for errors
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ Upload failed:"
  echo "$RESPONSE" | jq .
  exit 1
fi

echo "✅ Upload successful!"
echo ""
echo "Response:"
echo "$RESPONSE" | jq .

# Extract song ID
SONG_ID=$(echo "$RESPONSE" | jq -r '.song_id')

echo ""
echo "📍 Song ID: $SONG_ID"

# =============================================================================
# 3. Verify Upload
# =============================================================================

echo ""
echo "🔍 Verifying upload..."
echo ""

VERIFY_RESPONSE=$(curl -s "$API_URL/api/songs/$SONG_ID")

echo "Song Details:"
echo "$VERIFY_RESPONSE" | jq .

echo ""
echo "✅ Verification complete!"
echo ""
echo "🎉 Song successfully uploaded and verified!"
echo ""
echo "📌 You can now access this song at:"
echo "   $API_URL/api/songs/$SONG_ID"
