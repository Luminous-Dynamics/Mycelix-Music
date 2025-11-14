# 📚 Mycelix Music - Code Examples

This directory contains working code examples demonstrating various features and use cases of the Mycelix Music platform.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Smart Contract Examples](#smart-contract-examples)
- [SDK Examples](#sdk-examples)
- [API Examples](#api-examples)
- [Frontend Examples](#frontend-examples)
- [Integration Examples](#integration-examples)

---

## Basic Usage

### Quick Start Example

```bash
# Clone and setup
git clone https://github.com/luminous-dynamics/mycelix-music.git
cd mycelix-music
make setup

# Start development
make dev
```

---

## Smart Contract Examples

### 1. Deploy and Configure Pay-Per-Stream

See: [`01-deploy-pay-per-stream.js`](./contracts/01-deploy-pay-per-stream.js)

**What it does:**
- Deploys the router and pay-per-stream strategy
- Registers a song with fixed price
- Configures royalty splits

**Run it:**
```bash
node examples/contracts/01-deploy-pay-per-stream.js
```

### 2. Deploy Gift Economy Strategy

See: [`02-deploy-gift-economy.js`](./contracts/02-deploy-gift-economy.js)

**What it does:**
- Deploys gift economy strategy
- Configures CGC rewards
- Sets up early supporter bonuses

**Run it:**
```bash
node examples/contracts/02-deploy-gift-economy.js
```

### 3. Process a Stream Payment

See: [`03-process-stream.js`](./contracts/03-process-stream.js)

**What it does:**
- Simulates a listener playing a song
- Processes payment through router
- Shows split distribution

**Run it:**
```bash
node examples/contracts/03-process-stream.js
```

---

## SDK Examples

### 1. Upload a Song with SDK

See: [`01-upload-song.ts`](./sdk/01-upload-song.ts)

**What it does:**
- Uses SDK to upload song metadata
- Registers song with economic strategy
- Configures revenue splits

**Run it:**
```bash
npx ts-node examples/sdk/01-upload-song.ts
```

### 2. Listen to a Song

See: [`02-listen-to-song.ts`](./sdk/02-listen-to-song.ts)

**What it does:**
- Fetches song metadata
- Processes payment
- Updates play count

**Run it:**
```bash
npx ts-node examples/sdk/02-listen-to-song.ts
```

### 3. Claim Artist Earnings

See: [`03-claim-earnings.ts`](./sdk/03-claim-earnings.ts)

**What it does:**
- Checks artist balance
- Claims accumulated earnings
- Shows transaction receipt

**Run it:**
```bash
npx ts-node examples/sdk/03-claim-earnings.ts
```

### 4. Query Listener Stats

See: [`04-listener-stats.ts`](./sdk/04-listener-stats.ts)

**What it does:**
- Gets listener profile
- Shows CGC balance
- Displays listening history

**Run it:**
```bash
npx ts-node examples/sdk/04-listener-stats.ts
```

---

## API Examples

### 1. Upload Song via API

See: [`01-upload-song-api.sh`](./api/01-upload-song-api.sh)

**What it does:**
- Posts song metadata to API
- Stores in database
- Returns song ID

**Run it:**
```bash
bash examples/api/01-upload-song-api.sh
```

### 2. Search Songs

See: [`02-search-songs.sh`](./api/02-search-songs.sh)

**What it does:**
- Queries songs by genre, artist, or model
- Demonstrates filtering
- Shows pagination

**Run it:**
```bash
bash examples/api/02-search-songs.sh
```

### 3. Track Play Event

See: [`03-track-play.sh`](./api/03-track-play.sh)

**What it does:**
- Records play event
- Updates analytics
- Returns confirmation

**Run it:**
```bash
bash examples/api/03-track-play.sh
```

---

## Frontend Examples

### 1. Artist Upload Flow

See: [`01-artist-upload-flow.tsx`](./frontend/01-artist-upload-flow.tsx)

**What it does:**
- Complete upload wizard component
- Economic strategy selector
- Form validation and submission

**Usage:**
```tsx
import ArtistUploadFlow from './examples/frontend/01-artist-upload-flow';

function MyPage() {
  return <ArtistUploadFlow />;
}
```

### 2. Music Player Component

See: [`02-music-player.tsx`](./frontend/02-music-player.tsx)

**What it does:**
- Audio player with controls
- Payment integration
- Play count tracking

**Usage:**
```tsx
import MusicPlayer from './examples/frontend/02-music-player';

function SongPage() {
  return <MusicPlayer songId="0x..." />;
}
```

### 3. Artist Dashboard

See: [`03-artist-dashboard.tsx`](./frontend/03-artist-dashboard.tsx)

**What it does:**
- Shows artist's songs
- Displays earnings
- Analytics charts

**Usage:**
```tsx
import ArtistDashboard from './examples/frontend/03-artist-dashboard';

function DashboardPage() {
  return <ArtistDashboard artistAddress="0x..." />;
}
```

---

## Integration Examples

### 1. Custom Economic Strategy

See: [`01-custom-strategy.sol`](./integration/01-custom-strategy.sol)

**What it does:**
- Implements `IEconomicStrategy`
- Custom pricing logic (dynamic pricing based on demand)
- Revenue distribution

### 2. Third-Party Platform Integration

See: [`02-external-platform.ts`](./integration/02-external-platform.ts)

**What it does:**
- Integrates Mycelix with external music platform
- Syncs play counts
- Handles cross-platform payments

### 3. Analytics Integration

See: [`03-analytics-integration.ts`](./integration/03-analytics-integration.ts)

**What it does:**
- Sends events to analytics service
- Tracks user behavior
- Generates reports

---

## Running Examples

### Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Start local services
make docker-up

# 3. Deploy contracts locally
make contracts-deploy-local

# 4. Set environment variables
cp .env.example .env
# Edit .env with your values
```

### Run All Examples

```bash
# Smart contracts
cd examples/contracts
npm run examples

# SDK
cd examples/sdk
npm run examples

# API (requires running API)
cd examples/api
./run-all.sh

# Frontend (requires running frontend)
cd examples/frontend
npm run dev
```

---

## Example Structure

Each example follows this structure:

```
example-name/
├── README.md          # Detailed explanation
├── index.ts           # Main code
├── package.json       # Dependencies (if standalone)
└── .env.example       # Required environment variables
```

---

## Contributing Examples

Have a great example to share? Please contribute!

1. Create a new directory under the appropriate category
2. Include a README with:
   - What the example does
   - Prerequisites
   - Step-by-step instructions
   - Expected output
3. Make sure it runs successfully
4. Open a PR

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/luminous-dynamics/mycelix-music/issues)
- **Discussions:** [GitHub Discussions](https://github.com/luminous-dynamics/mycelix-music/discussions)
- **Documentation:** [/docs](../docs/)

---

**Happy coding!** 🎵
