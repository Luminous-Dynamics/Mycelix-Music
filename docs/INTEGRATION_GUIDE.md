# 🔌 Integration Guide

Complete guide for integrating Mycelix Music into your applications.

## Table of Contents

1. [Quick Start](#quick-start)
2. [SDK Installation](#sdk-installation)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [Smart Contract Integration](#smart-contract-integration)
6. [API Integration](#api-integration)
7. [IPFS Integration](#ipfs-integration)
8. [Testing](#testing)
9. [Examples](#examples)

---

## Quick Start

### 5-Minute Integration

Get started with Mycelix Music in 5 minutes:

```bash
# 1. Install SDK
npm install @mycelix/sdk ethers@5

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Run example
ts-node examples/integration/nodejs-example.ts
```

---

## SDK Installation

### NPM Package

```bash
npm install @mycelix/sdk ethers@5
```

### Yarn

```bash
yarn add @mycelix/sdk ethers@5
```

### Peer Dependencies

The SDK requires:
- `ethers@^5.7.0` - Ethereum library
- `@privy-io/react-auth@^1.0.0` (for React apps) - Wallet authentication

---

## Backend Integration

### Node.js/Express Setup

**1. Initialize SDK:**

```typescript
import { ethers } from 'ethers';
import { MycelixSDK } from '@mycelix/sdk';

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const sdk = new MycelixSDK({
  provider,
  signer: wallet,
  routerAddress: process.env.ROUTER_ADDRESS!,
  flowTokenAddress: process.env.FLOW_TOKEN_ADDRESS!,
});
```

**2. Upload Song:**

```typescript
app.post('/api/songs/upload', async (req, res) => {
  const { songId, metadata, ipfsHash, price } = req.body;

  try {
    const tx = await sdk.uploadSong({
      songId,
      strategyId: 'pay-per-stream',
      metadata,
      ipfsHash,
      price: ethers.utils.parseEther(price),
      splits: [
        { recipient: req.user.address, basisPoints: 10000, role: 'artist' },
      ],
    });

    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**3. Process Play:**

```typescript
app.post('/api/songs/:songId/play', async (req, res) => {
  const { songId } = req.params;
  const listener = req.user.address;

  try {
    const tx = await sdk.play(songId, { listener });
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### NestJS Setup

```typescript
import { Injectable } from '@nestjs/common';
import { MycelixSDK } from '@mycelix/sdk';

@Injectable()
export class MycelixService {
  private sdk: MycelixSDK;

  constructor() {
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    this.sdk = new MycelixSDK({
      provider,
      signer: wallet,
      routerAddress: process.env.ROUTER_ADDRESS!,
      flowTokenAddress: process.env.FLOW_TOKEN_ADDRESS!,
    });
  }

  async uploadSong(dto: UploadSongDto) {
    return await this.sdk.uploadSong(dto);
  }

  async playSong(songId: string, listener: string) {
    return await this.sdk.play(songId, { listener });
  }
}
```

---

## Frontend Integration

### React + Next.js

**1. Create Mycelix Hook:**

```typescript
// hooks/useMycelix.ts
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { MycelixSDK } from '@mycelix/sdk';
import { ethers } from 'ethers';

export function useMycelix() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [sdk, setSdk] = useState<MycelixSDK | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated || !wallets[0]) return;

    const initSDK = async () => {
      const wallet = wallets[0];
      const provider = await wallet.getEthersProvider();
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      const mycelixSDK = new MycelixSDK({
        provider,
        signer,
        routerAddress: process.env.NEXT_PUBLIC_ROUTER_ADDRESS!,
        flowTokenAddress: process.env.NEXT_PUBLIC_FLOW_TOKEN_ADDRESS!,
      });

      setSdk(mycelixSDK);
      setAddress(address);
    };

    initSDK();
  }, [authenticated, wallets]);

  return { sdk, address, authenticated };
}
```

**2. Use in Components:**

```typescript
import { useMycelix } from '@/hooks/useMycelix';

function MyComponent() {
  const { sdk, address } = useMycelix();

  const handleUpload = async () => {
    if (!sdk) return;

    const tx = await sdk.uploadSong({
      // ... song data
    });

    await tx.wait();
  };

  return <button onClick={handleUpload}>Upload Song</button>;
}
```

### Vue.js

```typescript
// composables/useMycelix.ts
import { ref, onMounted } from 'vue';
import { MycelixSDK } from '@mycelix/sdk';

export function useMycelix() {
  const sdk = ref<MycelixSDK | null>(null);
  const address = ref<string | null>(null);

  onMounted(async () => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();

      sdk.value = new MycelixSDK({
        provider,
        signer,
        routerAddress: process.env.VUE_APP_ROUTER_ADDRESS!,
        flowTokenAddress: process.env.VUE_APP_FLOW_TOKEN_ADDRESS!,
      });

      address.value = await signer.getAddress();
    }
  });

  return { sdk, address };
}
```

---

## Smart Contract Integration

### Direct Contract Calls

If you prefer to interact with contracts directly (without SDK):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@mycelix/contracts/interfaces/IEconomicStrategyRouter.sol";

contract MyMusicApp {
    IEconomicStrategyRouter public router;

    constructor(address _router) {
        router = IEconomicStrategyRouter(_router);
    }

    function uploadSong(
        string calldata songId,
        bytes32 strategyId,
        bytes calldata metadata
    ) external {
        router.uploadSong(songId, strategyId, metadata);
    }

    function playSong(string calldata songId) external payable {
        router.play(songId, msg.sender);
    }
}
```

### Using Hardhat

```typescript
import { ethers } from 'hardhat';

async function main() {
  const router = await ethers.getContractAt(
    'EconomicStrategyRouter',
    process.env.ROUTER_ADDRESS!
  );

  const tx = await router.uploadSong(
    'song-123',
    ethers.utils.formatBytes32String('pay-per-stream'),
    ethers.utils.toUtf8Bytes('metadata')
  );

  await tx.wait();
}
```

---

## API Integration

### REST API

The Mycelix API provides a REST interface:

**Base URL:** `https://api.mycelix.com` (or your deployed instance)

**Endpoints:**

```bash
# Get all songs
GET /api/songs

# Get song by ID
GET /api/songs/:songId

# Search songs
GET /api/songs/search?q=query

# Get artist songs
GET /api/artists/:address/songs

# Get song stats
GET /api/songs/:songId/stats

# Record play (requires authentication)
POST /api/songs/:songId/play
```

**Example with Fetch:**

```typescript
// Search for songs
const response = await fetch('https://api.mycelix.com/api/songs/search?q=electronic');
const songs = await response.json();

// Get song details
const song = await fetch(`https://api.mycelix.com/api/songs/${songId}`);
const songData = await song.json();
```

**Example with Axios:**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.mycelix.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Search songs
const { data: songs } = await api.get('/api/songs/search', {
  params: { q: 'electronic' },
});

// Upload song
const { data } = await api.post('/api/songs/upload', {
  songId: 'song-123',
  metadata: { title: 'My Song', artist: 'Artist' },
  // ...
});
```

---

## IPFS Integration

### Upload to IPFS

**Using Web3.Storage:**

```typescript
import { Web3Storage } from 'web3.storage';

const client = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN! });

async function uploadToIPFS(file: File): Promise<string> {
  const cid = await client.put([file]);
  return cid; // Returns IPFS hash
}
```

**Using Pinata:**

```typescript
import pinataSDK from '@pinata/sdk';

const pinata = pinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_SECRET_API_KEY!
);

async function uploadToIPFS(file: Buffer, filename: string): Promise<string> {
  const result = await pinata.pinFileToIPFS(file, {
    pinataMetadata: {
      name: filename,
    },
  });

  return result.IpfsHash;
}
```

### Retrieve from IPFS

```typescript
// Using HTTP gateway
const audioUrl = `https://ipfs.io/ipfs/${ipfsHash}`;

// Or use Cloudflare gateway
const audioUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;

// In React component
<audio src={audioUrl} controls />
```

---

## Testing

### Unit Tests

```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MycelixSDK } from '@mycelix/sdk';

describe('Mycelix Integration', () => {
  let sdk: MycelixSDK;
  let artist: any;

  beforeEach(async () => {
    [artist] = await ethers.getSigners();

    sdk = new MycelixSDK({
      provider: ethers.provider,
      signer: artist,
      routerAddress: process.env.ROUTER_ADDRESS!,
      flowTokenAddress: process.env.FLOW_TOKEN_ADDRESS!,
    });
  });

  it('should upload a song', async () => {
    const tx = await sdk.uploadSong({
      songId: 'test-song',
      strategyId: 'pay-per-stream',
      metadata: { title: 'Test', artist: 'Test', duration: 100, genre: 'Test' },
      ipfsHash: 'QmTest',
      price: ethers.utils.parseEther('0.01'),
      splits: [
        { recipient: artist.address, basisPoints: 10000, role: 'artist' },
      ],
    });

    await tx.wait();
    expect(tx.hash).to.be.a('string');
  });
});
```

### Integration Tests

```typescript
import { test, expect } from '@playwright/test';

test('complete upload and play flow', async ({ page }) => {
  // Connect wallet
  await page.goto('/');
  await page.click('button:has-text("Connect Wallet")');

  // Upload song
  await page.click('text=Upload');
  await page.fill('input[name="title"]', 'Test Song');
  await page.fill('input[name="artist"]', 'Test Artist');
  await page.setInputFiles('input[type="file"]', 'test-audio.mp3');
  await page.click('button:has-text("Upload")');

  await expect(page.locator('text=Upload successful')).toBeVisible();

  // Play song
  await page.click('button:has-text("Play")');
  await expect(page.locator('audio')).toBeVisible();
});
```

---

## Examples

### Complete Examples

We provide complete, working examples:

1. **Node.js Backend Example** (`examples/integration/nodejs-example.ts`)
   - Upload songs
   - Process plays
   - Query stats
   - Listen to events
   - Batch operations
   - Error handling

2. **React Frontend Example** (`examples/integration/react-example.tsx`)
   - Wallet connection
   - Song upload component
   - Music player
   - Artist dashboard
   - Search & discovery

### Run Examples

```bash
# Node.js example
cd examples/integration
npm install
ts-node nodejs-example.ts

# React example
cd apps/web
npm run dev
# Components are in examples/integration/react-example.tsx
```

---

## Best Practices

### 1. Error Handling

Always wrap SDK calls in try-catch:

```typescript
try {
  const tx = await sdk.uploadSong(data);
  await tx.wait();
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    // Handle insufficient balance
  } else if (error.code === 'CALL_EXCEPTION') {
    // Handle contract error
  } else {
    // Handle other errors
  }
}
```

### 2. Transaction Confirmation

Always wait for transaction confirmation:

```typescript
const tx = await sdk.uploadSong(data);
const receipt = await tx.wait(); // Wait for confirmation
console.log(`Confirmed in block ${receipt.blockNumber}`);
```

### 3. Gas Estimation

Estimate gas before sending transactions:

```typescript
const gasEstimate = await sdk.estimateGas.uploadSong(data);
const gasPrice = await provider.getGasPrice();
const totalCost = gasEstimate.mul(gasPrice);
console.log(`Estimated cost: ${ethers.utils.formatEther(totalCost)} ETH`);
```

### 4. Event Listening

Listen to events for real-time updates:

```typescript
sdk.on('SongUploaded', (songId, artist, strategyId) => {
  console.log(`New song: ${songId} by ${artist}`);
  // Update UI, send notification, etc.
});
```

### 5. Caching

Cache frequently accessed data:

```typescript
const cache = new Map();

async function getSong(songId: string) {
  if (cache.has(songId)) {
    return cache.get(songId);
  }

  const song = await sdk.getSong(songId);
  cache.set(songId, song);
  return song;
}
```

---

## Troubleshooting

### Common Issues

**1. "insufficient funds" error:**
- Ensure wallet has enough FLOW tokens
- Check gas token (ETH, MATIC, etc.) balance

**2. "execution reverted" error:**
- Check contract call parameters
- Verify splits sum to 10000 basis points
- Ensure song ID is unique

**3. IPFS upload slow:**
- Use a dedicated IPFS pinning service (Pinata, Web3.Storage)
- Consider using a local IPFS node

**4. Wallet not connecting:**
- Ensure correct network is selected
- Check Privy configuration
- Verify app permissions

### Debug Mode

Enable debug logging:

```typescript
const sdk = new MycelixSDK({
  // ... config
  debug: true, // Enable debug logs
});
```

---

## Support

- **Documentation**: https://docs.mycelix.com
- **Discord**: https://discord.gg/mycelix
- **GitHub Issues**: https://github.com/Luminous-Dynamics/Mycelix-Music/issues
- **Email**: support@mycelix.com

---

**Last Updated**: 2025-11-15
