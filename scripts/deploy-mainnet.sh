#!/bin/bash

# ============================================================================
# Mycelix Music - Mainnet Deployment Script
# ============================================================================
# This script deploys all contracts to Gnosis Chain mainnet
#
# Usage: ./scripts/deploy-mainnet.sh
#
# Prerequisites:
# - PRIVATE_KEY environment variable set
# - GNOSIS_RPC_URL environment variable set (optional, uses default)
# - ETHERSCAN_API_KEY environment variable set (for verification)
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Emoji support
INFO="ℹ️"
SUCCESS="✅"
ERROR="❌"
WARNING="⚠️"
ROCKET="🚀"

echo ""
echo -e "${BLUE}${ROCKET} Mycelix Music - Mainnet Deployment${NC}"
echo ""

# ============================================================================
# Step 1: Pre-flight Checks
# ============================================================================

echo -e "${BLUE}${INFO} Step 1: Pre-flight checks...${NC}"
echo ""

# Check if required environment variables are set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}${ERROR} PRIVATE_KEY environment variable is not set${NC}"
    echo "Please set PRIVATE_KEY=your_private_key"
    exit 1
fi

if [ -z "$GNOSIS_RPC_URL" ]; then
    echo -e "${YELLOW}${WARNING} GNOSIS_RPC_URL not set, using default${NC}"
    GNOSIS_RPC_URL="https://rpc.gnosischain.com"
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo -e "${YELLOW}${WARNING} ETHERSCAN_API_KEY not set, contract verification will be skipped${NC}"
    VERIFY_CONTRACTS=false
else
    VERIFY_CONTRACTS=true
fi

# Check if foundry is installed
if ! command -v forge &> /dev/null; then
    echo -e "${RED}${ERROR} Foundry not installed${NC}"
    echo "Please install Foundry: curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

echo -e "${GREEN}${SUCCESS} Pre-flight checks passed${NC}"
echo ""

# ============================================================================
# Step 2: Confirm Deployment
# ============================================================================

echo -e "${YELLOW}${WARNING} You are about to deploy to MAINNET${NC}"
echo ""
echo "Network: Gnosis Chain (Chain ID: 100)"
echo "RPC URL: $GNOSIS_RPC_URL"
echo ""
echo "Contracts to deploy:"
echo "  1. FlowToken (ERC20)"
echo "  2. EconomicStrategyRouter"
echo "  3. PayPerStreamStrategy"
echo "  4. GiftEconomyStrategy"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

echo ""

# ============================================================================
# Step 3: Build Contracts
# ============================================================================

echo -e "${BLUE}${INFO} Step 3: Building contracts...${NC}"
echo ""

cd contracts

# Clean previous builds
forge clean

# Build with optimizations
forge build --optimize --optimizer-runs 200

if [ $? -ne 0 ]; then
    echo -e "${RED}${ERROR} Contract build failed${NC}"
    exit 1
fi

echo -e "${GREEN}${SUCCESS} Contracts built successfully${NC}"
echo ""

# ============================================================================
# Step 4: Run Tests
# ============================================================================

echo -e "${BLUE}${INFO} Step 4: Running tests...${NC}"
echo ""

forge test -vv

if [ $? -ne 0 ]; then
    echo -e "${RED}${ERROR} Tests failed${NC}"
    echo "Please fix failing tests before deploying to mainnet"
    exit 1
fi

echo -e "${GREEN}${SUCCESS} All tests passed${NC}"
echo ""

# ============================================================================
# Step 5: Deploy Contracts
# ============================================================================

echo -e "${BLUE}${INFO} Step 5: Deploying contracts...${NC}"
echo ""

# Deploy using Forge script
DEPLOYMENT_OUTPUT=$(forge script script/DeployMainnet.s.sol \
    --rpc-url $GNOSIS_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --slow \
    -vvv)

if [ $? -ne 0 ]; then
    echo -e "${RED}${ERROR} Deployment failed${NC}"
    echo "$DEPLOYMENT_OUTPUT"
    exit 1
fi

echo -e "${GREEN}${SUCCESS} Contracts deployed successfully${NC}"
echo ""

# Extract deployed addresses from output
ROUTER_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'Router deployed at: \K0x[a-fA-F0-9]{40}' | head -1)
FLOW_TOKEN_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'FlowToken deployed at: \K0x[a-fA-F0-9]{40}' | head -1)
PPS_STRATEGY_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'PayPerStreamStrategy deployed at: \K0x[a-fA-F0-9]{40}' | head -1)
GE_STRATEGY_ADDRESS=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'GiftEconomyStrategy deployed at: \K0x[a-fA-F0-9]{40}' | head -1)

echo -e "${GREEN}Deployed Contract Addresses:${NC}"
echo ""
echo "  FlowToken:              $FLOW_TOKEN_ADDRESS"
echo "  Router:                 $ROUTER_ADDRESS"
echo "  PayPerStreamStrategy:   $PPS_STRATEGY_ADDRESS"
echo "  GiftEconomyStrategy:    $GE_STRATEGY_ADDRESS"
echo ""

# Save addresses to file
DEPLOYMENT_FILE="../deployments/mainnet-$(date +%Y%m%d-%H%M%S).json"
mkdir -p ../deployments

cat > "$DEPLOYMENT_FILE" <<EOF
{
  "network": "gnosis-mainnet",
  "chainId": 100,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "FlowToken": "$FLOW_TOKEN_ADDRESS",
    "EconomicStrategyRouter": "$ROUTER_ADDRESS",
    "PayPerStreamStrategy": "$PPS_STRATEGY_ADDRESS",
    "GiftEconomyStrategy": "$GE_STRATEGY_ADDRESS"
  }
}
EOF

echo -e "${GREEN}${SUCCESS} Deployment info saved to: $DEPLOYMENT_FILE${NC}"
echo ""

# ============================================================================
# Step 6: Verify Contracts (Optional)
# ============================================================================

if [ "$VERIFY_CONTRACTS" = true ]; then
    echo -e "${BLUE}${INFO} Step 6: Verifying contracts...${NC}"
    echo ""

    # Verify FlowToken
    echo "Verifying FlowToken..."
    forge verify-contract \
        $FLOW_TOKEN_ADDRESS \
        src/FlowToken.sol:FlowToken \
        --chain-id 100 \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        || echo -e "${YELLOW}${WARNING} FlowToken verification failed (may already be verified)${NC}"

    # Verify Router
    echo "Verifying EconomicStrategyRouter..."
    forge verify-contract \
        $ROUTER_ADDRESS \
        src/EconomicStrategyRouter.sol:EconomicStrategyRouter \
        --chain-id 100 \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        --constructor-args $(cast abi-encode "constructor(address,address)" $FLOW_TOKEN_ADDRESS $ROUTER_ADDRESS) \
        || echo -e "${YELLOW}${WARNING} Router verification failed (may already be verified)${NC}"

    echo -e "${GREEN}${SUCCESS} Contract verification complete${NC}"
    echo ""
else
    echo -e "${YELLOW}${WARNING} Step 6: Skipping contract verification (no API key)${NC}"
    echo ""
fi

# ============================================================================
# Step 7: Post-Deployment Validation
# ============================================================================

echo -e "${BLUE}${INFO} Step 7: Post-deployment validation...${NC}"
echo ""

# Call a view function to ensure deployment worked
OWNER=$(cast call $ROUTER_ADDRESS "owner()" --rpc-url $GNOSIS_RPC_URL)

if [ -z "$OWNER" ]; then
    echo -e "${RED}${ERROR} Post-deployment validation failed${NC}"
    echo "Could not read owner from deployed contract"
    exit 1
fi

echo -e "${GREEN}${SUCCESS} Post-deployment validation passed${NC}"
echo "  Router owner: $OWNER"
echo ""

# ============================================================================
# Step 8: Update Environment Variables
# ============================================================================

echo -e "${BLUE}${INFO} Step 8: Environment variable updates...${NC}"
echo ""

echo "Add these to your .env file:"
echo ""
echo "NEXT_PUBLIC_ROUTER_ADDRESS=$ROUTER_ADDRESS"
echo "NEXT_PUBLIC_FLOW_TOKEN_ADDRESS=$FLOW_TOKEN_ADDRESS"
echo "NEXT_PUBLIC_CHAIN_ID=100"
echo "NEXT_PUBLIC_RPC_URL=$GNOSIS_RPC_URL"
echo ""

# ============================================================================
# Deployment Complete
# ============================================================================

echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${SUCCESS} Mainnet Deployment Complete! ${SUCCESS}${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Update .env with contract addresses (shown above)"
echo "2. Verify contracts on block explorer:"
echo "   https://gnosisscan.io/address/$ROUTER_ADDRESS"
echo "3. Transfer ownership to multi-sig (if applicable)"
echo "4. Update frontend configuration"
echo "5. Deploy backend API with new addresses"
echo "6. Run smoke tests"
echo "7. Monitor for any issues"
echo ""
echo "Deployment info: $DEPLOYMENT_FILE"
echo ""
echo -e "${BLUE}${ROCKET} Happy launching! ${ROCKET}${NC}"
echo ""
