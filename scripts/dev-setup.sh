#!/bin/bash

# Mycelix Music - Developer Setup Script
# This script helps new developers get started quickly

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Emoji support
CHECK="✓"
CROSS="✗"
ROCKET="🚀"
WRENCH="🔧"

echo ""
echo -e "${CYAN}${ROCKET} Mycelix Music - Developer Setup${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version
check_version() {
    local cmd=$1
    local required=$2
    local current=$($cmd --version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -1)

    if [ "$(printf '%s\n' "$required" "$current" | sort -V | head -n1)" = "$required" ]; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================

echo -e "${CYAN}Step 1: Checking prerequisites...${NC}"

MISSING_DEPS=0

# Check Node.js
if command_exists node; then
    if check_version "node" "20.0.0"; then
        echo -e "${GREEN}${CHECK} Node.js $(node --version) installed${NC}"
    else
        echo -e "${RED}${CROSS} Node.js version too old (need >= 20.0.0)${NC}"
        MISSING_DEPS=1
    fi
else
    echo -e "${RED}${CROSS} Node.js not installed${NC}"
    MISSING_DEPS=1
fi

# Check npm
if command_exists npm; then
    if check_version "npm" "10.0.0"; then
        echo -e "${GREEN}${CHECK} npm $(npm --version) installed${NC}"
    else
        echo -e "${YELLOW}⚠ npm version old (recommended >= 10.0.0)${NC}"
    fi
else
    echo -e "${RED}${CROSS} npm not installed${NC}"
    MISSING_DEPS=1
fi

# Check Git
if command_exists git; then
    echo -e "${GREEN}${CHECK} Git $(git --version) installed${NC}"
else
    echo -e "${RED}${CROSS} Git not installed${NC}"
    MISSING_DEPS=1
fi

# Check Docker (optional but recommended)
if command_exists docker; then
    echo -e "${GREEN}${CHECK} Docker installed${NC}"
    DOCKER_AVAILABLE=1
else
    echo -e "${YELLOW}⚠ Docker not installed (recommended but optional)${NC}"
    DOCKER_AVAILABLE=0
fi

# Check Foundry (for smart contracts)
if command_exists forge; then
    echo -e "${GREEN}${CHECK} Foundry installed${NC}"
else
    echo -e "${YELLOW}⚠ Foundry not installed (will install automatically)${NC}"
    INSTALL_FOUNDRY=1
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}Missing required dependencies. Please install them first:${NC}"
    echo -e "  - Node.js >= 20.0.0: https://nodejs.org/"
    echo -e "  - npm >= 10.0.0: comes with Node.js"
    echo -e "  - Git: https://git-scm.com/"
    echo ""
    exit 1
fi

# =============================================================================
# Step 2: Install Foundry if needed
# =============================================================================

if [ "${INSTALL_FOUNDRY:-0}" -eq 1 ]; then
    echo ""
    echo -e "${CYAN}Step 2: Installing Foundry...${NC}"
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null || true
    foundryup
    echo -e "${GREEN}${CHECK} Foundry installed${NC}"
else
    echo ""
    echo -e "${CYAN}Step 2: Foundry already installed${NC}"
fi

# =============================================================================
# Step 3: Install Dependencies
# =============================================================================

echo ""
echo -e "${CYAN}Step 3: Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}${CHECK} Dependencies installed${NC}"

# =============================================================================
# Step 4: Environment Setup
# =============================================================================

echo ""
echo -e "${CYAN}Step 4: Setting up environment...${NC}"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}${CHECK} Created .env file from template${NC}"
        echo -e "${YELLOW}⚠ Please review .env and update values as needed${NC}"
    else
        echo -e "${YELLOW}⚠ No .env.example found, skipping${NC}"
    fi
else
    echo -e "${GREEN}${CHECK} .env file already exists${NC}"
fi

# =============================================================================
# Step 5: Start Services with Docker
# =============================================================================

if [ $DOCKER_AVAILABLE -eq 1 ]; then
    echo ""
    echo -e "${CYAN}Step 5: Starting Docker services...${NC}"

    # Check if services are already running
    if docker-compose ps | grep -q "Up"; then
        echo -e "${YELLOW}⚠ Services already running${NC}"
        read -p "Do you want to restart them? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down
            docker-compose up -d
        fi
    else
        docker-compose up -d
    fi

    echo -e "${GREEN}${CHECK} Docker services started${NC}"

    # Wait for services to be healthy
    echo -e "${CYAN}Waiting for services to be ready...${NC}"
    sleep 10

    # Check health
    if docker-compose exec -T postgres pg_isready -U mycelix >/dev/null 2>&1; then
        echo -e "${GREEN}${CHECK} PostgreSQL ready${NC}"
    else
        echo -e "${YELLOW}⚠ PostgreSQL not ready yet${NC}"
    fi

    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}${CHECK} Redis ready${NC}"
    else
        echo -e "${YELLOW}⚠ Redis not ready yet${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}Step 5: Docker not available, skipping service startup${NC}"
    echo -e "${YELLOW}You'll need to start PostgreSQL and Redis manually${NC}"
fi

# =============================================================================
# Step 6: Deploy Smart Contracts
# =============================================================================

echo ""
echo -e "${CYAN}Step 6: Deploying smart contracts to local network...${NC}"

# Start Anvil in background if not running
if ! pgrep -f "anvil" > /dev/null; then
    echo -e "${CYAN}Starting Anvil (local blockchain)...${NC}"
    anvil --block-time 1 > /dev/null 2>&1 &
    ANVIL_PID=$!
    sleep 3
    echo -e "${GREEN}${CHECK} Anvil started (PID: $ANVIL_PID)${NC}"
else
    echo -e "${GREEN}${CHECK} Anvil already running${NC}"
fi

# Deploy contracts
if npm run contracts:deploy:local; then
    echo -e "${GREEN}${CHECK} Smart contracts deployed${NC}"
else
    echo -e "${RED}${CROSS} Contract deployment failed${NC}"
    echo -e "${YELLOW}You may need to deploy manually: npm run contracts:deploy:local${NC}"
fi

# =============================================================================
# Step 7: Database Seed (Optional)
# =============================================================================

echo ""
read -p "Do you want to seed the database with test data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}Seeding database...${NC}"
    if npm run db:seed 2>/dev/null; then
        echo -e "${GREEN}${CHECK} Database seeded${NC}"
    else
        echo -e "${YELLOW}⚠ Seeding not available, skipping${NC}"
    fi
fi

# =============================================================================
# Step 8: Install Pre-commit Hooks (Optional)
# =============================================================================

echo ""
if command_exists pre-commit; then
    read -p "Install pre-commit hooks for automatic code quality checks? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pre-commit install
        echo -e "${GREEN}${CHECK} Pre-commit hooks installed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ pre-commit not installed${NC}"
    echo -e "  Install with: pip install pre-commit${NC}"
    echo -e "  Then run: pre-commit install${NC}"
fi

# =============================================================================
# Success!
# =============================================================================

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${ROCKET} Setup Complete! You're ready to develop! ${ROCKET}${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo ""
echo -e "  ${WRENCH} Start development servers:"
echo -e "     ${GREEN}make dev${NC}           - Start all dev servers"
echo -e "     ${GREEN}make dev-api${NC}       - Start only API"
echo -e "     ${GREEN}make dev-web${NC}       - Start only frontend"
echo ""
echo -e "  ${WRENCH} Access the application:"
echo -e "     Frontend:  ${GREEN}http://localhost:3000${NC}"
echo -e "     API:       ${GREEN}http://localhost:3100${NC}"
echo -e "     Health:    ${GREEN}http://localhost:3100/health${NC}"
echo ""
echo -e "  ${WRENCH} Useful commands:"
echo -e "     ${GREEN}make help${NC}          - Show all available commands"
echo -e "     ${GREEN}make test${NC}          - Run all tests"
echo -e "     ${GREEN}make status${NC}        - Check service status"
echo -e "     ${GREEN}make docker-logs${NC}   - View Docker logs"
echo ""
echo -e "  ${WRENCH} Documentation:"
echo -e "     ${GREEN}QUICKSTART.md${NC}         - Quick start guide"
echo -e "     ${GREEN}CONTRIBUTING.md${NC}       - How to contribute"
echo -e "     ${GREEN}API_DOCUMENTATION.md${NC}  - API reference"
echo ""
echo -e "${CYAN}Happy coding! 🎵💜${NC}"
echo ""
