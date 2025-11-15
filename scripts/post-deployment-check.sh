#!/bin/bash
# ============================================================================
# Post-Deployment Verification Script
# ============================================================================
# Comprehensive checks after deployment to ensure all systems are operational
# Run this after deploying to any environment (testnet/mainnet)
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-"testnet"}
API_URL=${API_URL:-"http://localhost:3100"}
WEB_URL=${WEB_URL:-"http://localhost:3000"}
MAX_RETRIES=5
RETRY_DELAY=3

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Post-Deployment Verification - ${ENVIRONMENT}${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Track overall status
FAILURES=0

# ============================================================================
# Helper Functions
# ============================================================================

check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    echo -n "  Checking $name... "

    for i in $(seq 1 $MAX_RETRIES); do
        if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
            if [ "$response" -eq "$expected_status" ]; then
                echo -e "${GREEN}✓${NC} (HTTP $response)"
                return 0
            fi
        fi

        if [ $i -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done

    echo -e "${RED}✗${NC} (Failed after $MAX_RETRIES attempts)"
    ((FAILURES++))
    return 1
}

check_contract() {
    local name=$1
    local address=$2

    echo -n "  Checking contract $name at $address... "

    # Use cast to check if contract exists
    if cast code "$address" --rpc-url "$RPC_URL" | grep -q "0x"; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} (No code at address)"
        ((FAILURES++))
        return 1
    fi
}

test_api_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local expected_status=${3:-200}

    echo -n "  Testing $method $endpoint... "

    response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_URL$endpoint" 2>/dev/null)

    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} (HTTP $response, expected $expected_status)"
        ((FAILURES++))
        return 1
    fi
}

# ============================================================================
# 1. Infrastructure Health Checks
# ============================================================================

echo -e "${YELLOW}[1/7] Infrastructure Health Checks${NC}"

# Check PostgreSQL
if [ -n "$DATABASE_URL" ]; then
    echo -n "  Checking PostgreSQL... "
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((FAILURES++))
    fi
fi

# Check Redis
if [ -n "$REDIS_URL" ]; then
    echo -n "  Checking Redis... "
    if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((FAILURES++))
    fi
fi

# Check RPC endpoint
if [ -n "$RPC_URL" ]; then
    echo -n "  Checking RPC endpoint... "
    if cast block-number --rpc-url "$RPC_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((FAILURES++))
    fi
fi

echo ""

# ============================================================================
# 2. Service Health Checks
# ============================================================================

echo -e "${YELLOW}[2/7] Service Health Checks${NC}"

check_service "API Health" "$API_URL/health" 200
check_service "API Metrics" "$API_URL/metrics" 200
check_service "Frontend" "$WEB_URL" 200

echo ""

# ============================================================================
# 3. Smart Contract Verification
# ============================================================================

echo -e "${YELLOW}[3/7] Smart Contract Verification${NC}"

if [ -n "$ROUTER_ADDRESS" ]; then
    check_contract "EconomicStrategyRouter" "$ROUTER_ADDRESS"
fi

if [ -n "$FLOW_TOKEN_ADDRESS" ]; then
    check_contract "FlowToken" "$FLOW_TOKEN_ADDRESS"
fi

# Check if router is properly initialized
if [ -n "$ROUTER_ADDRESS" ]; then
    echo -n "  Checking router initialization... "
    if owner=$(cast call "$ROUTER_ADDRESS" "owner()" --rpc-url "$RPC_URL" 2>/dev/null); then
        if [ "$owner" != "0x0000000000000000000000000000000000000000" ]; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC} (Owner is zero address)"
            ((FAILURES++))
        fi
    else
        echo -e "${RED}✗${NC} (Cannot read owner)"
        ((FAILURES++))
    fi
fi

echo ""

# ============================================================================
# 4. API Endpoint Testing
# ============================================================================

echo -e "${YELLOW}[4/7] API Endpoint Testing${NC}"

test_api_endpoint "/health" "GET" 200
test_api_endpoint "/api/songs" "GET" 200
test_api_endpoint "/api/artists" "GET" 200
test_api_endpoint "/api/stats" "GET" 200

echo ""

# ============================================================================
# 5. Database Schema Verification
# ============================================================================

echo -e "${YELLOW}[5/7] Database Schema Verification${NC}"

if [ -n "$DATABASE_URL" ]; then
    # Check required tables exist
    required_tables=("songs" "plays" "artists" "artist_stats" "song_stats" "migrations")

    for table in "${required_tables[@]}"; do
        echo -n "  Checking table '$table'... "
        if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table'" | grep -q 1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
            ((FAILURES++))
        fi
    done

    # Check indexes exist
    echo -n "  Checking indexes... "
    index_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public'" | tr -d ' ')
    if [ "$index_count" -gt 10 ]; then
        echo -e "${GREEN}✓${NC} ($index_count indexes)"
    else
        echo -e "${YELLOW}⚠${NC} (Only $index_count indexes found)"
    fi

    # Check triggers exist
    echo -n "  Checking triggers... "
    trigger_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='public'" | tr -d ' ')
    if [ "$trigger_count" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} ($trigger_count triggers)"
    else
        echo -e "${YELLOW}⚠${NC} (No triggers found)"
    fi
fi

echo ""

# ============================================================================
# 6. Monitoring & Observability
# ============================================================================

echo -e "${YELLOW}[6/7] Monitoring & Observability${NC}"

# Check Prometheus
if [ -n "$PROMETHEUS_URL" ]; then
    check_service "Prometheus" "$PROMETHEUS_URL" 200
    check_service "Prometheus Targets" "$PROMETHEUS_URL/api/v1/targets" 200
fi

# Check Grafana
if [ -n "$GRAFANA_URL" ]; then
    check_service "Grafana" "$GRAFANA_URL" 200
fi

# Verify metrics are being collected
echo -n "  Checking API metrics collection... "
if metrics=$(curl -s "$API_URL/metrics" 2>/dev/null); then
    if echo "$metrics" | grep -q "http_requests_total"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC} (No http_requests_total metric)"
    fi
else
    echo -e "${RED}✗${NC}"
    ((FAILURES++))
fi

echo ""

# ============================================================================
# 7. Performance & Load Testing
# ============================================================================

echo -e "${YELLOW}[7/7] Performance Baseline${NC}"

# Quick response time check
echo -n "  Checking API response time... "
start_time=$(date +%s%N)
curl -s "$API_URL/health" > /dev/null 2>&1
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ $response_time -lt 100 ]; then
    echo -e "${GREEN}✓${NC} (${response_time}ms)"
elif [ $response_time -lt 500 ]; then
    echo -e "${YELLOW}⚠${NC} (${response_time}ms - acceptable)"
else
    echo -e "${RED}✗${NC} (${response_time}ms - slow)"
    ((FAILURES++))
fi

# Database query performance
if [ -n "$DATABASE_URL" ]; then
    echo -n "  Checking database query performance... "
    start_time=$(date +%s%N)
    psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM songs" > /dev/null 2>&1
    end_time=$(date +%s%N)
    query_time=$(( (end_time - start_time) / 1000000 ))

    if [ $query_time -lt 50 ]; then
        echo -e "${GREEN}✓${NC} (${query_time}ms)"
    elif [ $query_time -lt 200 ]; then
        echo -e "${YELLOW}⚠${NC} (${query_time}ms - acceptable)"
    else
        echo -e "${RED}✗${NC} (${query_time}ms - slow)"
    fi
fi

echo ""

# ============================================================================
# Final Summary
# ============================================================================

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Deployment verified successfully.${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}✗ Deployment verification failed with $FAILURES error(s).${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
