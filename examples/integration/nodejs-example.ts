/**
 * Node.js Integration Example
 *
 * Example showing how to integrate Mycelix Music SDK into a Node.js backend
 * Use case: Building a music streaming service with custom royalty distribution
 */

import { ethers } from 'ethers';
import { MycelixSDK } from '@mycelix/sdk';

// ============================================================================
// Setup
// ============================================================================

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const sdk = new MycelixSDK({
  provider,
  signer: wallet,
  routerAddress: process.env.ROUTER_ADDRESS!,
  flowTokenAddress: process.env.FLOW_TOKEN_ADDRESS!,
});

// ============================================================================
// Example 1: Artist Uploads Song with Pay-Per-Stream
// ============================================================================

async function uploadSongWithPayPerStream() {
  console.log('Example 1: Upload song with pay-per-stream strategy\n');

  const artistAddress = await wallet.getAddress();

  // Configure royalty split
  const splits = [
    {
      recipient: artistAddress,
      basisPoints: 7000, // 70%
      role: 'artist',
    },
    {
      recipient: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Producer
      basisPoints: 2000, // 20%
      role: 'producer',
    },
    {
      recipient: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', // Platform
      basisPoints: 1000, // 10%
      role: 'platform',
    },
  ];

  // Upload song
  const tx = await sdk.uploadSong({
    songId: 'song-123',
    strategyId: 'pay-per-stream',
    metadata: {
      title: 'Blockchain Symphony',
      artist: 'Crypto Composer',
      duration: 240, // 4 minutes
      genre: 'Electronic',
    },
    ipfsHash: 'QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    price: ethers.utils.parseEther('0.01'), // 0.01 FLOW per play
    splits,
  });

  await tx.wait();
  console.log(`✓ Song uploaded with transaction: ${tx.hash}\n`);
}

// ============================================================================
// Example 2: Listener Plays Song
// ============================================================================

async function playSong() {
  console.log('Example 2: Play song and process payment\n');

  const listenerAddress = await wallet.getAddress();

  // Get song details
  const song = await sdk.getSong('song-123');
  console.log(`Playing: ${song.metadata.title} by ${song.metadata.artist}`);
  console.log(`Price: ${ethers.utils.formatEther(song.price)} FLOW\n`);

  // Approve FLOW token spending
  const approveTx = await sdk.approveToken(song.price);
  await approveTx.wait();
  console.log('✓ Token approval confirmed\n');

  // Process payment (play song)
  const playTx = await sdk.play('song-123', {
    listener: listenerAddress,
  });

  const receipt = await playTx.wait();
  console.log(`✓ Payment processed: ${playTx.hash}`);
  console.log(`  Gas used: ${receipt.gasUsed.toString()}\n`);

  // Get updated stats
  const stats = await sdk.getSongStats('song-123');
  console.log('Updated song stats:');
  console.log(`  Total plays: ${stats.playCount}`);
  console.log(`  Total earnings: ${ethers.utils.formatEther(stats.totalEarnings)} FLOW\n`);
}

// ============================================================================
// Example 3: Gift Economy Strategy
// ============================================================================

async function uploadWithGiftEconomy() {
  console.log('Example 3: Upload song with gift economy strategy\n');

  const artistAddress = await wallet.getAddress();

  const tx = await sdk.uploadSong({
    songId: 'song-456',
    strategyId: 'gift-economy',
    metadata: {
      title: 'Free Culture Anthem',
      artist: 'Commons Creator',
      duration: 180,
      genre: 'Folk',
    },
    ipfsHash: 'QmYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
    giftEconomyConfig: {
      artistAddress,
      cgcPerListen: ethers.utils.parseEther('1'), // 1 CGC per listen
      earlyListenerBonus: ethers.utils.parseEther('0.5'), // 0.5 extra CGC
      earlyListenerThreshold: 1000, // First 1000 listeners
      repeatListenerMultiplier: 15000, // 1.5x multiplier (10000 = 1x)
    },
  });

  await tx.wait();
  console.log(`✓ Song uploaded with gift economy: ${tx.hash}\n`);
}

// ============================================================================
// Example 4: Query Artist Stats
// ============================================================================

async function getArtistStats() {
  console.log('Example 4: Query artist statistics\n');

  const artistAddress = await wallet.getAddress();

  // Get all songs by artist
  const songs = await sdk.getArtistSongs(artistAddress);
  console.log(`Artist has ${songs.length} songs:\n`);

  let totalEarnings = ethers.BigNumber.from(0);
  let totalPlays = 0;

  for (const song of songs) {
    const stats = await sdk.getSongStats(song.songId);
    console.log(`${song.metadata.title}:`);
    console.log(`  Plays: ${stats.playCount}`);
    console.log(`  Earnings: ${ethers.utils.formatEther(stats.totalEarnings)} FLOW`);
    console.log(`  Strategy: ${song.strategyId}\n`);

    totalEarnings = totalEarnings.add(stats.totalEarnings);
    totalPlays += stats.playCount;
  }

  console.log('Total Artist Stats:');
  console.log(`  Total plays: ${totalPlays}`);
  console.log(`  Total earnings: ${ethers.utils.formatEther(totalEarnings)} FLOW\n`);
}

// ============================================================================
// Example 5: Listen to Events
// ============================================================================

async function listenToEvents() {
  console.log('Example 5: Listen to blockchain events\n');

  // Listen for new song uploads
  sdk.on('SongUploaded', (songId, artist, strategyId, event) => {
    console.log('New song uploaded:');
    console.log(`  Song ID: ${songId}`);
    console.log(`  Artist: ${artist}`);
    console.log(`  Strategy: ${strategyId}`);
    console.log(`  Block: ${event.blockNumber}\n`);
  });

  // Listen for plays
  sdk.on('Play', (songId, listener, amount, event) => {
    console.log('Song played:');
    console.log(`  Song ID: ${songId}`);
    console.log(`  Listener: ${listener}`);
    console.log(`  Amount: ${ethers.utils.formatEther(amount)} FLOW`);
    console.log(`  Block: ${event.blockNumber}\n`);
  });

  // Listen for payments
  sdk.on('PaymentProcessed', (songId, recipient, amount, event) => {
    console.log('Payment processed:');
    console.log(`  Song ID: ${songId}`);
    console.log(`  Recipient: ${recipient}`);
    console.log(`  Amount: ${ethers.utils.formatEther(amount)} FLOW\n`);
  });

  console.log('Listening for events... (Press Ctrl+C to stop)\n');

  // Keep process running
  await new Promise(() => {});
}

// ============================================================================
// Example 6: Batch Operations
// ============================================================================

async function batchOperations() {
  console.log('Example 6: Batch operations for efficiency\n');

  const artistAddress = await wallet.getAddress();

  // Upload multiple songs in sequence
  const songIds = ['song-batch-1', 'song-batch-2', 'song-batch-3'];

  console.log('Uploading 3 songs...\n');

  for (let i = 0; i < songIds.length; i++) {
    const tx = await sdk.uploadSong({
      songId: songIds[i],
      strategyId: 'pay-per-stream',
      metadata: {
        title: `Batch Song ${i + 1}`,
        artist: 'Batch Artist',
        duration: 200,
        genre: 'Test',
      },
      ipfsHash: `QmBatch${i}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`,
      price: ethers.utils.parseEther('0.005'),
      splits: [
        { recipient: artistAddress, basisPoints: 10000, role: 'artist' },
      ],
    });

    await tx.wait();
    console.log(`✓ Uploaded ${songIds[i]}`);
  }

  console.log('\n✓ All songs uploaded\n');
}

// ============================================================================
// Example 7: Error Handling
// ============================================================================

async function errorHandlingExample() {
  console.log('Example 7: Proper error handling\n');

  try {
    // Try to play a song that doesn't exist
    await sdk.play('non-existent-song', {
      listener: await wallet.getAddress(),
    });
  } catch (error: any) {
    if (error.code === 'CALL_EXCEPTION') {
      console.log('✓ Caught contract error: Song does not exist');
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('✓ Caught error: Insufficient balance');
    } else {
      console.log(`Unexpected error: ${error.message}`);
    }
  }

  try {
    // Try to upload with invalid splits
    await sdk.uploadSong({
      songId: 'invalid-splits',
      strategyId: 'pay-per-stream',
      metadata: { title: 'Test', artist: 'Test', duration: 100, genre: 'Test' },
      ipfsHash: 'QmTest',
      price: ethers.utils.parseEther('0.01'),
      splits: [
        { recipient: await wallet.getAddress(), basisPoints: 5000, role: 'artist' }, // Only 50%!
      ],
    });
  } catch (error: any) {
    console.log('✓ Caught validation error: Splits must sum to 100%\n');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Mycelix Music SDK - Node.js Integration Examples');
  console.log('='.repeat(60));
  console.log('\n');

  try {
    // Run examples
    await uploadSongWithPayPerStream();
    await playSong();
    await uploadWithGiftEconomy();
    await getArtistStats();
    await batchOperations();
    await errorHandlingExample();

    // Uncomment to listen to events (runs indefinitely)
    // await listenToEvents();

    console.log('='.repeat(60));
    console.log('All examples completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export {
  uploadSongWithPayPerStream,
  playSong,
  uploadWithGiftEconomy,
  getArtistStats,
  listenToEvents,
  batchOperations,
  errorHandlingExample,
};
