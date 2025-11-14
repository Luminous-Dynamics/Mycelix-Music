# Mycelix Music - Architecture Overview

This document provides a high-level overview of the Mycelix Music platform architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Discover   │  │    Upload    │  │  Dashboard   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │                  │                  │                 │
│          └──────────────────┴──────────────────┘                │
│                            │                                      │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                  │
         ┌──────────▼────────┐  ┌─────▼──────────┐
         │   Backend API     │  │  Smart         │
         │   (Express)       │  │  Contracts     │
         │                   │  │  (Solidity)    │
         │  ┌──────────┐    │  │                 │
         │  │PostgreSQL│    │  │  Router ────┐  │
         │  └──────────┘    │  │      │      │  │
         │  ┌──────────┐    │  │  ┌───▼───┐ │  │
         │  │  Redis   │    │  │  │Strategy│ │  │
         │  └──────────┘    │  │  │   1    │ │  │
         └──────────────────┘  │  └────────┘ │  │
                               │  ┌────────┐ │  │
                               │  │Strategy│◄┘  │
                               │  │   2    │    │
                               │  └────────┘    │
                               └─────────────────┘
```

## Core Components

### 1. Smart Contracts (Blockchain Layer)

**Location**: `contracts/src/`

#### EconomicStrategyRouter
- **Purpose**: Routes payments to appropriate strategy contracts
- **Key Features**:
  - Song registration with strategy assignment
  - Protocol fee collection (1% default)
  - Payment routing and history tracking
  - Strategy swapping support

#### PayPerStreamStrategy
- **Purpose**: Traditional pay-per-stream model ($0.01/stream)
- **Key Features**:
  - Configurable royalty splits
  - Instant payment distribution
  - Multi-recipient support
  - Basis points precision (10000 = 100%)

#### GiftEconomyStrategy
- **Purpose**: Free listening with listener rewards
- **Key Features**:
  - CGC token rewards for listeners
  - Early listener bonuses
  - Repeat listener multipliers
  - Voluntary tipping support
  - Commons Charter integration

### 2. TypeScript SDK

**Location**: `packages/sdk/src/`

#### Purpose
- Provides high-level API for contract interaction
- Abstracts web3 complexity
- Type-safe interfaces throughout

#### Key Features
- Song registration
- Payment processing
- Batch operations (gas optimization)
- Payment preview
- Strategy configuration

### 3. Backend API

**Location**: `apps/api/src/`

#### Technology Stack
- Express.js (REST API)
- PostgreSQL (catalog database)
- Redis (caching layer)
- TypeScript (type safety)

#### Key Features
- **Catalog Indexing**: Fast song lookup without blockchain queries
- **Caching**: 60-80% reduction in database load
- **Rate Limiting**: DDoS protection (100 req/min)
- **Health Monitoring**: Dependency status checking
- **Input Validation**: Comprehensive validation on all endpoints
- **Structured Logging**: JSON logs for aggregation

#### Endpoints
- `/health` - Health check with dependency status
- `/api/songs` - Song CRUD operations
- `/api/songs/:id/play` - Play recording
- `/api/artists/:address/stats` - Artist statistics
- `/api/upload-to-ipfs` - IPFS file upload
- `/api/create-dkg-claim` - Ceramic DKG claims

### 4. Frontend Application

**Location**: `apps/web/`

#### Technology Stack
- Next.js 14 (React framework)
- TypeScript (type safety)
- Tailwind CSS (styling)
- Privy (wallet authentication)
- ethers.js (blockchain interaction)
- Framer Motion (animations)

#### Key Pages
- **Discover**: Browse and stream music
- **Upload**: Multi-step artist onboarding
- **Dashboard**: Analytics and earnings
- **Artist Profile**: Artist showcase

## Data Flow

### Song Upload Flow

```
Artist → Frontend → IPFS Upload → Backend API → Smart Contract
                                       ↓
                              Store in PostgreSQL
                                       ↓
                              Create DKG Claim (Ceramic)
```

### Streaming Flow

```
Listener → Frontend → Smart Contract Payment
                            ↓
                     Router (fee collection)
                            ↓
                     Strategy Contract
                            ↓
                     Distribute to Recipients
                            ↓
                     Backend API (record play)
                            ↓
                     Update PostgreSQL stats
```

## Security Architecture

### Smart Contract Security
- **Access Control**: Only song artists can configure strategies
- **Reentrancy Guards**: All payment functions protected
- **Approval Safety**: ERC20 approval race condition prevention
- **Input Validation**: Comprehensive parameter checking
- **Immutable Core**: Router and strategies are immutable post-deployment

### API Security
- **Rate Limiting**: 100 requests per minute per IP
- **Input Validation**: All inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries only
- **Security Headers**: XSS, clickjacking, MIME sniffing protection
- **Environment Validation**: Required variables checked on startup

### Infrastructure Security
- **SSL/TLS**: All production traffic encrypted
- **Secrets Management**: Environment variables, never committed
- **Database Security**: Connection pooling, parameterized queries
- **Cache Security**: Redis protected by authentication

## Performance Optimizations

### Database
- **7 Strategic Indexes**: 10x faster queries
  - Artist address, genre, payment model
  - Created date, play history, timestamps

### Caching
- **Redis Layer**: 60-80% reduction in database queries
  - Song list: 30s TTL
  - Individual songs: 60s TTL
  - Automatic invalidation on mutations

### Blockchain
- **Batch Operations**: Gas-optimized batch payments
- **Event Indexing**: Off-chain event processing
- **View Functions**: Free data reads without gas

## Scalability Considerations

### Horizontal Scaling
- **API**: Stateless design allows multiple instances
- **Database**: Connection pooling with read replicas
- **Redis**: Cluster mode for high availability
- **Frontend**: CDN distribution for static assets

### Vertical Scaling
- **Database**: Optimized indexes and queries
- **Cache**: In-memory for fastest access
- **API**: Async/await for concurrent processing

## Deployment Architecture

### Development
```
Local Machine
  ├── Anvil (local blockchain)
  ├── PostgreSQL (Docker)
  ├── Redis (Docker)
  ├── API (localhost:3100)
  └── Frontend (localhost:3000)
```

### Production
```
Cloud Infrastructure
  ├── Smart Contracts (Gnosis Chain)
  ├── API Servers (Load Balanced)
  ├── PostgreSQL (Managed Service)
  ├── Redis (Managed Service)
  ├── Frontend (CDN + Edge Functions)
  └── IPFS (Pinning Service)
```

## Technology Decisions

### Why Gnosis Chain?
- EVM-compatible (easy migration)
- Low transaction fees (~$0.001)
- Fast block times (5 seconds)
- Secure and established network

### Why PostgreSQL?
- Excellent indexing capabilities
- JSON support for flexible schemas
- Mature and battle-tested
- Strong TypeScript ecosystem

### Why Redis?
- Extremely fast in-memory storage
- Perfect for caching
- Pub/sub for real-time features
- Simple key-value operations

### Why Next.js?
- Server-side rendering for SEO
- File-based routing
- API routes for serverless functions
- Excellent developer experience
- Strong TypeScript support

## Future Architecture Plans

### Phase 2: Advanced Features
- **Patronage Strategy**: Monthly subscription model
- **NFT Gating**: Token-gated access
- **Collaborative Playlists**: Multi-curator playlists
- **Social Features**: Comments, likes, sharing

### Phase 3: Decentralization
- **IPFS Integration**: Full decentralized storage
- **Ceramic Network**: Decentralized knowledge graph
- **Holochain**: Agent-centric architecture
- **Decentralized Identity**: DID-based authentication

### Phase 4: Advanced Economics
- **Custom Strategy Builder**: No-code strategy creation
- **Yield Farming**: Staking rewards for listeners
- **DAO Governance**: Community-driven platform decisions
- **Cross-Chain**: Multi-blockchain support

## Monitoring & Observability

### Logging
- Structured JSON logs
- Centralized log aggregation
- Error tracking and alerting
- Performance metrics

### Metrics
- API response times
- Cache hit rates
- Database query performance
- Smart contract gas usage
- User engagement analytics

### Alerting
- Health check failures
- Error rate thresholds
- Performance degradation
- Security incidents

## Development Workflow

### Local Development
1. Start services (Docker Compose)
2. Deploy contracts (Anvil)
3. Start API server
4. Start frontend dev server
5. Hot reload on changes

### CI/CD Pipeline
1. Lint and format check
2. Run tests (Foundry, Jest)
3. Build applications
4. Run integration tests
5. Deploy to staging
6. Manual approval
7. Deploy to production

## Further Reading

- [Smart Contract Details](./docs/architecture/contracts.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Security Best Practices](./SECURITY.md)

---

For questions or clarifications, please open an issue or discussion on GitHub.
