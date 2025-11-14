.PHONY: help install dev build test clean docker-up docker-down docker-logs docker-rebuild setup deploy

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(CYAN)Mycelix Music - Development Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# =============================================================================
# Installation & Setup
# =============================================================================

install: ## Install all dependencies
	@echo "$(CYAN)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

setup: install ## Complete local setup (install deps, start services, deploy contracts)
	@echo "$(CYAN)Setting up Mycelix Music...$(NC)"
	@make docker-up
	@sleep 10
	@make contracts-deploy-local
	@make db-seed
	@echo "$(GREEN)✓ Setup complete! Run 'make dev' to start development servers$(NC)"

# =============================================================================
# Development
# =============================================================================

dev: ## Start all development servers (requires setup first)
	@echo "$(CYAN)Starting development servers...$(NC)"
	npm run dev

dev-api: ## Start only the API server
	npm run dev --workspace=apps/api

dev-web: ## Start only the frontend server
	npm run dev --workspace=apps/web

dev-contracts: ## Start Anvil local blockchain
	cd contracts && anvil --block-time 1

# =============================================================================
# Docker Commands
# =============================================================================

docker-up: ## Start all Docker services
	@echo "$(CYAN)Starting Docker services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@make docker-ps

docker-up-dev: ## Start Docker services with development overrides
	@echo "$(CYAN)Starting Docker services (development mode)...$(NC)"
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "$(GREEN)✓ Services started in development mode$(NC)"
	@make docker-ps

docker-down: ## Stop all Docker services
	@echo "$(YELLOW)Stopping Docker services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

docker-down-volumes: ## Stop all Docker services and remove volumes
	@echo "$(RED)Stopping Docker services and removing volumes...$(NC)"
	docker-compose down -v
	@echo "$(GREEN)✓ Services stopped and volumes removed$(NC)"

docker-logs: ## View logs from all services
	docker-compose logs -f

docker-logs-api: ## View API logs
	docker-compose logs -f api

docker-logs-web: ## View frontend logs
	docker-compose logs -f web

docker-ps: ## Show status of Docker services
	@docker-compose ps

docker-rebuild: ## Rebuild Docker images
	@echo "$(CYAN)Rebuilding Docker images...$(NC)"
	docker-compose build --no-cache
	@echo "$(GREEN)✓ Images rebuilt$(NC)"

docker-clean: ## Remove all Docker containers, images, and volumes
	@echo "$(RED)Cleaning Docker resources...$(NC)"
	docker-compose down -v --rmi all
	@echo "$(GREEN)✓ Docker resources cleaned$(NC)"

# =============================================================================
# Database
# =============================================================================

db-connect: ## Connect to PostgreSQL database
	docker-compose exec postgres psql -U mycelix -d mycelix_music

db-seed: ## Seed database with test data
	@echo "$(CYAN)Seeding database...$(NC)"
	npm run db:seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

db-reset: ## Reset database (drop and recreate)
	@echo "$(YELLOW)Resetting database...$(NC)"
	docker-compose exec postgres psql -U mycelix -d postgres -c "DROP DATABASE IF EXISTS mycelix_music;"
	docker-compose exec postgres psql -U mycelix -d postgres -c "CREATE DATABASE mycelix_music;"
	@echo "$(GREEN)✓ Database reset$(NC)"

db-backup: ## Backup database to file
	@echo "$(CYAN)Backing up database...$(NC)"
	docker-compose exec -T postgres pg_dump -U mycelix mycelix_music > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up$(NC)"

# =============================================================================
# Smart Contracts
# =============================================================================

contracts-build: ## Build smart contracts
	@echo "$(CYAN)Building contracts...$(NC)"
	cd contracts && forge build
	@echo "$(GREEN)✓ Contracts built$(NC)"

contracts-test: ## Run smart contract tests
	@echo "$(CYAN)Running contract tests...$(NC)"
	cd contracts && forge test -vvv
	@echo "$(GREEN)✓ Tests passed$(NC)"

contracts-coverage: ## Generate test coverage report
	@echo "$(CYAN)Generating coverage report...$(NC)"
	cd contracts && forge coverage
	@echo "$(GREEN)✓ Coverage report generated$(NC)"

contracts-deploy-local: ## Deploy contracts to local Anvil
	@echo "$(CYAN)Deploying contracts to local network...$(NC)"
	npm run contracts:deploy:local
	@echo "$(GREEN)✓ Contracts deployed$(NC)"

contracts-deploy-testnet: ## Deploy contracts to testnet
	@echo "$(CYAN)Deploying contracts to testnet...$(NC)"
	npm run contracts:deploy:testnet
	@echo "$(GREEN)✓ Contracts deployed to testnet$(NC)"

contracts-verify: ## Verify contracts on block explorer
	@echo "$(CYAN)Verifying contracts...$(NC)"
	npm run contracts:verify
	@echo "$(GREEN)✓ Contracts verified$(NC)"

# =============================================================================
# Testing
# =============================================================================

test: ## Run all tests
	@echo "$(CYAN)Running all tests...$(NC)"
	npm test
	@echo "$(GREEN)✓ All tests passed$(NC)"

test-contracts: contracts-test ## Run smart contract tests (alias)

test-sdk: ## Run SDK tests
	npm run test --workspace=packages/sdk

test-api: ## Run API tests
	npm run test --workspace=apps/api

test-web: ## Run frontend tests
	npm run test --workspace=apps/web

test-e2e: ## Run end-to-end tests
	npm run test:e2e

# =============================================================================
# Build
# =============================================================================

build: ## Build all packages
	@echo "$(CYAN)Building all packages...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Build complete$(NC)"

build-sdk: ## Build SDK package
	npm run build --workspace=packages/sdk

build-api: ## Build API
	npm run build --workspace=apps/api

build-web: ## Build frontend
	npm run build --workspace=apps/web

# =============================================================================
# Linting & Formatting
# =============================================================================

lint: ## Run linters
	@echo "$(CYAN)Running linters...$(NC)"
	npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

lint-fix: ## Run linters with auto-fix
	@echo "$(CYAN)Running linters with auto-fix...$(NC)"
	npm run lint -- --fix
	@echo "$(GREEN)✓ Linting complete$(NC)"

format: ## Format code with Prettier
	@echo "$(CYAN)Formatting code...$(NC)"
	npx prettier --write "**/*.{js,ts,tsx,json,md,sol}"
	@echo "$(GREEN)✓ Code formatted$(NC)"

# =============================================================================
# Security
# =============================================================================

audit: ## Run security audit
	@echo "$(CYAN)Running security audit...$(NC)"
	npm audit
	@echo "$(GREEN)✓ Audit complete$(NC)"

audit-fix: ## Fix security vulnerabilities
	@echo "$(CYAN)Fixing security vulnerabilities...$(NC)"
	npm audit fix
	@echo "$(GREEN)✓ Vulnerabilities fixed$(NC)"

slither: ## Run Slither security analysis
	@echo "$(CYAN)Running Slither...$(NC)"
	cd contracts && slither src/
	@echo "$(GREEN)✓ Slither analysis complete$(NC)"

# =============================================================================
# Utilities
# =============================================================================

clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/.next
	rm -rf apps/*/dist
	rm -rf packages/*/dist
	rm -rf contracts/out
	rm -rf contracts/cache
	@echo "$(GREEN)✓ Clean complete$(NC)"

health: ## Check health of all services
	@echo "$(CYAN)Checking service health...$(NC)"
	@echo "$(YELLOW)API:$(NC)"
	@curl -s http://localhost:3100/health | jq . || echo "API not responding"
	@echo "$(YELLOW)Frontend:$(NC)"
	@curl -s http://localhost:3000 > /dev/null && echo "✓ Running" || echo "✗ Not responding"
	@echo "$(YELLOW)PostgreSQL:$(NC)"
	@docker-compose exec -T postgres pg_isready -U mycelix || echo "✗ Not responding"
	@echo "$(YELLOW)Redis:$(NC)"
	@docker-compose exec -T redis redis-cli ping || echo "✗ Not responding"

status: docker-ps health ## Show full system status

# =============================================================================
# Git & Release
# =============================================================================

pre-commit: lint test ## Run pre-commit checks
	@echo "$(GREEN)✓ Pre-commit checks passed$(NC)"

release-patch: ## Create patch release (0.0.x)
	@echo "$(CYAN)Creating patch release...$(NC)"
	npm version patch
	@echo "$(GREEN)✓ Patch version bumped$(NC)"

release-minor: ## Create minor release (0.x.0)
	@echo "$(CYAN)Creating minor release...$(NC)"
	npm version minor
	@echo "$(GREEN)✓ Minor version bumped$(NC)"

release-major: ## Create major release (x.0.0)
	@echo "$(CYAN)Creating major release...$(NC)"
	npm version major
	@echo "$(GREEN)✓ Major version bumped$(NC)"

# =============================================================================
# Production
# =============================================================================

deploy-production: ## Deploy to production (requires env vars)
	@echo "$(RED)Deploying to production...$(NC)"
	@./scripts/deploy-production.sh
	@echo "$(GREEN)✓ Deployment complete$(NC)"

backup-production: ## Backup production database
	@echo "$(CYAN)Backing up production database...$(NC)"
	@./scripts/backup-production.sh
	@echo "$(GREEN)✓ Backup complete$(NC)"
