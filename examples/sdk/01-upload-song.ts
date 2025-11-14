/**
 * Example 1: Upload a Song with SDK
 *
 * This example demonstrates how to:
 * 1. Connect to the Mycelix SDK
 * 2. Upload song metadata to IPFS
 * 3. Register song with economic strategy
 * 4. Configure revenue splits
 */

import { ethers } from 'ethers';
import { MycelixSDK } from '@mycelix/sdk';

async function main() {
  console.log('🎵 Mycelix SDK Example: Upload a Song\n');

  // =============================================================================
  // 1. Setup Provider and Signer
  // =============================================================================

  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || 'http://localhost:8545'
  );

  const artistWallet = new ethers.Wallet(
    process.env.ARTIST_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    provider
  );

  console.log('Artist Address:', artistWallet.address);

  // =============================================================================
  // 2. Initialize SDK
  // =============================================================================

  const sdk = new MycelixSDK({
    provider,
    signer: artistWallet,
    routerAddress: process.env.ROUTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    apiUrl: process.env.API_URL || 'http://localhost:3100',
  });

  console.log('✅ SDK initialized\n');

  // =============================================================================
  // 3. Prepare Song Metadata
  // =============================================================================

  const songMetadata = {
    title: 'Decentralized Dreams',
    artist: 'Alice Blockchain',
    album: 'Web3 Vibes',
    genre: 'Electronic',
    releaseDate: '2025-01-15',
    duration: 245, // seconds
    description: 'A journey through the decentralized future of music',
    coverArt: 'ipfs://QmExample...', // Already uploaded to IPFS
    audioFile: 'ipfs://QmExample...', // Already uploaded to IPFS
  };

  console.log('📝 Song Metadata:');
  console.log(JSON.stringify(songMetadata, null, 2));
  console.log('');

  // =============================================================================
  // 4. Choose Economic Strategy: Pay-Per-Stream
  // =============================================================================

  const economicModel = 'pay-per-stream';
  const pricePerStream = ethers.parseEther('0.01'); // 0.01 tokens per stream

  console.log('💰 Economic Model:', economicModel);
  console.log('💵 Price per stream:', ethers.formatEther(pricePerStream), 'tokens\n');

  // =============================================================================
  // 5. Configure Revenue Splits
  // =============================================================================

  // 60% to artist, 30% to producer, 10% to platform
  const recipients = [
    artistWallet.address,                                    // Artist
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',            // Producer (example)
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',            // Platform (example)
  ];

  const basisPoints = [
    6000,  // 60%
    3000,  // 30%
    1000,  // 10%
  ];

  const roles = [
    'artist',
    'producer',
    'platform',
  ];

  console.log('📊 Revenue Splits:');
  recipients.forEach((addr, i) => {
    console.log(`  ${roles[i]}: ${basisPoints[i] / 100}% → ${addr}`);
  });
  console.log('');

  // =============================================================================
  // 6. Upload Song
  // =============================================================================

  console.log('🚀 Uploading song...');

  try {
    const result = await sdk.uploadSong({
      metadata: songMetadata,
      economicModel,
      pricePerStream,
      royaltySplit: {
        recipients,
        basisPoints,
        roles,
      },
    });

    console.log('\n✅ Song uploaded successfully!');
    console.log('Song ID:', result.songId);
    console.log('Transaction Hash:', result.txHash);
    console.log('IPFS Hash:', result.ipfsHash);
    console.log('Strategy Address:', result.strategyAddress);

    // =============================================================================
    // 7. Verify Upload
    // =============================================================================

    console.log('\n🔍 Verifying upload...');

    const songDetails = await sdk.getSongDetails(result.songId);

    console.log('Song Details:');
    console.log('  Title:', songDetails.metadata.title);
    console.log('  Artist:', songDetails.metadata.artist);
    console.log('  Economic Model:', songDetails.economicModel);
    console.log('  Price:', ethers.formatEther(songDetails.price), 'tokens');
    console.log('  Play Count:', songDetails.playCount);

    console.log('\n🎉 Upload complete!');

  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    process.exit(1);
  }
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

/**
 * Expected Output:
 *
 * 🎵 Mycelix SDK Example: Upload a Song
 *
 * Artist Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 * ✅ SDK initialized
 *
 * 📝 Song Metadata:
 * {
 *   "title": "Decentralized Dreams",
 *   "artist": "Alice Blockchain",
 *   ...
 * }
 *
 * 💰 Economic Model: pay-per-stream
 * 💵 Price per stream: 0.01 tokens
 *
 * 📊 Revenue Splits:
 *   artist: 60% → 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *   producer: 30% → 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *   platform: 10% → 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
 *
 * 🚀 Uploading song...
 *
 * ✅ Song uploaded successfully!
 * Song ID: 0x1234...
 * Transaction Hash: 0xabcd...
 * IPFS Hash: QmExample...
 * Strategy Address: 0x5678...
 *
 * 🔍 Verifying upload...
 * Song Details:
 *   Title: Decentralized Dreams
 *   Artist: Alice Blockchain
 *   Economic Model: pay-per-stream
 *   Price: 0.01 tokens
 *   Play Count: 0
 *
 * 🎉 Upload complete!
 */
