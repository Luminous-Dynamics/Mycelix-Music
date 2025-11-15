#!/bin/bash

# ============================================================================
# Mycelix Music - Testnet Deployment Script
# ============================================================================
# This script deploys all contracts to Gnosis Chiado testnet
#
# Usage: ./scripts/deploy-testnet.sh
#
# Prerequisites:
# - PRIVATE_KEY environment variable set
# - Chiado testnet xDAI in deployer wallet (get from faucet)
# ============================================================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🧪 Mycelix Music - Testnet Deployment${NC}"
echo ""

# Configuration
CHIADO_RPC_URL="${CHIADO_RPC_URL:-https://rpc.chiadochain.net}"
CHAIN_ID=10200

# Checks
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ PRIVATE_KEY not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"
echo ""
echo "Network: Gnosis Chiado Testnet"
echo "Chain ID: $CHAIN_ID"
echo "RPC: $CHIADO_RPC_URL"
echo ""

# Build
echo -e "${BLUE}📦 Building contracts...${NC}"
cd contracts
forge build --optimize

# Test
echo -e "${BLUE}🧪 Running tests...${NC}"
forge test -vv

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi

# Deploy
echo -e "${BLUE}🚀 Deploying...${NC}"
DEPLOYMENT_OUTPUT=$(forge script script/DeployTestnet.s.sol \
    --rpc-url $CHIADO_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    -vvv)

# Extract addresses
ROUTER=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'Router deployed at: \K0x[a-fA-F0-9]{40}' | head -1)
TOKEN=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'FlowToken deployed at: \K0x[a-fA-F0-9]{40}' | head -1)

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Deployed addresses:"
echo "  Router:    $ROUTER"
echo "  FlowToken: $TOKEN"
echo ""
echo "Block Explorer:"
echo "  https://gnosis-chiado.blockscout.com/address/$ROUTER"
echo ""
echo "Update your .env.local:"
echo "  NEXT_PUBLIC_ROUTER_ADDRESS=$ROUTER"
echo "  NEXT_PUBLIC_FLOW_TOKEN_ADDRESS=$TOKEN"
echo "  NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID"
echo ""

# Save deployment
DEPLOYMENT_FILE="../deployments/chiado-$(date +%Y%m%d-%H%M%S).json"
mkdir -p ../deployments

cat > "$DEPLOYMENT_FILE" <<EOF
{
  "network": "gnosis-chiado",
  "chainId": $CHAIN_ID,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "FlowToken": "$TOKEN",
    "EconomicStrategyRouter": "$ROUTER"
  }
}
EOF

echo "Saved to: $DEPLOYMENT_FILE"
echo ""
