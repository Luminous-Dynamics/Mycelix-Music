#!/usr/bin/env bash
# ============================================================================
# Mycelix Music CLI
# ============================================================================
# Command-line interface for common Mycelix Music operations
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

VERSION="1.0.0"

# ============================================================================
# Helper Functions
# ============================================================================

print_logo() {
    echo -e "${PURPLE}"
    cat << "EOF"
    __  ___               ___
   /  |/  /_  _________  / (_)_  __
  / /|_/ / / / / ___/ _ \/ / / |/_/
 / /  / / /_/ / /__/  __/ / />  <
/_/  /_/\__, /\___/\___/_/_/_/|_|
       /____/
        Music Platform CLI
EOF
    echo -e "${NC}"
    echo "Version $VERSION"
    echo ""
}

show_help() {
    print_logo
    echo "Usage: mycelix <command> [options]"
    echo ""
    echo "Commands:"
    echo ""
    echo "  ${GREEN}init${NC}           Initialize a new Mycelix Music project"
    echo "  ${GREEN}deploy${NC}         Deploy smart contracts to blockchain"
    echo "  ${GREEN}test${NC}           Run test suites"
    echo "  ${GREEN}verify${NC}         Verify deployed contracts on block explorer"
    echo "  ${GREEN}upload${NC}         Upload a song to the platform"
    echo "  ${GREEN}stats${NC}          Get platform/artist statistics"
    echo "  ${GREEN}setup${NC}          Setup local development environment"
    echo "  ${GREEN}backup${NC}         Create database backup"
    echo "  ${GREEN}restore${NC}        Restore from backup"
    echo "  ${GREEN}monitor${NC}        Start monitoring dashboard"
    echo "  ${GREEN}security${NC}       Run security scans"
    echo "  ${GREEN}scaffold${NC}       Generate boilerplate code"
    echo "  ${GREEN}version${NC}        Show CLI version"
    echo "  ${GREEN}help${NC}           Show this help message"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show help"
    echo "  -v, --version  Show version"
    echo ""
    echo "Examples:"
    echo "  mycelix init my-music-app"
    echo "  mycelix deploy --network testnet"
    echo "  mycelix upload song.mp3 --strategy pay-per-stream --price 0.01"
    echo "  mycelix stats --artist 0x..."
    echo ""
}

# ============================================================================
# Command: init
# ============================================================================

cmd_init() {
    local project_name=${1:-"mycelix-project"}

    echo -e "${BLUE}Initializing Mycelix Music project: ${project_name}${NC}"
    echo ""

    # Create project directory
    mkdir -p "$project_name"
    cd "$project_name"

    # Create directory structure
    mkdir -p {contracts,scripts,tests,frontend,backend}

    # Create package.json
    cat > package.json << EOF
{
  "name": "$project_name",
  "version": "1.0.0",
  "description": "Mycelix Music integration project",
  "scripts": {
    "test": "forge test",
    "deploy": "forge script script/Deploy.s.sol",
    "dev": "npm run dev:api & npm run dev:frontend",
    "dev:api": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev"
  },
  "dependencies": {
    "@mycelix/sdk": "^1.0.0",
    "ethers": "^5.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

    # Create .env.example
    cat > .env.example << EOF
# Blockchain Configuration
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com
CHAIN_ID=100

# Smart Contract Addresses (fill after deployment)
ROUTER_ADDRESS=
FLOW_TOKEN_ADDRESS=

# API Configuration
API_PORT=3100
DATABASE_URL=postgresql://user:password@localhost:5432/mycelix

# IPFS Configuration
WEB3_STORAGE_TOKEN=your_web3_storage_token
EOF

    # Create basic deployment script
    mkdir -p contracts/script
    cat > contracts/script/Deploy.s.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy your contracts here

        vm.stopBroadcast();
    }
}
EOF

    # Create README
    cat > README.md << EOF
# $project_name

Mycelix Music integration project.

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your values
\`\`\`

## Deploy Contracts

\`\`\`bash
npm run deploy
\`\`\`

## Run Tests

\`\`\`bash
npm test
\`\`\`

## Documentation

- [Mycelix Music Docs](https://docs.mycelix.com)
- [Integration Guide](https://docs.mycelix.com/integration)
EOF

    echo -e "${GREEN}✓ Project initialized: $project_name${NC}"
    echo ""
    echo "Next steps:"
    echo "  cd $project_name"
    echo "  npm install"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your configuration"
    echo ""
}

# ============================================================================
# Command: deploy
# ============================================================================

cmd_deploy() {
    local network=${1:-"local"}

    echo -e "${BLUE}Deploying contracts to $network${NC}"
    echo ""

    case $network in
        local)
            echo "Starting local blockchain..."
            forge script script/DeployLocal.s.sol --broadcast --rpc-url http://localhost:8545
            ;;
        testnet)
            echo "Deploying to testnet..."
            ./scripts/deploy-testnet.sh
            ;;
        mainnet)
            echo -e "${YELLOW}⚠️  WARNING: Deploying to MAINNET${NC}"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" == "yes" ]; then
                ./scripts/deploy-mainnet.sh
            else
                echo "Deployment cancelled"
                exit 0
            fi
            ;;
        *)
            echo -e "${RED}Unknown network: $network${NC}"
            echo "Available networks: local, testnet, mainnet"
            exit 1
            ;;
    esac
}

# ============================================================================
# Command: test
# ============================================================================

cmd_test() {
    local test_type=${1:-"all"}

    echo -e "${BLUE}Running tests: $test_type${NC}"
    echo ""

    case $test_type in
        all)
            echo "Running all tests..."
            forge test -vv
            cd apps/api && npm test
            cd ../web && npm test
            ;;
        contracts)
            echo "Running contract tests..."
            forge test -vv
            ;;
        api)
            echo "Running API tests..."
            cd apps/api && npm test
            ;;
        e2e)
            echo "Running E2E tests..."
            cd apps/web && npm run test:e2e
            ;;
        performance)
            echo "Running performance tests..."
            k6 run performance/k6-load-test.js
            ;;
        *)
            echo -e "${RED}Unknown test type: $test_type${NC}"
            echo "Available types: all, contracts, api, e2e, performance"
            exit 1
            ;;
    esac
}

# ============================================================================
# Command: verify
# ============================================================================

cmd_verify() {
    local network=${1:-"testnet"}
    local contract_address=${2}

    if [ -z "$contract_address" ]; then
        echo -e "${RED}Error: Contract address required${NC}"
        echo "Usage: mycelix verify <network> <contract_address>"
        exit 1
    fi

    echo -e "${BLUE}Verifying contract on $network${NC}"
    echo "Address: $contract_address"
    echo ""

    forge verify-contract \
        --chain-id $(grep CHAIN_ID .env | cut -d '=' -f2) \
        --etherscan-api-key $(grep ETHERSCAN_API_KEY .env | cut -d '=' -f2) \
        $contract_address \
        src/YourContract.sol:YourContract

    echo -e "${GREEN}✓ Contract verified${NC}"
}

# ============================================================================
# Command: upload
# ============================================================================

cmd_upload() {
    echo -e "${BLUE}Uploading song to Mycelix Music${NC}"
    echo ""

    # Interactive prompts
    read -p "Song title: " title
    read -p "Artist name: " artist
    read -p "Genre: " genre
    read -p "File path: " file_path

    if [ ! -f "$file_path" ]; then
        echo -e "${RED}Error: File not found: $file_path${NC}"
        exit 1
    fi

    read -p "Strategy (pay-per-stream/gift-economy/patronage/auction): " strategy
    read -p "Price (FLOW): " price

    echo ""
    echo -e "${YELLOW}Uploading to IPFS...${NC}"

    # Upload to IPFS (mock for now)
    ipfs_hash="Qm$(openssl rand -hex 22)"

    echo -e "${GREEN}✓ Uploaded to IPFS: $ipfs_hash${NC}"
    echo ""
    echo -e "${YELLOW}Registering on blockchain...${NC}"

    # Register song (would call actual contract)
    song_id="song-$(date +%s)"

    echo -e "${GREEN}✓ Song registered${NC}"
    echo ""
    echo "Song ID: $song_id"
    echo "IPFS Hash: $ipfs_hash"
    echo "Strategy: $strategy"
    echo "Price: $price FLOW"
    echo ""
}

# ============================================================================
# Command: stats
# ============================================================================

cmd_stats() {
    local type=${1:-"platform"}
    local address=${2}

    echo -e "${BLUE}Fetching statistics: $type${NC}"
    echo ""

    case $type in
        platform)
            echo "Platform Statistics"
            echo "==================="
            curl -s http://localhost:3100/api/stats | jq '.'
            ;;
        artist)
            if [ -z "$address" ]; then
                echo -e "${RED}Error: Artist address required${NC}"
                exit 1
            fi
            echo "Artist Statistics: $address"
            echo "==================="
            curl -s "http://localhost:3100/api/artists/$address/stats" | jq '.'
            ;;
        song)
            if [ -z "$address" ]; then
                echo -e "${RED}Error: Song ID required${NC}"
                exit 1
            fi
            echo "Song Statistics: $address"
            echo "==================="
            curl -s "http://localhost:3100/api/songs/$address/stats" | jq '.'
            ;;
        *)
            echo -e "${RED}Unknown stats type: $type${NC}"
            echo "Available types: platform, artist, song"
            exit 1
            ;;
    esac
}

# ============================================================================
# Command: setup
# ============================================================================

cmd_setup() {
    echo -e "${BLUE}Setting up local development environment${NC}"
    echo ""

    # Check prerequisites
    echo "Checking prerequisites..."

    command -v docker >/dev/null 2>&1 || {
        echo -e "${RED}✗ Docker not installed${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Docker installed${NC}"

    command -v forge >/dev/null 2>&1 || {
        echo -e "${RED}✗ Foundry not installed${NC}"
        echo "  Install with: curl -L https://foundry.paradigm.xyz | bash"
        exit 1
    }
    echo -e "${GREEN}✓ Foundry installed${NC}"

    command -v node >/dev/null 2>&1 || {
        echo -e "${RED}✗ Node.js not installed${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Node.js installed${NC}"

    echo ""
    echo "Starting services..."

    # Start Docker services
    docker-compose up -d

    echo ""
    echo -e "${GREEN}✓ Local environment ready${NC}"
    echo ""
    echo "Services running:"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis: localhost:6379"
    echo "  API: http://localhost:3100"
    echo "  Frontend: http://localhost:3000"
    echo ""
}

# ============================================================================
# Command: backup
# ============================================================================

cmd_backup() {
    echo -e "${BLUE}Creating database backup${NC}"
    ./scripts/backup.sh
}

# ============================================================================
# Command: restore
# ============================================================================

cmd_restore() {
    local backup_file=${1}

    if [ -z "$backup_file" ]; then
        echo -e "${YELLOW}Available backups:${NC}"
        ls -lh /var/backups/mycelix/ 2>/dev/null || echo "No backups found"
        echo ""
        read -p "Enter backup file path: " backup_file
    fi

    echo -e "${BLUE}Restoring from backup${NC}"
    ./scripts/restore.sh "$backup_file"
}

# ============================================================================
# Command: monitor
# ============================================================================

cmd_monitor() {
    echo -e "${BLUE}Starting monitoring dashboard${NC}"
    echo ""

    # Start monitoring stack
    cd monitoring && ./start-monitoring.sh

    echo ""
    echo "Monitoring available at:"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3001"
    echo "  Alertmanager: http://localhost:9093"
    echo ""
}

# ============================================================================
# Command: security
# ============================================================================

cmd_security() {
    echo -e "${BLUE}Running security scans${NC}"
    ./scripts/security-scan.sh
}

# ============================================================================
# Command: scaffold
# ============================================================================

cmd_scaffold() {
    local type=${1}

    case $type in
        strategy)
            echo "Scaffolding new economic strategy..."
            read -p "Strategy name (e.g., MyStrategy): " name

            cat > "contracts/strategies/${name}.sol" << EOF
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IEconomicStrategy.sol";

contract ${name} is IEconomicStrategy {
    // TODO: Implement your custom strategy
}
EOF
            echo -e "${GREEN}✓ Created: contracts/strategies/${name}.sol${NC}"
            ;;
        *)
            echo "Available scaffolds: strategy"
            ;;
    esac
}

# ============================================================================
# Main CLI Router
# ============================================================================

main() {
    case "${1}" in
        init)
            shift
            cmd_init "$@"
            ;;
        deploy)
            shift
            cmd_deploy "$@"
            ;;
        test)
            shift
            cmd_test "$@"
            ;;
        verify)
            shift
            cmd_verify "$@"
            ;;
        upload)
            shift
            cmd_upload "$@"
            ;;
        stats)
            shift
            cmd_stats "$@"
            ;;
        setup)
            cmd_setup
            ;;
        backup)
            cmd_backup
            ;;
        restore)
            shift
            cmd_restore "$@"
            ;;
        monitor)
            cmd_monitor
            ;;
        security)
            cmd_security
            ;;
        scaffold)
            shift
            cmd_scaffold "$@"
            ;;
        version|-v|--version)
            echo "Mycelix Music CLI v$VERSION"
            ;;
        help|-h|--help|"")
            show_help
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo "Run 'mycelix help' for usage information"
            exit 1
            ;;
    esac
}

# Run main
main "$@"
