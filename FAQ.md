# ❓ Mycelix Music - Frequently Asked Questions (FAQ)

Common questions and answers about the Mycelix Music platform.

## Table of Contents

- [General Questions](#general-questions)
- [Getting Started](#getting-started)
- [Smart Contracts](#smart-contracts)
- [Economic Models](#economic-models)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Performance](#performance)

---

## General Questions

### What is Mycelix Music?

Mycelix Music is a decentralized music platform that allows artists to choose their own economic models. Artists can use traditional pay-per-stream, gift economy (free listening + tips + rewards), or create custom revenue models using smart contracts.

### What blockchain does it use?

Mycelix Music is designed for **Gnosis Chain** (formerly xDai) due to low transaction fees and fast confirmation times. However, it's EVM-compatible and can be deployed to any Ethereum-compatible network.

### Is Mycelix Music free to use?

- **For Listeners:** Depends on the artist's chosen model. Some songs are free (gift economy), others require payment per stream.
- **For Artists:** Platform usage is free, but blockchain gas fees apply when configuring economic strategies.
- **For Developers:** Open source and free to deploy/modify.

### What is CGC (Community Gratitude Currency)?

CGC is a reward token in the gift economy model. Listeners earn CGC by:
- Being early supporters (first N listeners)
- Listening repeatedly (loyalty multiplier)
- Engaging with free content

Artists can use CGC for promotional campaigns, voting systems, or convert to other value.

---

## Getting Started

### How do I set up the development environment?

**Quick Start (15 minutes):**

```bash
git clone https://github.com/luminous-dynamics/mycelix-music.git
cd mycelix-music
npm install
make setup  # Installs everything and starts services
make dev    # Start development servers
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions.

### What are the system requirements?

**Required:**
- Node.js >= 20.0.0
- npm >= 10.0.0
- Git

**Recommended:**
- Docker Desktop
- 8GB+ RAM
- 10GB+ free disk space

**For Smart Contracts:**
- Foundry (installed automatically by setup script)

### Do I need to know Solidity to contribute?

**No!** You can contribute to:
- **Frontend** (Next.js/React/TypeScript)
- **Backend API** (Node.js/Express)
- **Documentation** (Markdown)
- **Design** (UI/UX)
- **Testing**

Only smart contract development requires Solidity knowledge.

### How do I run tests?

```bash
# All tests
make test

# Smart contract tests only
make contracts-test

# API tests
make test-api

# Frontend tests
make test-web

# With coverage
make contracts-coverage
```

---

## Smart Contracts

### What smart contracts are included?

1. **EconomicStrategyRouter** - Main routing contract for all payments
2. **PayPerStreamStrategy** - Traditional pay-per-stream ($0.01/play)
3. **GiftEconomyStrategy** - Free listening with CGC rewards
4. **FlowToken** (Mock) - Test ERC20 token for local development

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

### How do I deploy contracts to testnet?

```bash
# 1. Set environment variables
PRIVATE_KEY=your_private_key
GNOSIS_TESTNET_RPC=https://rpc.chiadochain.net
ETHERSCAN_API_KEY=your_api_key

# 2. Deploy
make contracts-deploy-testnet

# 3. Verify (optional)
make contracts-verify
```

### Can I create custom economic strategies?

**Yes!** Implement the `IEconomicStrategy` interface:

```solidity
interface IEconomicStrategy {
    function processPlay(
        bytes32 songId,
        address listener,
        uint256 amount
    ) external returns (uint256 netAmount);

    function calculateSplits(
        bytes32 songId,
        uint256 amount
    ) external view returns (Split[] memory);
}
```

See `/contracts/src/interfaces/IEconomicStrategy.sol` for full interface.

### How do I add a new strategy to the router?

```solidity
// Deploy your strategy
MyStrategy strategy = new MyStrategy(address(router));

// Register with router
router.setStrategy(songHash, address(strategy));
```

### What's the difference between `processPlay` and `calculateSplits`?

- **`processPlay`**: Executes when a song is played. Handles token transfers, state updates, rewards.
- **`calculateSplits`**: View function that previews how payment will be split without executing.

---

## Economic Models

### What economic models are available?

**1. Pay Per Stream**
- Fixed price per play (default: $0.01)
- Configurable revenue splits
- Role-based distribution (artist, producer, featured artist, etc.)

**2. Gift Economy**
- Free listening
- Optional tipping
- CGC rewards for listeners
- Early supporter bonuses
- Loyalty multipliers

**3. Custom**
- Implement your own `IEconomicStrategy`
- Full flexibility

### How do revenue splits work?

Artists configure splits using basis points (1/100th of a percent):

```javascript
// Example: 60% artist, 30% producer, 10% platform
const recipients = ['0x...artist', '0x...producer', '0x...platform'];
const basisPoints = [6000, 3000, 1000]; // Total must equal 10000
const roles = ['artist', 'producer', 'platform'];

await strategy.configureRoyaltySplit(songHash, recipients, basisPoints, roles);
```

### Can I change the economic model after upload?

**No** - for integrity reasons. Once a song is uploaded with a strategy, it cannot be changed. This prevents bait-and-switch tactics.

**Workaround:** Upload as a new song with the desired model.

### How do listeners earn CGC rewards?

In the gift economy model:

1. **Per Listen:** Base CGC amount (configurable)
2. **Early Supporter Bonus:** First N listeners get extra CGC
3. **Loyalty Multiplier:** Repeated listens earn multiplied rewards

Example:
```javascript
// Configure: 1 CGC/listen, 5 CGC bonus, first 100 listeners, 1.5x multiplier
await strategy.configureGiftEconomy(
  songHash,
  artistAddress,
  ethers.parseEther('1'),    // 1 CGC per listen
  ethers.parseEther('5'),    // 5 CGC early bonus
  100,                       // First 100 listeners
  15000                      // 1.5x multiplier (basis points)
);
```

---

## Development

### How is the codebase structured?

```
mycelix-music/
├── contracts/          # Solidity smart contracts (Foundry)
├── packages/
│   └── sdk/           # TypeScript SDK for contract interaction
├── apps/
│   ├── api/           # Backend REST API (Express)
│   └── web/           # Frontend (Next.js)
├── docs/              # Documentation
└── scripts/           # Utility scripts
```

### What's the development workflow?

1. **Create branch:** `git checkout -b feature/my-feature`
2. **Make changes**
3. **Run tests:** `make test`
4. **Commit:** Follow [Conventional Commits](https://www.conventionalcommits.org/)
5. **Push:** `git push origin feature/my-feature`
6. **Open PR:** Use the PR template

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### How do I add a new API endpoint?

In `apps/api/src/index.ts`:

```typescript
// 1. Add input validation
app.post('/api/my-endpoint', async (req, res) => {
  // Validate
  if (!req.body.required_field) {
    return res.status(400).json({ error: 'Missing required_field' });
  }

  try {
    // 2. Process request
    const result = await pool.query('SELECT ...');

    // 3. Invalidate cache if needed
    await redis.del('cache:key');

    // 4. Return response
    res.json(result.rows);
  } catch (error) {
    logger.error('Error in my-endpoint', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### How do I add caching to an endpoint?

```typescript
app.get('/api/data', async (req, res) => {
  const cacheKey = 'data:all';

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Fetch from DB
  const result = await pool.query('SELECT * FROM table');

  // Cache for 60 seconds
  await redis.setEx(cacheKey, 60, JSON.stringify(result.rows));

  res.json(result.rows);
});
```

### What's the commit message format?

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(api): add song search endpoint
fix(contracts): resolve approval race condition
docs: update deployment guide
```

---

## Deployment

### How do I deploy to production?

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for comprehensive instructions.

**Quick overview:**
1. Deploy smart contracts to mainnet
2. Set up production database (PostgreSQL)
3. Set up Redis
4. Configure environment variables
5. Deploy API (PM2, Docker, or cloud platform)
6. Deploy frontend (Vercel, Netlify, or self-hosted)
7. Configure DNS and SSL

### What environment variables do I need?

**Backend API:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
RPC_URL=https://rpc.gnosischain.com
ROUTER_ADDRESS=0x...
FLOW_TOKEN_ADDRESS=0x...
```

**Frontend:**
```env
NEXT_PUBLIC_API_URL=https://api.mycelix.com
NEXT_PUBLIC_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=100
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
```

See `.env.example` for complete list.

### How do I handle database migrations?

Currently, database schema is created on API startup. For production migrations:

1. **Backup:** `make backup-production`
2. **Test migration locally**
3. **Apply to production:** Run SQL scripts manually
4. **Verify:** Check `/health` endpoint

Future: Automated migrations with Prisma or TypeORM.

### How do I monitor production?

**Health Checks:**
```bash
# Check API health
curl https://api.mycelix.com/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "dependencies": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**Logs:**
- Structured JSON logs to stdout
- Integrate with:
  - Datadog
  - New Relic
  - CloudWatch
  - Logtail

**Metrics:**
- Set up APM (Application Performance Monitoring)
- Monitor error rates, response times, throughput

---

## Troubleshooting

### Services won't start

```bash
# Check what's running
make docker-ps

# View logs
make docker-logs

# Restart everything
make docker-down && make docker-up
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check credentials in .env
cat .env | grep DATABASE_URL
```

### Contract deployment fails

**Common causes:**
1. **Insufficient funds:** Add ETH/xDAI to deployer wallet
2. **Wrong network:** Check RPC URL and chain ID
3. **Gas price too low:** Increase gas price in deployment script
4. **Anvil not running:** `anvil --block-time 1`

### API returns 429 (Too Many Requests)

**Cause:** Rate limiting (100 req/min per IP)

**Solutions:**
1. **Wait:** Rate limit resets every minute
2. **Clear limit:** `docker-compose exec redis redis-cli KEYS "ratelimit:*" | xargs docker-compose exec -T redis redis-cli DEL`
3. **Increase limit:** Modify rate limit in `apps/api/src/index.ts`

### Frontend can't connect to API

**Check:**
1. **API is running:** `curl http://localhost:3100/health`
2. **CORS configured:** API allows frontend origin
3. **Environment variable:** `NEXT_PUBLIC_API_URL` is correct
4. **Network:** Both on same network (Docker or localhost)

See [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) for more help.

---

## Security

### Is the platform secure?

Security measures implemented:

✅ **Smart Contracts:**
- Access control on configuration functions
- Approval race condition protection
- Comprehensive test coverage
- Slither static analysis

✅ **API:**
- Input validation on all endpoints
- Rate limiting (100 req/min)
- Security headers (XSS, clickjacking protection)
- Environment variable validation
- Graceful error handling

✅ **Infrastructure:**
- PostgreSQL connection pooling
- Redis cache isolation
- HTTPS in production
- Secrets management

### How do I report a security vulnerability?

See [SECURITY.md](./SECURITY.md) for responsible disclosure policy.

**DO:**
- Email security@mycelix.com (if available)
- Open a private security advisory on GitHub
- Provide detailed reproduction steps

**DON'T:**
- Open public issues for vulnerabilities
- Exploit vulnerabilities
- Share vulnerabilities publicly before patch

### Are there any known security issues?

Check [GitHub Security Advisories](https://github.com/luminous-dynamics/mycelix-music/security/advisories) for disclosed vulnerabilities and patches.

### How are private keys managed?

**Development:**
- Use `.env` file (gitignored)
- Never commit private keys
- Use test accounts only

**Production:**
- Use environment variables
- Use secret management service (AWS Secrets Manager, HashiCorp Vault)
- Use hardware wallets for critical operations
- Implement multi-sig for contract ownership

---

## Performance

### How fast is the platform?

**Typical response times:**
- Cached API calls: <50ms
- Uncached API calls: 100-200ms
- Smart contract calls: 1-3 seconds (blockchain confirmation)

**Database performance:**
- 7 strategic indexes for 10x query speed
- Redis caching reduces DB load by 60-80%

### How do I improve performance?

**Frontend:**
- Enable Next.js static generation
- Optimize images
- Code splitting
- CDN for static assets

**Backend:**
- Increase Redis cache TTL
- Add more database indexes
- Enable connection pooling
- Use read replicas for scaling

**Database:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM songs WHERE artist_address = '0x...';

-- Vacuum regularly
VACUUM ANALYZE;
```

### What's the caching strategy?

**Redis Cache:**
- `GET /api/songs` - 30 second TTL
- `GET /api/songs/:id` - 60 second TTL
- Automatic invalidation on mutations

**Browser Cache:**
- Static assets: 1 year
- API responses: No cache (fresh data)

---

## Additional Resources

### Documentation
- [QUICKSTART.md](./QUICKSTART.md) - Get started in 15 minutes
- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Production deployment
- [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) - Debugging help

### External Resources
- [Foundry Book](https://book.getfoundry.sh/) - Smart contract development
- [Next.js Docs](https://nextjs.org/docs) - Frontend framework
- [Gnosis Chain](https://docs.gnosischain.com/) - Blockchain network
- [Privy Docs](https://docs.privy.io/) - Wallet authentication

### Community
- GitHub Issues: [Report bugs](https://github.com/luminous-dynamics/mycelix-music/issues)
- Discussions: [Ask questions](https://github.com/luminous-dynamics/mycelix-music/discussions)

---

## Still have questions?

1. **Search documentation:** Check `/docs` directory
2. **Check existing issues:** [GitHub Issues](https://github.com/luminous-dynamics/mycelix-music/issues)
3. **Ask in discussions:** [GitHub Discussions](https://github.com/luminous-dynamics/mycelix-music/discussions)
4. **Open a new issue:** Include error messages, steps to reproduce, and environment info

---

**Last Updated:** 2025-01-15

*This FAQ is continuously updated based on common questions from the community.*
