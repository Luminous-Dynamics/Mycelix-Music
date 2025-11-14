# 🚀 Mycelix Music - Quick Start Guide

Get up and running with Mycelix Music in under 15 minutes!

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- ✅ **npm** >= 10.0.0 (comes with Node.js)
- ✅ **Git** ([Download](https://git-scm.com/))
- ✅ **Docker** (optional but recommended) ([Download](https://www.docker.com/))

**Verify your installation:**
```bash
node --version  # Should be v20.0.0 or higher
npm --version   # Should be 10.0.0 or higher
git --version   # Any recent version
```

---

## Option 1: Docker Compose (Recommended)

**⏱️ Time:** ~10 minutes

This method starts all services automatically (PostgreSQL, Redis, IPFS, Ceramic).

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/luminous-dynamics/mycelix-music.git
cd mycelix-music

# Install dependencies
npm install
```

### Step 2: Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env if needed (defaults work for local development)
# You can use any text editor:
nano .env
# or
code .env
```

### Step 3: Start Everything

```bash
# Start all services with one command
npm run setup:local
```

This will:
1. Start PostgreSQL, Redis, IPFS, and Ceramic (via Docker)
2. Deploy smart contracts to local blockchain
3. Seed database with test data
4. Start development servers

### Step 4: Access the Platform

Once everything starts successfully, open:

- 🎵 **Frontend:** http://localhost:3000
- 🔌 **API:** http://localhost:3100
- 🏥 **Health Check:** http://localhost:3100/health

**Test Data Available:**
- Sample songs in various economic models
- Test artist accounts
- Example payment transactions

### Step 5: Stop Services

```bash
# Stop all services
npm run services:down
```

---

## Option 2: Manual Setup

**⏱️ Time:** ~15 minutes

For more control or if Docker isn't available.

### Step 1: Clone and Install

```bash
git clone https://github.com/luminous-dynamics/mycelix-music.git
cd mycelix-music
npm install
```

### Step 2: Start PostgreSQL

**Option A - Using Docker:**
```bash
docker run -d \
  --name mycelix-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=mycelix_music \
  -p 5432:5432 \
  postgres:14
```

**Option B - Native Installation:**
```bash
# macOS
brew install postgresql@14
brew services start postgresql@14
createdb mycelix_music

# Ubuntu/Debian
sudo apt install postgresql-14
sudo systemctl start postgresql
sudo -u postgres createdb mycelix_music
```

### Step 3: Start Redis

**Option A - Using Docker:**
```bash
docker run -d \
  --name mycelix-redis \
  -p 6379:6379 \
  redis:6
```

**Option B - Native Installation:**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### Step 4: Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` to match your setup:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/mycelix_music
REDIS_URL=redis://localhost:6379
API_PORT=3100
NODE_ENV=development
```

### Step 5: Deploy Smart Contracts

**Terminal 1 - Start Local Blockchain:**
```bash
# Install Foundry if you haven't already
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Start Anvil (local Ethereum node)
anvil --block-time 1
```

**Terminal 2 - Deploy Contracts:**
```bash
npm run contracts:deploy:local
```

Copy the deployed contract addresses and update `.env`:
```bash
ROUTER_ADDRESS=0x...
PAY_PER_STREAM_ADDRESS=0x...
GIFT_ECONOMY_ADDRESS=0x...
FLOW_TOKEN_ADDRESS=0x...
```

### Step 6: Start Backend API

**Terminal 3:**
```bash
cd apps/api
npm run dev
```

Expected output:
```json
{"timestamp":"2025-01-15T10:00:00.000Z","level":"INFO","message":"PostgreSQL client connected"}
{"timestamp":"2025-01-15T10:00:00.000Z","level":"INFO","message":"Redis client ready"}
{"timestamp":"2025-01-15T10:00:00.000Z","level":"INFO","message":"API server running on port 3100"}
```

### Step 7: Start Frontend

**Terminal 4:**
```bash
cd apps/web
npm run dev
```

### Step 8: Access the Platform

- 🎵 **Frontend:** http://localhost:3000
- 🔌 **API:** http://localhost:3100
- 🏥 **Health:** http://localhost:3100/health

---

## Verify Everything is Working

### 1. Check Health Endpoint

```bash
curl http://localhost:3100/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 42.5,
  "environment": "development",
  "dependencies": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 2. List Songs

```bash
curl http://localhost:3100/api/songs
```

### 3. Test the Frontend

1. Open http://localhost:3000
2. Click "Discover" to see sample songs
3. Click "Upload" to try the artist flow
4. Connect wallet with Privy

---

## Common Issues & Solutions

### Port Already in Use

```bash
# Find what's using the port
lsof -i :3100  # For API
lsof -i :3000  # For frontend

# Kill the process
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Check connection string in .env
echo $DATABASE_URL

# Try connecting manually
psql $DATABASE_URL -c "SELECT 1;"
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping  # Should return "PONG"

# Check connection string
echo $REDIS_URL
```

### Contract Deployment Failed

```bash
# Make sure Anvil is running
# Check you have the default private key in .env
# Verify RPC URL is correct: http://localhost:8545
```

### Frontend Can't Connect to API

```bash
# Check API is running
curl http://localhost:3100/health

# Check NEXT_PUBLIC_API_URL in apps/web/.env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3100" > apps/web/.env.local
```

---

## Next Steps

### For Developers

1. **Explore the Code:**
   - Smart contracts: `contracts/src/`
   - SDK: `packages/sdk/src/`
   - Frontend: `apps/web/`
   - API: `apps/api/src/`

2. **Read Documentation:**
   - [API Documentation](./API_DOCUMENTATION.md)
   - [Deployment Guide](./DEPLOYMENT_GUIDE.md)
   - [Migration Guide](./MIGRATION_GUIDE.md)
   - [Architecture Docs](./docs/)

3. **Run Tests:**
   ```bash
   # Smart contract tests
   npm run contracts:test

   # All tests
   npm test
   ```

### For Artists

1. **Upload Your First Song:**
   - Go to http://localhost:3000/upload
   - Connect your wallet
   - Choose an economic model
   - Upload your music file

2. **Try Different Models:**
   - Pay Per Stream - $0.01/play
   - Gift Economy - Free + tips
   - Create custom splits

3. **Track Earnings:**
   - Visit http://localhost:3000/dashboard
   - View play count and earnings
   - See listener engagement

### For Listeners

1. **Discover Music:**
   - Browse http://localhost:3000/discover
   - Filter by genre or economic model
   - See artist descriptions

2. **Stream Songs:**
   - Click play on any song
   - Payment handled automatically
   - Earn CGC rewards (gift economy tracks)

---

## Development Workflow

### Making Changes

```bash
# Create a new branch
git checkout -b feature/my-feature

# Make your changes

# Run tests
npm test

# Commit
git add .
git commit -m "feat: add my feature"

# Push
git push origin feature/my-feature
```

### Hot Reload

All services support hot reload:
- **Smart Contracts:** Re-deploy after changes
- **Frontend:** Automatic refresh on save
- **API:** Automatic restart with nodemon
- **SDK:** Build with `npm run build --workspace=packages/sdk`

### Useful Commands

```bash
# Clean everything
npm run clean

# Rebuild all
npm run build

# Run linter
npm run lint

# View logs
npm run services:logs

# Check service status
npm run services:ps
```

---

## Troubleshooting

### Still Having Issues?

1. **Check Environment Variables:**
   ```bash
   cat .env | grep -v '^#' | grep -v '^$'
   ```

2. **View API Logs:**
   ```bash
   # If using Docker
   docker logs -f mycelix-api

   # If running manually, check Terminal 3
   ```

3. **Reset Database:**
   ```bash
   # Drop and recreate
   dropdb mycelix_music
   createdb mycelix_music

   # Or restart API (tables auto-create)
   ```

4. **Clear Cache:**
   ```bash
   # Redis
   redis-cli FLUSHALL

   # Or restart Redis
   docker restart mycelix-redis
   ```

5. **Get Help:**
   - [GitHub Issues](https://github.com/luminous-dynamics/mycelix-music/issues)
   - [Documentation](./docs/)
   - [API Reference](./API_DOCUMENTATION.md)

---

## Success! 🎉

You now have:
- ✅ Smart contracts deployed locally
- ✅ Backend API running with database
- ✅ Frontend accessible
- ✅ Health check passing
- ✅ Test data loaded

**Ready to build the future of music!** 🎵

---

## What's Next?

### Learn More
- [Economic Modules Architecture](./docs/ECONOMIC_MODULES_ARCHITECTURE.md)
- [Implementation Examples](./docs/IMPLEMENTATION_EXAMPLE.md)
- [Business Plan](./docs/Business%20Plan%20v1.0.md)

### Deploy to Production
- [Production Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Security Checklist](./DEPLOYMENT_GUIDE.md#security-audit)

### Contribute
- [Contributing Guidelines](./CONTRIBUTING.md) (coming soon)
- [Code of Conduct](./CODE_OF_CONDUCT.md) (coming soon)

---

**Need Help?** Open an issue on [GitHub](https://github.com/luminous-dynamics/mycelix-music/issues)

**Have Questions?** Check the [FAQ](./docs/FAQ.md) (coming soon)

**Want to Contribute?** Read [CONTRIBUTING.md](./CONTRIBUTING.md) (coming soon)
