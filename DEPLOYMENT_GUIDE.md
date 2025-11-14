# Mycelix Music Deployment Guide

This guide covers deploying the Mycelix Music platform to production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Production Deployment](#production-deployment)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** >= 14
- **Redis** >= 6.0
- **Docker** (optional, recommended)
- **Foundry** (for smart contract deployment)

### Required Accounts
- **Web3.Storage** - For IPFS pinning (production)
- **Privy** - For wallet authentication
- **Ceramic Network** - For DKG claims (optional)

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/luminous-dynamics/mycelix-music.git
cd mycelix-music
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create `.env` file in the root directory:

```bash
cp .env.example .env
```

#### Required Variables

**Blockchain Configuration:**
```bash
# RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
GNOSIS_RPC_URL=https://rpc.gnosischain.com
CHIADO_RPC_URL=https://rpc.chiadochain.net

# Chain IDs
CHAIN_ID=100  # Gnosis Chain (production)
# CHAIN_ID=10200  # Chiado Testnet (staging)
# CHAIN_ID=31337  # Localhost (development)

# Deployment wallet (KEEP SECURE!)
PRIVATE_KEY=0x...  # NEVER commit this to git!
```

**Contract Addresses:**
```bash
# Deploy contracts first, then update these
ROUTER_ADDRESS=0x...
PAY_PER_STREAM_ADDRESS=0x...
GIFT_ECONOMY_ADDRESS=0x...
FLOW_TOKEN_ADDRESS=0x...
CGC_REGISTRY_ADDRESS=0x...
```

**API Configuration:**
```bash
API_PORT=3100
DATABASE_URL=postgresql://user:password@localhost:5432/mycelix_music
REDIS_URL=redis://localhost:6379
NODE_ENV=production  # or development, staging
```

**Frontend Configuration:**
```bash
NEXT_PUBLIC_API_URL=https://api.music.mycelix.net
NEXT_PUBLIC_CHAIN_ID=100
NEXT_PUBLIC_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

**External Services:**
```bash
# Web3.Storage (IPFS)
WEB3_STORAGE_TOKEN=your-token

# Privy Authentication
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret

# Ceramic DKG
CERAMIC_URL=https://ceramic.mycelix.net
CERAMIC_ADMIN_SEED=your-seed-phrase
```

**Security Note:** Use environment-specific `.env` files and NEVER commit secrets to git!

---

## Local Development

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
npm run services:up

# Wait for services to be healthy
sleep 10

# Deploy contracts
npm run contracts:deploy:local

# Seed database with test data
npm run seed:local

# Start development servers
npm run dev
```

Services available at:
- Frontend: http://localhost:3000
- API: http://localhost:3100
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- IPFS: localhost:5001
- Ceramic: localhost:7007

### Option 2: Manual Setup

**1. Start PostgreSQL:**
```bash
createdb mycelix_music
```

**2. Start Redis:**
```bash
redis-server
```

**3. Deploy Contracts:**
```bash
# Start local blockchain
anvil

# Deploy (in another terminal)
npm run contracts:deploy:local
```

**4. Start Services:**
```bash
# Terminal 1: API
cd apps/api
npm run dev

# Terminal 2: Frontend
cd apps/web
npm run dev
```

---

## Production Deployment

### Step 1: Prepare Infrastructure

#### Database (PostgreSQL)

**Managed Services (Recommended):**
- AWS RDS PostgreSQL
- Google Cloud SQL
- Supabase
- Neon

**Configuration:**
```sql
-- Create production database
CREATE DATABASE mycelix_music_prod;

-- Create dedicated user
CREATE USER mycelix_api WITH ENCRYPTED PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE mycelix_music_prod TO mycelix_api;
```

**Connection String:**
```bash
DATABASE_URL=postgresql://mycelix_api:secure-password@db.example.com:5432/mycelix_music_prod?sslmode=require
```

#### Cache (Redis)

**Managed Services (Recommended):**
- AWS ElastiCache
- Google Cloud Memorystore
- Upstash
- Redis Cloud

**Connection String:**
```bash
REDIS_URL=rediss://default:password@redis.example.com:6379
```

### Step 2: Deploy Smart Contracts

**Testnet Deployment (Chiado):**

```bash
# Set environment
export CHAIN_ID=10200
export RPC_URL=$CHIADO_RPC_URL

# Deploy
cd contracts
forge script script/DeployTestnet.s.sol \
  --rpc-url $CHIADO_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Update .env with deployed addresses
```

**Mainnet Deployment (Gnosis Chain):**

```bash
# CRITICAL: Triple-check everything before mainnet deployment!
export CHAIN_ID=100
export RPC_URL=$GNOSIS_RPC_URL

# Deploy
cd contracts
forge script script/DeployMainnet.s.sol \
  --rpc-url $GNOSIS_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $GNOSISSCAN_API_KEY

# Verify deployment
forge verify-contract <contract-address> <contract-name> \
  --chain-id 100 \
  --etherscan-api-key $GNOSISSCAN_API_KEY
```

**Post-Deployment:**
1. Update contract addresses in `.env`
2. Register strategies with router
3. Test all contract interactions
4. Transfer ownership to multisig (recommended)

### Step 3: Deploy Backend API

#### Option A: Docker (Recommended)

**Create Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci

COPY apps/api ./apps/api
COPY .env .env

RUN npm run build --workspace=apps/api

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/.env .env

EXPOSE 3100

CMD ["node", "dist/index.js"]
```

**Build and Deploy:**
```bash
# Build
docker build -t mycelix-api:latest -f apps/api/Dockerfile .

# Run
docker run -d \
  --name mycelix-api \
  -p 3100:3100 \
  --env-file .env \
  mycelix-api:latest
```

#### Option B: Platform Deployment

**Railway:**
```bash
railway login
railway init
railway up
```

**Render:**
```bash
# Create render.yaml
services:
  - type: web
    name: mycelix-api
    env: node
    buildCommand: npm install && npm run build --workspace=apps/api
    startCommand: node apps/api/dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
```

**Fly.io:**
```bash
fly launch
fly deploy
```

### Step 4: Deploy Frontend

#### Option A: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd apps/web
vercel --prod
```

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

#### Option B: Docker

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm ci

COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./apps/web/

WORKDIR /app/apps/web
EXPOSE 3000

CMD ["npm", "start"]
```

### Step 5: Configure DNS & SSL

**DNS Records:**
```
A     music.mycelix.net        -> <frontend-ip>
A     api.music.mycelix.net    -> <api-ip>
```

**SSL Certificates:**
- Use Let's Encrypt (free)
- Configure automatic renewal
- Or use platform-provided SSL (Vercel, Railway, etc.)

---

## Monitoring & Maintenance

### Health Checks

**API Health Check:**
```bash
curl https://api.music.mycelix.net/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "dependencies": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Monitoring Setup

**Application Monitoring:**
- Set up monitoring on `/health` endpoint
- Alert on 503 responses
- Monitor response times

**Log Aggregation:**
- Collect JSON logs from stdout
- Use log aggregation service (Datadog, LogDNA, etc.)
- Set up alerts for ERROR level logs

**Database Monitoring:**
- Monitor connection pool usage
- Track slow queries
- Set up automated backups

**Redis Monitoring:**
- Monitor memory usage
- Track cache hit rates
- Monitor connection count

### Backup Strategy

**Database Backups:**
```bash
# Daily automated backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20250115.sql
```

**Contract State:**
- Smart contracts are immutable
- Use events for audit trail
- Run archive nodes for historical data

### Updates & Maintenance

**Zero-Downtime Deployments:**
1. Deploy new version alongside current
2. Run health checks on new version
3. Gradually shift traffic (blue-green deployment)
4. Monitor error rates
5. Rollback if issues detected

**Database Migrations:**
```bash
# Create migration
npm run db:migrate:create add_new_column

# Run migration
npm run db:migrate:up

# Rollback if needed
npm run db:migrate:down
```

**Smart Contract Upgrades:**
- Deploy new strategy contracts
- Register with existing router
- Update frontend to use new contracts
- Keep old contracts for historical data

---

## Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Verify credentials
echo $DATABASE_URL

# Check firewall rules
```

**Redis Connection Failed:**
```bash
# Check connectivity
redis-cli -u $REDIS_URL ping

# Verify connection string
echo $REDIS_URL
```

**Contract Deployment Failed:**
```bash
# Verify private key has funds
cast balance $YOUR_ADDRESS --rpc-url $RPC_URL

# Check gas price
cast gas-price --rpc-url $RPC_URL

# Verify RPC URL
cast client --rpc-url $RPC_URL
```

**Rate Limiting Issues:**
```bash
# Increase rate limit in production
# Edit apps/api/src/index.ts
app.use(rateLimit(1000, 60 * 1000)); # 1000 req/min
```

### Log Analysis

**View logs:**
```bash
# Docker
docker logs mycelix-api --tail 100 -f

# Platform-specific
railway logs
vercel logs
fly logs
```

**Parse JSON logs:**
```bash
# Extract errors
cat logs.json | jq 'select(.level=="ERROR")'

# Count by log level
cat logs.json | jq -r '.level' | sort | uniq -c
```

### Performance Optimization

**Database:**
```sql
-- Find slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze query plan
EXPLAIN ANALYZE SELECT * FROM songs WHERE artist_address = '0x...';
```

**Cache:**
```bash
# Monitor Redis
redis-cli INFO stats

# Check cache hit rate
redis-cli INFO stats | grep hit_rate
```

### Security Audit

**Regular Tasks:**
- Review access logs for suspicious activity
- Update dependencies monthly
- Rotate secrets quarterly
- Review and update CSP headers
- Monitor smart contract events

**Security Checklist:**
- [ ] All secrets in environment variables
- [ ] SSL/TLS enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Database parameterized queries
- [ ] CORS properly configured
- [ ] Regular backups automated
- [ ] Monitoring and alerting set up

---

## Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Smart contracts deployed and verified
- [ ] Database migrations run successfully
- [ ] Redis cache configured
- [ ] Health check endpoint working
- [ ] SSL certificates installed
- [ ] DNS records configured
- [ ] Monitoring set up
- [ ] Backups automated
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] CORS configured for frontend domain
- [ ] Error logging working
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on deployment process

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/luminous-dynamics/mycelix-music/issues
- Documentation: See `/docs` directory
- API Docs: See `API_DOCUMENTATION.md`
- Migration Guide: See `MIGRATION_GUIDE.md`

---

## License

MIT License - See LICENSE file for details
