# 🎵 Advanced Economic Strategies

Complete guide to Patronage and Auction economic models in Mycelix Music.

## Table of Contents

1. [Overview](#overview)
2. [Patronage Strategy](#patronage-strategy)
3. [Auction Strategy](#auction-strategy)
4. [SDK Integration](#sdk-integration)
5. [Examples](#examples)
6. [Best Practices](#best-practices)

---

## Overview

Beyond Pay-Per-Stream and Gift Economy, Mycelix Music now supports two additional economic models:

- **Patronage**: Monthly subscription model for unlimited access
- **Auction**: Dutch auction model for limited releases

These strategies provide artists with more ways to monetize their work and build sustainable relationships with their audience.

---

## Patronage Strategy

### Concept

The Patronage model allows listeners to become monthly supporters (patrons) of an artist. In exchange for a fixed monthly fee, patrons get unlimited access to the artist's entire catalog.

**Key Features:**
- Monthly recurring payments
- Tiered loyalty system (4 tiers based on duration)
- Optional minimum commitment period
- Flexible cancellation policies
- Grace period for payment

### How It Works

1. **Artist Configuration**: Artist sets monthly fee and terms
2. **Patron Subscribe**: Listener subscribes with first month's payment
3. **Unlimited Access**: Patron can stream any song by that artist
4. **Monthly Renewal**: Patron renews subscription each month
5. **Tier Progression**: Longer subscriptions unlock higher tiers

### Subscription Tiers

| Tier | Duration | Example Bonus |
|------|----------|---------------|
| Tier 1 | 1-3 months | No bonus |
| Tier 2 | 3-6 months | 5% discount |
| Tier 3 | 6-12 months | 10% discount |
| Tier 4 | 12+ months | 20% discount |

### Smart Contract Interface

```solidity
// Configure patronage for your songs
function configurePatronage(
    string calldata songId,
    address artist,
    uint256 monthlyFee,
    uint256 minimumDuration,
    bool allowCancellation,
    uint256[] calldata tierBonuses
) external;

// Subscribe to an artist
function subscribe(address artist, uint256 monthlyFee) external;

// Renew subscription
function renewSubscription(address artist) external;

// Cancel subscription
function cancelSubscription(address artist, string calldata songId) external;

// Check if has active subscription
function hasActiveSubscription(address patron, address artist) view returns (bool);
```

### Configuration Options

**monthlyFee**: Monthly subscription price in FLOW tokens
- Example: 10 FLOW = $10/month equivalent
- Range: 1-1000 FLOW typically

**minimumDuration**: Minimum subscription commitment
- 0 = No minimum (cancel anytime)
- 2592000 = 30 days (1 month)
- 7776000 = 90 days (3 months)
- 31536000 = 365 days (1 year)

**allowCancellation**: Can patron cancel before minimum?
- `true` = Cancel anytime (may forfeit benefits)
- `false` = Must complete minimum duration

**tierBonuses**: Rewards for long-term patrons
- Array of 4 values (one per tier)
- In basis points (500 = 5%)
- Example: `[0, 500, 1000, 2000]` = 0%, 5%, 10%, 20%

### Use Cases

**Classical Orchestra**:
```solidity
monthlyFee: 20 FLOW ($20)
minimumDuration: 90 days
allowCancellation: false
tierBonuses: [0, 1000, 2000, 5000]  // Reward long-term supporters
```
*Why*: High-quality recordings require consistent funding

**Podcast Creator**:
```solidity
monthlyFee: 5 FLOW ($5)
minimumDuration: 0
allowCancellation: true
tierBonuses: [0, 200, 500, 1000]  // Modest bonuses
```
*Why*: Build audience first, monetize organically

**Exclusive Artist**:
```solidity
monthlyFee: 50 FLOW ($50)
minimumDuration: 365 days
allowCancellation: false
tierBonuses: [0, 0, 0, 0]  // No tiers, premium access
```
*Why*: VIP access for dedicated superfans

---

## Auction Strategy

### Concept

The Auction model uses a Dutch auction mechanism where price decreases over time. Perfect for limited releases, exclusive drops, or time-sensitive content.

**Key Features:**
- Declining price over time
- Limited supply (scarcity)
- Permanent access (once purchased)
- Price discovery mechanism
- Automatic auction end when sold out

### How It Works

1. **Artist Creates Auction**: Sets start price, end price, duration, and supply
2. **Price Declines**: Price drops linearly from start to end over duration
3. **Buyers Purchase**: Anyone can buy at current price (up to supply limit)
4. **Auction Ends**: When sold out or time expires
5. **Permanent Access**: Buyers have lifetime access to the song

### Pricing Dynamics

**Dutch Auction Pricing Formula:**
```
currentPrice = startPrice - ((startPrice - endPrice) * timeElapsed / duration)
```

**Example**: 7-day auction
- Start: 100 FLOW
- End: 10 FLOW
- Day 1: 100 FLOW
- Day 4: 61.4 FLOW (midpoint)
- Day 7: 10 FLOW

### Smart Contract Interface

```solidity
// Create Dutch auction
function createDutchAuction(
    string calldata songId,
    address artist,
    uint256 startPrice,
    uint256 endPrice,
    uint256 duration,
    uint256 totalSupply,
    uint256 priceDecrement
) external;

// Get current price
function getCurrentPrice(string calldata songId) view returns (uint256);

// Purchase access
function purchaseAccess(string calldata songId, uint256 maxPrice) returns (uint256);

// Get auction statistics
function getAuctionStats(string calldata songId) view returns (
    uint256 currentPrice,
    uint256 sold,
    uint256 remaining,
    uint256 totalRevenue,
    uint256 avgPrice,
    bool active
);
```

### Configuration Options

**startPrice**: Initial auction price (highest)
- Should reflect maximum value/exclusivity
- Typically 10-100x higher than end price

**endPrice**: Final/reserve price (lowest)
- Minimum acceptable price
- Acts as reserve price

**duration**: How long auction runs
- 86400 = 24 hours (flash auction)
- 604800 = 7 days (standard)
- 2592000 = 30 days (long-term)

**totalSupply**: Number of access tokens available
- Low supply (10-50) = High exclusivity
- Medium supply (100-500) = Moderate scarcity
- High supply (1000+) = Wide availability

### Use Cases

**Exclusive Album Drop**:
```solidity
startPrice: 100 FLOW
endPrice: 10 FLOW
duration: 7 days
totalSupply: 100
```
*Why*: Reward early supporters with lower prices

**Flash Release**:
```solidity
startPrice: 50 FLOW
endPrice: 5 FLOW
duration: 24 hours
totalSupply: 50
```
*Why*: Create urgency and FOMO

**Limited Edition**:
```solidity
startPrice: 500 FLOW
endPrice: 100 FLOW
duration: 3 days
totalSupply: 10
```
*Why*: Ultra-exclusive for superfans

**Demo/Beta Access**:
```solidity
startPrice: 10 FLOW
endPrice: 1 FLOW
duration: 3 days
totalSupply: 1000
```
*Why*: Price discrimination for early feedback

---

## SDK Integration

### Patronage SDK

```typescript
import { PatronageStrategy } from '@mycelix/sdk/advanced-strategies';

const patronage = new PatronageStrategy(contractAddress, signer);

// Configure patronage
await patronage.configurePatronage({
  songId: 'my-song-1',
  artist: artistAddress,
  monthlyFee: '10.0',  // 10 FLOW/month
  minimumDuration: 0,
  allowCancellation: true,
  tierBonuses: [0, 500, 1000, 2000],
});

// Subscribe as patron
await patronage.subscribe(artistAddress, '10.0');

// Check subscription status
const hasAccess = await patronage.hasActiveSubscription(patronAddress, artistAddress);

// Get patron stats
const stats = await patronage.getPatronStats(patronAddress, artistAddress);
console.log(`Tier: ${stats.subscriptionTier}`);
console.log(`Total Paid: ${stats.totalPaid} FLOW`);
console.log(`Duration: ${stats.durationDays} days`);
```

### Auction SDK

```typescript
import { AuctionStrategySDK } from '@mycelix/sdk/advanced-strategies';

const auction = new AuctionStrategySDK(contractAddress, signer);

// Create Dutch auction
await auction.createDutchAuction({
  songId: 'limited-release-1',
  artist: artistAddress,
  startPrice: '100.0',
  endPrice: '10.0',
  duration: 604800,  // 7 days
  totalSupply: 100,
  priceDecrement: '0',
});

// Get current price
const price = await auction.getCurrentPrice('limited-release-1');
console.log(`Current price: ${price} FLOW`);

// Purchase access
await auction.purchaseAccess('limited-release-1', '50.0');  // Max willing to pay

// Get auction stats
const stats = await auction.getAuctionStats('limited-release-1');
console.log(`Sold: ${stats.sold}/${stats.sold + stats.remaining}`);
console.log(`Average Price: ${stats.avgPrice} FLOW`);
```

### Preset Configurations

```typescript
import { PatronagePresets, AuctionPresets } from '@mycelix/sdk/advanced-strategies';

// Use patronage presets
const basicConfig = PatronagePresets.basic(songId, artistAddress);
const premiumConfig = PatronagePresets.premium(songId, artistAddress);

// Use auction presets
const weeklyAuction = AuctionPresets.weekLongExclusive(songId, artistAddress);
const flashAuction = AuctionPresets.flashAuction(songId, artistAddress);
```

---

## Examples

### Example 1: Artist Sets Up Patronage

```typescript
// Artist configures $10/month patronage with 3-month minimum
const tx = await patronageStrategy.configurePatronage({
  songId: 'artist-catalog-1',
  artist: await signer.getAddress(),
  monthlyFee: '10.0',
  minimumDuration: 7776000,  // 90 days
  allowCancellation: false,
  tierBonuses: [0, 500, 1000, 2000],  // Loyalty rewards
});

await tx.wait();
console.log('Patronage configured!');
```

### Example 2: Listener Becomes Patron

```typescript
// Listener subscribes to artist
const artist = '0x...';
const monthlyFee = '10.0';

// Approve FLOW tokens
const flowToken = new ethers.Contract(tokenAddress, erc20Abi, signer);
await flowToken.approve(patronageAddress, ethers.utils.parseEther('120'));  // 1 year

// Subscribe
const tx = await patronageStrategy.subscribe(artist, monthlyFee);
await tx.wait();

console.log('Subscribed! You now have unlimited access.');
```

### Example 3: Launch Dutch Auction

```typescript
// Artist launches 7-day exclusive release auction
const tx = await auctionStrategy.createDutchAuction({
  songId: 'exclusive-drop-1',
  artist: await signer.getAddress(),
  startPrice: '100.0',  // Starts at 100 FLOW
  endPrice: '10.0',     // Ends at 10 FLOW (reserve)
  duration: 604800,     // 7 days
  totalSupply: 100,     // Only 100 copies
  priceDecrement: '0',
});

await tx.wait();
console.log('Auction live! Price will decline over 7 days.');
```

### Example 4: Buy from Auction

```typescript
// Check current price
const currentPrice = await auctionStrategy.getCurrentPrice('exclusive-drop-1');
console.log(`Current price: ${currentPrice} FLOW`);

// Purchase if price is acceptable
const maxWillingToPay = '50.0';

if (parseFloat(currentPrice) <= parseFloat(maxWillingToPay)) {
  const tx = await auctionStrategy.purchaseAccess('exclusive-drop-1', maxWillingToPay);
  const receipt = await tx.wait();

  console.log('Purchase successful! You now have permanent access.');
} else {
  console.log('Price too high, waiting...');
}
```

---

## Best Practices

### For Patronage

**1. Set Reasonable Monthly Fees**
- Research comparable platforms (Patreon: $3-20/month typical)
- Consider your audience's demographics
- Start lower, increase as you prove value

**2. Offer Value for Loyalty**
- Use tier bonuses to reward long-term patrons
- Offer exclusive content for higher tiers
- Personal engagement with top-tier patrons

**3. Communicate Clearly**
- Explain what patronage includes
- Set expectations for content frequency
- Be transparent about cancellation terms

**4. Gradual Commitment**
- Start with no minimum duration
- Add minimums once you've proven consistency
- Offer trials or first-month discounts

### For Auctions

**1. Price Appropriately**
- Start price: 3-10x higher than expected clearing price
- End price: Minimum you're willing to accept
- Research similar auctions for benchmarks

**2. Choose Right Duration**
- Flash (24h): High urgency, existing audience
- Week (7d): Standard, allows discovery
- Month (30d): Patient price discovery

**3. Supply Strategy**
- Ultra-exclusive (< 20): Superfans only
- Limited (20-100): Core fans
- Wide (100+): Broader audience

**4. Marketing Timeline**
- Announce 1 week before launch
- Build hype leading up to start
- Provide updates during auction
- Celebrate milestones (50% sold, etc.)

### General Tips

**For Artists:**
- Use multiple strategies across your catalog
- New releases: Auction
- Back catalog: Patronage
- Singles: Pay-per-stream
- Experiment and track what works

**For Platforms:**
- Provide clear analytics
- Show price history for auctions
- Display patronage benefits prominently
- Make it easy to switch strategies

---

## Analytics & Metrics

### Patronage Metrics

```typescript
// Artist dashboard
const stats = await patronage.getArtistStats(artistAddress);
console.log(`Active Patrons: ${stats.activePatrons}`);
console.log(`Monthly Recurring Revenue: ${stats.monthlyRecurring} FLOW`);
console.log(`Total Revenue: ${stats.totalRevenue} FLOW`);

// Patron dashboard
const patronStats = await patronage.getPatronStats(patronAddress, artistAddress);
console.log(`Your Tier: ${patronStats.subscriptionTier}`);
console.log(`Total Supported: ${patronStats.totalPaid} FLOW`);
console.log(`Member Since: ${patronStats.durationDays} days`);
```

### Auction Metrics

```typescript
// Real-time auction stats
const stats = await auction.getAuctionStats(songId);
console.log(`Current Price: ${stats.currentPrice} FLOW`);
console.log(`Sold: ${stats.sold} / ${stats.sold + stats.remaining}`);
console.log(`Average Price: ${stats.avgPrice} FLOW`);
console.log(`Total Revenue: ${stats.totalRevenue} FLOW`);

// Purchase history
const history = await auction.getPurchaseHistory(songId, 0, 100);
history.forEach((purchase, i) => {
  console.log(`#${i + 1}: ${purchase.buyer} paid ${purchase.pricePaid} FLOW`);
});
```

---

## Comparison Matrix

| Feature | Pay-Per-Stream | Gift Economy | Patronage | Auction |
|---------|----------------|--------------|-----------|---------|
| **Revenue Model** | Per-play | Tips | Subscription | One-time |
| **Price** | Fixed | Variable | Fixed monthly | Declining |
| **Access** | Single play | Unlimited | Unlimited | Permanent |
| **Best For** | Mainstream | Community | Dedicated fans | Exclusives |
| **Complexity** | Low | Medium | Medium | High |
| **Predictability** | Medium | Low | High | Low |

---

## Troubleshooting

**Patronage Issues:**

Q: Patron can't renew subscription
A: Check they've waited 30 days since last payment and have sufficient balance

Q: How to handle failed payments?
A: Subscriptions have 7-day grace period. After 37 days, marked inactive.

Q: Can patrons switch artists?
A: Yes, they can subscribe to multiple artists independently.

**Auction Issues:**

Q: Auction sold out too quickly
A: Increase supply or start price for next auction

Q: Price dropped to reserve with supply remaining
A: Either wait for auction to end or manually end and try different parameters

Q: How to handle refunds?
A: Refunds only available for cancelled auctions with zero sales

---

## Resources

- [Smart Contract Source](../contracts/strategies/)
- [SDK Documentation](../packages/sdk/src/advanced-strategies.ts)
- [Integration Examples](../examples/integration/)
- [Test Suites](../contracts/test/)

---

**Last Updated**: 2025-11-15
