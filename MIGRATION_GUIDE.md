# Migration Guide - Security & Performance Update

This guide covers the breaking changes and improvements introduced in the latest security and performance update.

## 🔴 Breaking Changes

### SDK Function Signatures

The TypeScript SDK function names and signatures have been updated to match the actual smart contract implementations.

#### PayPerStreamStrategy

**Before:**
```typescript
await strategy.setRoyaltySplit(songHash, recipients, basisPoints, roles);
```

**After:**
```typescript
await strategy.configureRoyaltySplit(songHash, recipients, basisPoints, roles);
```

#### GiftEconomyStrategy

**Before:**
```typescript
await strategy.configureGifts(
  songHash,
  acceptsGifts,
  minGiftAmount,
  recipients,
  splits
);
```

**After:**
```typescript
await strategy.configureGiftEconomy(
  songHash,
  artistAddress,
  cgcPerListen,      // e.g., ethers.parseEther('1')
  earlyListenerBonus, // e.g., ethers.parseEther('5')
  earlyListenerThreshold, // e.g., 100
  repeatListenerMultiplier // e.g., 15000 (1.5x)
);
```

#### Removed Functions

The following function has been removed from the SDK as it referenced a non-existent contract function:

- `claimCGCRewards(artistAddress)` → Use `getListenerProfile(songId, strategyAddress)` instead

### Smart Contract Changes

#### Access Control

All strategy configuration functions now require artist authorization:

**PayPerStreamStrategy.sol:**
```solidity
function configureRoyaltySplit(
    bytes32 songId,
    address[] calldata recipients,
    uint256[] calldata basisPoints,
    string[] calldata roles
) external {
    // Only the song artist can configure royalty splits
    address artist = EconomicStrategyRouter(router).getSongArtist(songId);
    require(msg.sender == artist, "Only song artist can configure");
    // ... rest of function
}
```

**GiftEconomyStrategy.sol:**
```solidity
function configureGiftEconomy(
    bytes32 songId,
    address artist,
    uint256 cgcPerListen,
    uint256 earlyListenerBonus,
    uint256 earlyListenerThreshold,
    uint256 repeatListenerMultiplier
) external {
    // Only the song artist can configure gift economy
    address songArtist = EconomicStrategyRouter(router).getSongArtist(songId);
    require(msg.sender == songArtist, "Only song artist can configure");
    // ... rest of function
}
```

**Impact:** Configuration functions can now only be called by the artist who registered the song.

## ✅ New Features

### Smart Contracts

1. **calculateSplits() Function** (CRITICAL FIX)
   - Both strategy contracts now implement the `calculateSplits()` function
   - Enables proper payment preview functionality via `router.previewSplits()`
   - Returns detailed split distribution for any payment amount

2. **ERC20 Approval Safety**
   - Router now resets approvals to 0 before setting new values
   - Prevents approval race condition attacks
   - Follows OpenZeppelin security best practices

3. **getSongArtist() Helper**
   - New view function in EconomicStrategyRouter
   - Allows strategies to query which address owns a song
   - Used for access control in configuration functions

### API

1. **Database Indexes**
   - Added 7 indexes for improved query performance:
     - `idx_songs_artist_address`
     - `idx_songs_genre`
     - `idx_songs_payment_model`
     - `idx_songs_created_at`
     - `idx_plays_song_id`
     - `idx_plays_listener_address`
     - `idx_plays_timestamp`

2. **Redis Caching**
   - GET `/api/songs` - cached for 30 seconds
   - GET `/api/songs/:id` - cached for 60 seconds
   - Cache invalidation on song creation and play recording

3. **Rate Limiting**
   - Global rate limit: 100 requests per minute per IP
   - Returns HTTP 429 with `retryAfter` when exceeded
   - Automatic cleanup of expired rate limit records

4. **Input Validation**
   - Comprehensive validation on all POST/GET endpoints
   - Ethereum address validation (0x + 40 hex chars)
   - Type checking for all required fields
   - Range validation for numeric inputs
   - Payment type whitelisting

5. **Better Error Handling**
   - Specific error messages for validation failures
   - HTTP 400 for validation errors
   - HTTP 404 for not found resources
   - HTTP 409 for conflict (duplicate IDs)
   - HTTP 429 for rate limiting
   - PostgreSQL constraint violation handling

## 🔄 Migration Steps

### For Frontend/SDK Users

1. **Update SDK function calls:**

   ```typescript
   // Old code
   await sdk.registerSong(songId, {
     strategyId: 'pay-per-stream-v1',
     paymentModel: PaymentModel.PAY_PER_STREAM,
     distributionSplits: [...],
   });

   // New code (no changes needed - SDK handles internally)
   await sdk.registerSong(songId, {
     strategyId: 'pay-per-stream-v1',
     paymentModel: PaymentModel.PAY_PER_STREAM,
     distributionSplits: [...],
   });
   ```

2. **Replace removed functions:**

   ```typescript
   // Old code
   const rewards = await sdk.claimCGCRewards(artistAddress);

   // New code
   const profile = await sdk.getListenerProfile(songId, strategyAddress);
   console.log(profile.cgcBalance); // Access CGC balance
   ```

### For Smart Contract Users

1. **Update strategy configuration calls:**

   ```solidity
   // Make sure to call configuration as the song artist
   vm.startPrank(artist);

   payPerStream.configureRoyaltySplit(
       songId,
       recipients,
       basisPoints,
       roles
   );

   vm.stopPrank();
   ```

2. **Access control awareness:**
   - Only the artist who registered a song can configure it
   - Configuration must be done AFTER registering the song with the router
   - The router keeps track of song ownership via `songArtist` mapping

### For API Users

1. **Handle new rate limits:**

   ```typescript
   fetch('/api/songs')
     .then(res => {
       if (res.status === 429) {
         const retryAfter = res.headers.get('Retry-After');
         console.log(`Rate limited. Retry after ${retryAfter} seconds`);
       }
       return res.json();
     });
   ```

2. **Update validation error handling:**

   ```typescript
   // Old approach
   if (error) {
     console.log('Something went wrong');
   }

   // New approach
   if (error) {
     switch (response.status) {
       case 400:
         console.error('Validation error:', error.message);
         break;
       case 404:
         console.error('Resource not found');
         break;
       case 409:
         console.error('Duplicate resource');
         break;
       case 429:
         console.error('Rate limited, please slow down');
         break;
       default:
         console.error('Server error');
     }
   }
   ```

## 📋 Checklist

Before deploying updated contracts:
- [ ] Update all SDK integration code
- [ ] Test configuration functions with artist authentication
- [ ] Verify `calculateSplits()` returns expected values
- [ ] Test rate limiting behavior in your app
- [ ] Update error handling for new HTTP status codes
- [ ] Clear Redis cache after deployment (optional)

## 🆘 Support

If you encounter issues during migration:

1. Check function signatures match the new ABIs
2. Ensure artist addresses are used for configuration calls
3. Verify rate limiting doesn't impact your use case
4. Review validation error messages for specific issues

## 🔗 Related Documentation

- [Smart Contract Architecture](./docs/architecture/contracts.md)
- [SDK Reference](./packages/sdk/README.md)
- [API Documentation](./apps/api/README.md)
