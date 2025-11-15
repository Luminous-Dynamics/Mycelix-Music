// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PlatformSubscriptionStrategy
 * @notice Platform-wide subscription for unlimited music access (5th economic model)
 * @dev Implements tiered subscriptions with automatic revenue distribution to artists
 *
 * Subscription Tiers:
 * - FREE: Pay-per-stream only, ads
 * - BASIC ($5/mo): Unlimited plays, standard quality (256kbps)
 * - PREMIUM ($10/mo): High quality (320kbps/FLAC), offline, ad-free
 * - ARTIST_SUPPORTER ($15/mo): Premium + artist patronage pool
 *
 * Revenue Distribution:
 * - 70% to artists (play-based distribution)
 * - 20% to platform operations
 * - 10% to artist patronage pool (Artist Supporter tier only)
 */
contract PlatformSubscriptionStrategy is Ownable, ReentrancyGuard {

    // ============================================================
    // ENUMS & STRUCTS
    // ============================================================

    enum SubscriptionTier {
        FREE,            // 0: No subscription
        BASIC,           // 1: $5/month
        PREMIUM,         // 2: $10/month
        ARTIST_SUPPORTER // 3: $15/month
    }

    struct Subscription {
        address subscriber;
        SubscriptionTier tier;
        uint256 startDate;
        uint256 lastBillingDate;
        uint256 nextBillingDate;
        bool active;
        bool autoRenew;
    }

    struct MonthlyDistribution {
        uint256 month; // Unix timestamp of month start
        uint256 totalRevenue;
        uint256 totalPlays;
        bool distributed;
        mapping(address => uint256) artistPlays;
        mapping(address => uint256) artistEarnings;
    }

    // ============================================================
    // STATE VARIABLES
    // ============================================================

    // Payment token (USDC)
    IERC20 public immutable paymentToken;

    // Subscription prices (in USDC, 6 decimals)
    uint256 public constant BASIC_PRICE = 5e6;      // $5
    uint256 public constant PREMIUM_PRICE = 10e6;   // $10
    uint256 public constant SUPPORTER_PRICE = 15e6; // $15

    // Billing cycle (30 days)
    uint256 public constant BILLING_CYCLE = 30 days;

    // Grace period (3 days after billing date)
    uint256 public constant GRACE_PERIOD = 3 days;

    // Revenue distribution percentages (basis points, 100 = 1%)
    uint256 public constant ARTIST_SHARE = 7000;    // 70%
    uint256 public constant PLATFORM_SHARE = 2000;  // 20%
    uint256 public constant PATRONAGE_SHARE = 1000; // 10%

    // Mappings
    mapping(address => Subscription) public subscriptions;
    mapping(uint256 => MonthlyDistribution) public monthlyDistributions;
    mapping(address => bool) public authorizedArtists;

    // Counters
    uint256 public totalSubscribers;
    mapping(SubscriptionTier => uint256) public subscribersByTier;

    // Platform treasury
    address public platformTreasury;
    address public patronagePool;

    // Play tracking (off-chain tracking, on-chain recording for distribution)
    mapping(uint256 => mapping(address => uint256)) public monthlyArtistPlays;
    mapping(uint256 => uint256) public monthlyTotalPlays;

    // ============================================================
    // EVENTS
    // ============================================================

    event Subscribed(
        address indexed subscriber,
        SubscriptionTier tier,
        uint256 price,
        uint256 startDate,
        uint256 nextBillingDate
    );

    event Renewed(
        address indexed subscriber,
        SubscriptionTier tier,
        uint256 price,
        uint256 nextBillingDate
    );

    event Cancelled(
        address indexed subscriber,
        SubscriptionTier tier,
        uint256 cancelDate
    );

    event TierUpgraded(
        address indexed subscriber,
        SubscriptionTier fromTier,
        SubscriptionTier toTier,
        uint256 priceDiff
    );

    event TierDowngraded(
        address indexed subscriber,
        SubscriptionTier fromTier,
        SubscriptionTier toTier,
        uint256 refund
    );

    event RevenueDistributed(
        uint256 indexed month,
        uint256 totalRevenue,
        uint256 artistShare,
        uint256 platformShare,
        uint256 patronageShare
    );

    event ArtistPaid(
        address indexed artist,
        uint256 indexed month,
        uint256 plays,
        uint256 earnings
    );

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor(
        address _paymentToken,
        address _platformTreasury,
        address _patronagePool
    ) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_platformTreasury != address(0), "Invalid treasury");
        require(_patronagePool != address(0), "Invalid patronage pool");

        paymentToken = IERC20(_paymentToken);
        platformTreasury = _platformTreasury;
        patronagePool = _patronagePool;
    }

    // ============================================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================================

    /**
     * @notice Subscribe to a tier
     * @param tier The subscription tier to subscribe to
     */
    function subscribe(SubscriptionTier tier) external nonReentrant {
        require(tier != SubscriptionTier.FREE, "Cannot subscribe to FREE tier");
        require(!subscriptions[msg.sender].active, "Already subscribed");

        uint256 price = getPriceForTier(tier);

        // Transfer payment
        require(
            paymentToken.transferFrom(msg.sender, address(this), price),
            "Payment failed"
        );

        // Create subscription
        uint256 now_ = block.timestamp;
        subscriptions[msg.sender] = Subscription({
            subscriber: msg.sender,
            tier: tier,
            startDate: now_,
            lastBillingDate: now_,
            nextBillingDate: now_ + BILLING_CYCLE,
            active: true,
            autoRenew: true
        });

        // Update counters
        totalSubscribers++;
        subscribersByTier[tier]++;

        // Distribute revenue
        _distributeSubscriptionRevenue(price, tier);

        emit Subscribed(msg.sender, tier, price, now_, now_ + BILLING_CYCLE);
    }

    /**
     * @notice Renew subscription (manual or automatic)
     */
    function renew() external nonReentrant {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.active, "No active subscription");
        require(block.timestamp >= sub.nextBillingDate - GRACE_PERIOD, "Too early to renew");

        uint256 price = getPriceForTier(sub.tier);

        // Transfer payment
        require(
            paymentToken.transferFrom(msg.sender, address(this), price),
            "Payment failed"
        );

        // Update subscription
        sub.lastBillingDate = block.timestamp;
        sub.nextBillingDate = block.timestamp + BILLING_CYCLE;

        // Distribute revenue
        _distributeSubscriptionRevenue(price, sub.tier);

        emit Renewed(msg.sender, sub.tier, price, sub.nextBillingDate);
    }

    /**
     * @notice Cancel subscription
     */
    function cancel() external {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.active, "No active subscription");

        sub.active = false;
        sub.autoRenew = false;

        // Update counters
        totalSubscribers--;
        subscribersByTier[sub.tier]--;

        emit Cancelled(msg.sender, sub.tier, block.timestamp);
    }

    /**
     * @notice Upgrade subscription tier
     * @param newTier The tier to upgrade to
     */
    function upgradeTier(SubscriptionTier newTier) external nonReentrant {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.active, "No active subscription");
        require(newTier > sub.tier, "Not an upgrade");

        uint256 currentPrice = getPriceForTier(sub.tier);
        uint256 newPrice = getPriceForTier(newTier);

        // Calculate pro-rated price difference
        uint256 remainingDays = (sub.nextBillingDate - block.timestamp) / 1 days;
        uint256 priceDiff = ((newPrice - currentPrice) * remainingDays) / 30;

        // Charge difference
        require(
            paymentToken.transferFrom(msg.sender, address(this), priceDiff),
            "Payment failed"
        );

        // Update tier
        subscribersByTier[sub.tier]--;
        sub.tier = newTier;
        subscribersByTier[newTier]++;

        // Distribute additional revenue
        _distributeSubscriptionRevenue(priceDiff, newTier);

        emit TierUpgraded(msg.sender, sub.tier, newTier, priceDiff);
    }

    /**
     * @notice Downgrade subscription tier (takes effect next billing cycle)
     * @param newTier The tier to downgrade to
     */
    function downgradeTier(SubscriptionTier newTier) external {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.active, "No active subscription");
        require(newTier < sub.tier && newTier != SubscriptionTier.FREE, "Invalid downgrade");

        // Downgrade takes effect at next billing
        // No refund for current period

        subscribersByTier[sub.tier]--;
        sub.tier = newTier;
        subscribersByTier[newTier]++;

        emit TierDowngraded(msg.sender, sub.tier, newTier, 0);
    }

    /**
     * @notice Toggle auto-renewal
     */
    function setAutoRenew(bool enabled) external {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.active, "No active subscription");
        sub.autoRenew = enabled;
    }

    // ============================================================
    // REVENUE DISTRIBUTION
    // ============================================================

    /**
     * @notice Distribute subscription revenue
     * @param amount The subscription amount
     * @param tier The subscription tier
     */
    function _distributeSubscriptionRevenue(uint256 amount, SubscriptionTier tier) internal {
        // Platform gets 20%
        uint256 platformAmount = (amount * PLATFORM_SHARE) / 10000;
        paymentToken.transfer(platformTreasury, platformAmount);

        // Artist pool gets 70%
        uint256 artistAmount = (amount * ARTIST_SHARE) / 10000;
        // Stays in contract for monthly distribution

        // Patronage pool gets 10% (only for ARTIST_SUPPORTER tier)
        if (tier == SubscriptionTier.ARTIST_SUPPORTER) {
            uint256 patronageAmount = (amount * PATRONAGE_SHARE) / 10000;
            paymentToken.transfer(patronagePool, patronageAmount);
        }
    }

    /**
     * @notice Record plays for revenue distribution (called by backend)
     * @param month Month timestamp
     * @param artist Artist address
     * @param plays Number of plays
     */
    function recordPlays(
        uint256 month,
        address artist,
        uint256 plays
    ) external onlyOwner {
        require(authorizedArtists[artist], "Artist not authorized");

        monthlyArtistPlays[month][artist] += plays;
        monthlyTotalPlays[month] += plays;
    }

    /**
     * @notice Distribute monthly revenue to artists based on plays
     * @param month Month timestamp
     * @param artists Array of artist addresses
     */
    function distributeMonthlyRevenue(
        uint256 month,
        address[] calldata artists
    ) external onlyOwner nonReentrant {
        MonthlyDistribution storage dist = monthlyDistributions[month];
        require(!dist.distributed, "Already distributed");

        uint256 totalPlays = monthlyTotalPlays[month];
        require(totalPlays > 0, "No plays recorded");

        // Calculate total artist pool for the month
        // This would come from tracking monthly subscription revenue
        uint256 artistPool = dist.totalRevenue; // Set off-chain before calling this
        require(artistPool > 0, "No revenue to distribute");

        // Distribute to each artist based on play share
        for (uint256 i = 0; i < artists.length; i++) {
            address artist = artists[i];
            uint256 artistPlays = monthlyArtistPlays[month][artist];

            if (artistPlays > 0) {
                uint256 artistShare = (artistPool * artistPlays) / totalPlays;

                // Transfer to artist
                paymentToken.transfer(artist, artistShare);

                dist.artistPlays[artist] = artistPlays;
                dist.artistEarnings[artist] = artistShare;

                emit ArtistPaid(artist, month, artistPlays, artistShare);
            }
        }

        dist.distributed = true;
        dist.totalPlays = totalPlays;

        emit RevenueDistributed(
            month,
            dist.totalRevenue,
            artistPool,
            (dist.totalRevenue * PLATFORM_SHARE) / 10000,
            (dist.totalRevenue * PATRONAGE_SHARE) / 10000
        );
    }

    /**
     * @notice Set monthly revenue for distribution
     * @param month Month timestamp
     * @param revenue Total revenue collected for the month
     */
    function setMonthlyRevenue(uint256 month, uint256 revenue) external onlyOwner {
        monthlyDistributions[month].month = month;
        monthlyDistributions[month].totalRevenue = revenue;
    }

    // ============================================================
    // ARTIST MANAGEMENT
    // ============================================================

    /**
     * @notice Authorize artist to receive revenue
     * @param artist Artist address
     */
    function authorizeArtist(address artist) external onlyOwner {
        authorizedArtists[artist] = true;
    }

    /**
     * @notice Revoke artist authorization
     * @param artist Artist address
     */
    function revokeArtist(address artist) external onlyOwner {
        authorizedArtists[artist] = false;
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get price for a tier
     * @param tier The subscription tier
     * @return The price in USDC
     */
    function getPriceForTier(SubscriptionTier tier) public pure returns (uint256) {
        if (tier == SubscriptionTier.BASIC) return BASIC_PRICE;
        if (tier == SubscriptionTier.PREMIUM) return PREMIUM_PRICE;
        if (tier == SubscriptionTier.ARTIST_SUPPORTER) return SUPPORTER_PRICE;
        return 0; // FREE
    }

    /**
     * @notice Check if user has active subscription
     * @param user User address
     * @return Whether user has active subscription
     */
    function hasActiveSubscription(address user) external view returns (bool) {
        Subscription memory sub = subscriptions[user];
        if (!sub.active) return false;

        // Check if past grace period
        if (block.timestamp > sub.nextBillingDate + GRACE_PERIOD) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get subscription details
     * @param user User address
     * @return Subscription struct
     */
    function getSubscription(address user) external view returns (Subscription memory) {
        return subscriptions[user];
    }

    /**
     * @notice Get artist earnings for a month
     * @param month Month timestamp
     * @param artist Artist address
     * @return plays Number of plays
     * @return earnings Earnings amount
     */
    function getArtistMonthlyEarnings(uint256 month, address artist)
        external
        view
        returns (uint256 plays, uint256 earnings)
    {
        MonthlyDistribution storage dist = monthlyDistributions[month];
        return (dist.artistPlays[artist], dist.artistEarnings[artist]);
    }

    /**
     * @notice Get total subscriber count
     * @return Total subscribers
     */
    function getTotalSubscribers() external view returns (uint256) {
        return totalSubscribers;
    }

    /**
     * @notice Get subscriber count by tier
     * @param tier The subscription tier
     * @return Number of subscribers in tier
     */
    function getSubscribersByTier(SubscriptionTier tier) external view returns (uint256) {
        return subscribersByTier[tier];
    }

    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update platform treasury address
     * @param newTreasury New treasury address
     */
    function updatePlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        platformTreasury = newTreasury;
    }

    /**
     * @notice Update patronage pool address
     * @param newPool New pool address
     */
    function updatePatronagePool(address newPool) external onlyOwner {
        require(newPool != address(0), "Invalid address");
        patronagePool = newPool;
    }

    /**
     * @notice Emergency pause (in case of exploit)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
