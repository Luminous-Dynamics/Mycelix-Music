/**
 * Example 2: Listen to a Song
 *
 * This example demonstrates how to:
 * 1. Fetch song details
 * 2. Approve token payment
 * 3. Process a stream payment
 * 4. Track play event
 */

import { ethers } from 'ethers';
import { MycelixSDK } from '@mycelix/sdk';

async function main() {
  console.log('🎧 Mycelix SDK Example: Listen to a Song\n');

  // =============================================================================
  // 1. Setup Provider and Signer
  // =============================================================================

  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || 'http://localhost:8545'
  );

  // Listener wallet (different from artist)
  const listenerWallet = new ethers.Wallet(
    process.env.LISTENER_PRIVATE_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    provider
  );

  console.log('Listener Address:', listenerWallet.address);

  // =============================================================================
  // 2. Initialize SDK
  // =============================================================================

  const sdk = new MycelixSDK({
    provider,
    signer: listenerWallet,
    routerAddress: process.env.ROUTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    flowTokenAddress: process.env.FLOW_TOKEN_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    apiUrl: process.env.API_URL || 'http://localhost:3100',
  });

  console.log('✅ SDK initialized\n');

  // =============================================================================
  // 3. Fetch Song Details
  // =============================================================================

  const songId = process.env.SONG_ID || '0x1234...'; // Song ID from previous example

  console.log('🔍 Fetching song details...');

  const song = await sdk.getSongDetails(songId);

  console.log('\n📝 Song Information:');
  console.log('  Title:', song.metadata.title);
  console.log('  Artist:', song.metadata.artist);
  console.log('  Duration:', song.metadata.duration, 'seconds');
  console.log('  Price:', ethers.formatEther(song.price), 'tokens');
  console.log('  Economic Model:', song.economicModel);
  console.log('  Play Count:', song.playCount);
  console.log('');

  // =============================================================================
  // 4. Check Listener Balance
  // =============================================================================

  const flowToken = await sdk.getFlowToken();
  const balance = await flowToken.balanceOf(listenerWallet.address);

  console.log('💰 Listener Balance:', ethers.formatEther(balance), 'tokens');

  if (balance < song.price) {
    console.log('❌ Insufficient balance! Need at least', ethers.formatEther(song.price), 'tokens');

    // In a real scenario, you'd prompt the user to buy tokens
    // For this example, we'll mint some test tokens
    console.log('\n🪙 Minting test tokens...');
    const mintTx = await flowToken.mint(listenerWallet.address, ethers.parseEther('100'));
    await mintTx.wait();
    console.log('✅ Minted 100 test tokens');
  }

  // =============================================================================
  // 5. Approve Token Spending
  // =============================================================================

  console.log('\n💳 Approving token spending...');

  const allowance = await flowToken.allowance(
    listenerWallet.address,
    process.env.ROUTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  );

  if (allowance < song.price) {
    const approveTx = await flowToken.approve(
      process.env.ROUTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      ethers.parseEther('1000') // Approve enough for multiple listens
    );
    await approveTx.wait();
    console.log('✅ Approval confirmed');
  } else {
    console.log('✅ Already approved');
  }

  // =============================================================================
  // 6. Process Stream Payment
  // =============================================================================

  console.log('\n🎵 Playing song...');

  try {
    const playResult = await sdk.playSong(songId);

    console.log('\n✅ Payment processed!');
    console.log('Transaction Hash:', playResult.txHash);
    console.log('Gas Used:', playResult.gasUsed.toString());
    console.log('Amount Paid:', ethers.formatEther(playResult.amountPaid), 'tokens');

    // Show split distribution
    console.log('\n📊 Revenue Distribution:');
    playResult.splits.forEach((split: any) => {
      console.log(`  ${split.role}: ${ethers.formatEther(split.amount)} tokens → ${split.recipient}`);
    });

    // =============================================================================
    // 7. Track Play Event in Database
    // =============================================================================

    console.log('\n📈 Recording play event...');

    await sdk.trackPlay({
      songId,
      listenerAddress: listenerWallet.address,
      timestamp: Date.now(),
      amountPaid: playResult.amountPaid,
      paymentType: song.economicModel,
    });

    console.log('✅ Play event recorded');

    // =============================================================================
    // 8. Get Updated Stats
    // =============================================================================

    console.log('\n📊 Updated Stats:');

    const updatedSong = await sdk.getSongDetails(songId);
    console.log('  Play Count:', updatedSong.playCount);

    const listenerStats = await sdk.getListenerStats(listenerWallet.address);
    console.log('  Your Total Plays:', listenerStats.totalPlays);
    console.log('  Your Total Spent:', ethers.formatEther(listenerStats.totalSpent), 'tokens');

    // If gift economy, show CGC earned
    if (song.economicModel === 'gift-economy') {
      console.log('  CGC Earned:', ethers.formatEther(listenerStats.cgcEarned), 'CGC');
    }

    console.log('\n🎉 Enjoy the music!');

  } catch (error: any) {
    console.error('\n❌ Play failed:', error.message);

    // Common error handling
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('💡 Tip: You need more tokens. Get some from a faucet or exchange.');
    } else if (error.message.includes('allowance')) {
      console.log('💡 Tip: Approve token spending first.');
    } else if (error.message.includes('Only song artist')) {
      console.log('💡 Tip: This function is restricted to the song artist.');
    }

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
 * 🎧 Mycelix SDK Example: Listen to a Song
 *
 * Listener Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 * ✅ SDK initialized
 *
 * 🔍 Fetching song details...
 *
 * 📝 Song Information:
 *   Title: Decentralized Dreams
 *   Artist: Alice Blockchain
 *   Duration: 245 seconds
 *   Price: 0.01 tokens
 *   Economic Model: pay-per-stream
 *   Play Count: 0
 *
 * 💰 Listener Balance: 100 tokens
 *
 * 💳 Approving token spending...
 * ✅ Approval confirmed
 *
 * 🎵 Playing song...
 *
 * ✅ Payment processed!
 * Transaction Hash: 0xabcd...
 * Gas Used: 125432
 * Amount Paid: 0.01 tokens
 *
 * 📊 Revenue Distribution:
 *   artist: 0.006 tokens → 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *   producer: 0.003 tokens → 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *   platform: 0.001 tokens → 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
 *
 * 📈 Recording play event...
 * ✅ Play event recorded
 *
 * 📊 Updated Stats:
 *   Play Count: 1
 *   Your Total Plays: 1
 *   Your Total Spent: 0.01 tokens
 *
 * 🎉 Enjoy the music!
 */
