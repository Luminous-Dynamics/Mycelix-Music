# 🔍 Mycelix Music - Debugging Guide

Comprehensive guide for debugging issues across the Mycelix Music platform.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Smart Contract Debugging](#smart-contract-debugging)
- [Backend API Debugging](#backend-api-debugging)
- [Frontend Debugging](#frontend-debugging)
- [Database Issues](#database-issues)
- [Docker Issues](#docker-issues)
- [Common Error Messages](#common-error-messages)
- [Performance Debugging](#performance-debugging)
- [Tools & Resources](#tools--resources)

---

## Quick Diagnostics

### Health Check Checklist

Run these commands to quickly identify issues:

```bash
# Check overall system status
make status

# Check Docker services
make docker-ps

# Check API health
curl http://localhost:3100/health | jq

# Check database connection
docker-compose exec postgres pg_isready -U mycelix

# Check Redis connection
docker-compose exec redis redis-cli ping

# View recent logs
make docker-logs
```

### Common Quick Fixes

```bash
# Restart all services
make docker-down && make docker-up

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Reset database
make db-reset && make db-seed

# Rebuild everything
make clean && make install && make build
```

---

## Smart Contract Debugging

### Enable Verbose Output

```bash
# Run tests with maximum verbosity
cd contracts
forge test -vvvv

# Run specific test
forge test --match-test testFunctionName -vvvv

# Run with gas reports
forge test --gas-report
```

### Debugging Failed Transactions

```solidity
// Add console logging to contracts (Foundry's console2)
import "forge-std/console2.sol";

function myFunction() public {
    console2.log("Variable value:", someVariable);
    console2.log("Address:", msg.sender);
    console2.logBytes32(songHash);
}
```

### Common Contract Issues

#### Issue: "Approval failed"

**Cause:** ERC20 token approval race condition or insufficient balance

**Debug:**
```bash
# Check token balance
cast call $FLOW_TOKEN_ADDRESS "balanceOf(address)" $WALLET_ADDRESS

# Check allowance
cast call $FLOW_TOKEN_ADDRESS "allowance(address,address)" $OWNER $SPENDER
```

**Fix:**
```solidity
// Ensure approval reset
flowToken.approve(spender, 0);
flowToken.approve(spender, amount);
```

#### Issue: "Only song artist can configure"

**Cause:** Calling configuration function from wrong address

**Debug:**
```bash
# Check who is registered as artist
cast call $ROUTER_ADDRESS "getSongArtist(bytes32)" $SONG_HASH
```

**Fix:**
```javascript
// Ensure correct signer
const artistSigner = await ethers.getSigner(artistAddress);
const contract = router.connect(artistSigner);
```

#### Issue: "Royalty split not configured"

**Cause:** Trying to calculate splits before configuration

**Debug:**
```solidity
// Check if split is initialized
RoyaltySplit memory split = royaltySplits[songId];
console2.log("Initialized:", split.initialized);
```

**Fix:**
```javascript
// Configure split first
await strategy.configureRoyaltySplit(songHash, recipients, basisPoints, roles);
```

### Using Foundry Debugger

```bash
# Run debugger on failed test
forge test --match-test testName --debug

# Common debugger commands:
# - s: step into
# - n: step over
# - c: continue
# - q: quit
# - p <variable>: print variable
```

### Trace Failed Transactions

```bash
# Get transaction trace
cast run $TX_HASH --rpc-url $RPC_URL --debug

# Get call trace
cast run $TX_HASH --rpc-url $RPC_URL --trace
```

---

## Backend API Debugging

### Enable Debug Logging

```bash
# Set DEBUG environment variable
DEBUG=mycelix:* npm run dev --workspace=apps/api

# Or in .env
DEBUG=mycelix:*
LOG_LEVEL=debug
```

### Common API Issues

#### Issue: "Database connection failed"

**Debug:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"

# View PostgreSQL logs
docker-compose logs postgres
```

**Fix:**
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Or recreate
docker-compose down postgres
docker-compose up -d postgres
```

#### Issue: "Redis connection failed"

**Debug:**
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -u $REDIS_URL ping

# Check Redis logs
docker-compose logs redis
```

**Fix:**
```bash
# Clear Redis and restart
docker-compose exec redis redis-cli FLUSHALL
docker-compose restart redis
```

#### Issue: "Rate limit exceeded (429)"

**Debug:**
```bash
# Check rate limit records
docker-compose exec redis redis-cli KEYS "ratelimit:*"

# Check specific IP
docker-compose exec redis redis-cli GET "ratelimit:192.168.1.1"
```

**Fix:**
```bash
# Clear rate limit for specific IP
docker-compose exec redis redis-cli DEL "ratelimit:192.168.1.1"

# Or clear all
docker-compose exec redis redis-cli KEYS "ratelimit:*" | xargs docker-compose exec -T redis redis-cli DEL
```

#### Issue: "Invalid Ethereum address"

**Debug:**
```javascript
// Add logging in API
logger.debug('Received address:', { address: req.body.artist_address });
logger.debug('Validation regex:', /^0x[a-fA-F0-9]{40}$/);
```

**Fix:**
```javascript
// Ensure proper address format
const address = ethers.utils.getAddress(rawAddress); // Checksummed
```

### Using Node.js Debugger

```bash
# Start API in debug mode
node --inspect-brk apps/api/src/index.ts

# Or with npm
npm run dev:debug --workspace=apps/api
```

Then attach with:
- Chrome DevTools: `chrome://inspect`
- VS Code: Use Debug configuration
- Node Inspector

### API Request Debugging

```bash
# Enable request logging
curl -v http://localhost:3100/api/songs

# Test with specific headers
curl -H "Content-Type: application/json" \
     -H "X-Debug: true" \
     http://localhost:3100/api/songs

# Test POST with data
curl -X POST http://localhost:3100/api/songs \
     -H "Content-Type: application/json" \
     -d '{"song_id":"test","artist_address":"0x123..."}'
```

---

## Frontend Debugging

### Enable Debug Mode

```bash
# In .env.local
NEXT_PUBLIC_DEBUG=true
NODE_ENV=development

# Start with debug output
npm run dev --workspace=apps/web
```

### React DevTools

1. Install React DevTools browser extension
2. Open DevTools → Components tab
3. Inspect component props and state

### Common Frontend Issues

#### Issue: "Wallet connection failed"

**Debug:**
```javascript
// Add Privy debug logging
const { ready, authenticated, user } = usePrivy();

useEffect(() => {
  console.log('Privy ready:', ready);
  console.log('Authenticated:', authenticated);
  console.log('User:', user);
}, [ready, authenticated, user]);
```

**Fix:**
```javascript
// Ensure Privy is configured correctly
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{
    loginMethods: ['wallet', 'email'],
    appearance: { theme: 'dark' }
  }}
>
```

#### Issue: "API calls failing (CORS)"

**Debug:**
```javascript
// Check API URL
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// Check fetch calls
fetch(url, {
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include' // If using cookies
})
.then(res => console.log('Response:', res))
.catch(err => console.error('Error:', err));
```

**Fix:**
```typescript
// In API (apps/api/src/index.ts)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

#### Issue: "Contract calls failing"

**Debug:**
```javascript
// Add detailed error logging
try {
  const tx = await contract.someFunction();
  console.log('Transaction:', tx);
  const receipt = await tx.wait();
  console.log('Receipt:', receipt);
} catch (error) {
  console.error('Contract error:', error);
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
  console.error('Error data:', error.data);
}
```

**Fix:**
```javascript
// Ensure correct network
const { chainId } = await provider.getNetwork();
if (chainId !== expectedChainId) {
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
  });
}
```

### Next.js Debugging

```bash
# Enable Node.js debugging for Next.js
NODE_OPTIONS='--inspect' npm run dev --workspace=apps/web

# View detailed build info
npm run build --workspace=apps/web -- --debug
```

---

## Database Issues

### Query Debugging

```sql
-- Enable query logging
ALTER DATABASE mycelix_music SET log_statement = 'all';

-- View slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- View active queries
SELECT pid, usename, query, state
FROM pg_stat_activity
WHERE state != 'idle';
```

### Check Indexes

```sql
-- List all indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public';

-- Check index usage
SELECT
  schemaname, tablename, indexname,
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes;
```

### Vacuum and Analyze

```bash
# Optimize database
docker-compose exec postgres psql -U mycelix -d mycelix_music -c "VACUUM ANALYZE;"
```

---

## Docker Issues

### Container Won't Start

```bash
# Check container logs
docker-compose logs <service-name>

# Check container status
docker-compose ps

# Inspect container
docker inspect mycelix-music-<service>

# Check resources
docker stats
```

### Port Conflicts

```bash
# Find what's using a port
lsof -i :3100
lsof -i :5432

# Kill process
kill -9 <PID>

# Or use different port in docker-compose.yml
ports:
  - "5433:5432"  # External:Internal
```

### Volume Issues

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect mycelix-music_postgres_data

# Remove volumes (DANGEROUS - deletes data)
docker-compose down -v
```

### Network Issues

```bash
# Check networks
docker network ls

# Inspect network
docker network inspect mycelix-music-network

# Recreate network
docker-compose down
docker network rm mycelix-music-network
docker-compose up -d
```

---

## Common Error Messages

### "ECONNREFUSED"

**Meaning:** Cannot connect to service

**Debug:**
- Check service is running: `docker-compose ps`
- Check port is correct
- Check firewall rules

**Fix:**
- Start service: `docker-compose up -d <service>`
- Update connection string in `.env`

### "EADDRINUSE"

**Meaning:** Port already in use

**Fix:**
```bash
# Find and kill process
lsof -ti:3100 | xargs kill -9

# Or use different port
API_PORT=3101
```

### "SequelizeConnectionError"

**Meaning:** Cannot connect to PostgreSQL

**Debug:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

**Fix:**
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Check credentials

### "RedisError: connect ECONNREFUSED"

**Meaning:** Cannot connect to Redis

**Fix:**
```bash
# Start Redis
docker-compose up -d redis

# Check URL
echo $REDIS_URL  # Should be redis://localhost:6379
```

### "Transaction reverted without a reason string"

**Meaning:** Smart contract function failed

**Debug:**
```bash
# Use tenderly or hardhat to debug
# Or add require messages to contracts
require(condition, "Descriptive error message");
```

---

## Performance Debugging

### API Performance

```bash
# Enable detailed timing logs
DEBUG=express:* npm run dev --workspace=apps/api

# Monitor with autocannon
npx autocannon -c 10 -d 30 http://localhost:3100/api/songs
```

### Database Performance

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check cache hit ratio
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit)  as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

### Frontend Performance

```javascript
// Use React Profiler
import { Profiler } from 'react';

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>
```

---

## Tools & Resources

### Recommended Tools

**Smart Contracts:**
- [Foundry](https://book.getfoundry.sh/) - Development framework
- [Tenderly](https://tenderly.co/) - Transaction debugging
- [Etherscan](https://etherscan.io/) - Block explorer

**Backend:**
- [Postman](https://www.postman.com/) - API testing
- [pgAdmin](https://www.pgadmin.org/) - PostgreSQL GUI
- [RedisInsight](https://redis.com/redis-enterprise/redis-insight/) - Redis GUI

**Frontend:**
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

**General:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/) with extensions:
  - Solidity
  - ESLint
  - Prettier
  - Docker
  - GitLens

### Useful Commands Reference

```bash
# View all available commands
make help

# Check system health
make health

# View all logs
make docker-logs

# Rebuild everything
make clean && make install && make setup

# Run all tests
make test

# Deploy contracts locally
make contracts-deploy-local
```

---

## Getting Help

If you're still stuck:

1. **Check existing issues:** [GitHub Issues](https://github.com/luminous-dynamics/mycelix-music/issues)
2. **Search documentation:** Check `/docs` directory
3. **Ask for help:** Open a new issue with:
   - Error message
   - Steps to reproduce
   - Environment info (OS, Node version, etc.)
   - Logs from `docker-compose logs`

---

**Remember:** Most issues can be solved by:
1. Checking logs: `make docker-logs`
2. Restarting services: `make docker-down && make docker-up`
3. Clearing cache: `docker-compose exec redis redis-cli FLUSHALL`
4. Resetting database: `make db-reset`

Happy debugging! 🔍
