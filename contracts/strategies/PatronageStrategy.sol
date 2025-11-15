// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IEconomicStrategy.sol";
import "../interfaces/IEconomicStrategyRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PatronageStrategy
 * @notice Monthly subscription model for unlimited song access
 * @dev Implements patronage-based economic model where listeners pay a monthly fee
 *      for unlimited access to an artist's catalog
 */
contract PatronageStrategy is IEconomicStrategy, Ownable, ReentrancyGuard {
    IEconomicStrategyRouter public router;
    IERC20 public paymentToken;

    // Subscription tracking
    struct Subscription {
        uint256 monthlyFee;        // Monthly subscription fee
        uint256 startTime;         // When subscription started
        uint256 lastPayment;       // Timestamp of last payment
        bool active;               // Whether subscription is active
    }

    // Patronage configuration per artist
    struct PatronageConfig {
        address artist;            // Artist address
        uint256 monthlyFee;        // Required monthly fee
        uint256 minimumDuration;   // Minimum subscription duration (seconds)
        bool allowCancellation;    // Can patron cancel before minimum?
        uint256[] tierBonuses;     // Bonus percentages for loyalty tiers
    }

    // Storage
    mapping(string => PatronageConfig) public patronageConfigs;  // songId => config
    mapping(address => mapping(address => Subscription)) public subscriptions;  // patron => artist => subscription
    mapping(address => uint256) public artistRevenue;  // artist => total revenue
    mapping(address => uint256) public patronCount;    // artist => number of active patrons

    // Events
    event SubscriptionCreated(address indexed patron, address indexed artist, uint256 monthlyFee);
    event SubscriptionRenewed(address indexed patron, address indexed artist, uint256 amount);
    event SubscriptionCancelled(address indexed patron, address indexed artist);
    event PatronageConfigured(string indexed songId, address artist, uint256 monthlyFee);

    constructor(address _paymentToken, address _router) {
        paymentToken = IERC20(_paymentToken);
        router = IEconomicStrategyRouter(_router);
    }

    /**
     * @notice Configure patronage settings for a song/artist
     */
    function configurePatronage(
        string calldata songId,
        address artist,
        uint256 monthlyFee,
        uint256 minimumDuration,
        bool allowCancellation,
        uint256[] calldata tierBonuses
    ) external {
        require(msg.sender == artist || msg.sender == address(router), "Not authorized");
        require(monthlyFee > 0, "Monthly fee must be > 0");

        patronageConfigs[songId] = PatronageConfig({
            artist: artist,
            monthlyFee: monthlyFee,
            minimumDuration: minimumDuration,
            allowCancellation: allowCancellation,
            tierBonuses: tierBonuses
        });

        emit PatronageConfigured(songId, artist, monthlyFee);
    }

    /**
     * @notice Subscribe to an artist's catalog
     */
    function subscribe(address artist, uint256 monthlyFee) external nonReentrant {
        require(artist != address(0), "Invalid artist");
        require(monthlyFee > 0, "Invalid monthly fee");
        require(!subscriptions[msg.sender][artist].active, "Already subscribed");

        // Transfer first month's payment
        require(
            paymentToken.transferFrom(msg.sender, artist, monthlyFee),
            "Payment failed"
        );

        // Create subscription
        subscriptions[msg.sender][artist] = Subscription({
            monthlyFee: monthlyFee,
            startTime: block.timestamp,
            lastPayment: block.timestamp,
            active: true
        });

        artistRevenue[artist] += monthlyFee;
        patronCount[artist]++;

        emit SubscriptionCreated(msg.sender, artist, monthlyFee);
    }

    /**
     * @notice Renew subscription (pay for next month)
     */
    function renewSubscription(address artist) external nonReentrant {
        Subscription storage sub = subscriptions[msg.sender][artist];
        require(sub.active, "No active subscription");
        require(block.timestamp >= sub.lastPayment + 30 days, "Too early to renew");

        // Transfer monthly payment
        require(
            paymentToken.transferFrom(msg.sender, artist, sub.monthlyFee),
            "Payment failed"
        );

        sub.lastPayment = block.timestamp;
        artistRevenue[artist] += sub.monthlyFee;

        emit SubscriptionRenewed(msg.sender, artist, sub.monthlyFee);
    }

    /**
     * @notice Cancel subscription
     */
    function cancelSubscription(
        address artist,
        string calldata songId
    ) external {
        Subscription storage sub = subscriptions[msg.sender][artist];
        require(sub.active, "No active subscription");

        PatronageConfig memory config = patronageConfigs[songId];

        // Check if cancellation is allowed
        if (!config.allowCancellation) {
            require(
                block.timestamp >= sub.startTime + config.minimumDuration,
                "Minimum duration not met"
            );
        }

        sub.active = false;
        patronCount[artist]--;

        emit SubscriptionCancelled(msg.sender, artist);
    }

    /**
     * @notice Check if patron has active subscription
     */
    function hasActiveSubscription(
        address patron,
        address artist
    ) public view returns (bool) {
        Subscription memory sub = subscriptions[patron][artist];

        if (!sub.active) return false;

        // Check if payment is up to date (within 30 days + 7 day grace period)
        return block.timestamp <= sub.lastPayment + 37 days;
    }

    /**
     * @notice Get subscription loyalty tier (based on duration)
     */
    function getSubscriptionTier(
        address patron,
        address artist
    ) public view returns (uint256) {
        Subscription memory sub = subscriptions[patron][artist];
        if (!sub.active) return 0;

        uint256 duration = block.timestamp - sub.startTime;

        // Tier 1: 1-3 months
        if (duration < 90 days) return 1;
        // Tier 2: 3-6 months
        if (duration < 180 days) return 2;
        // Tier 3: 6-12 months
        if (duration < 365 days) return 3;
        // Tier 4: 12+ months
        return 4;
    }

    /**
     * @notice Process payment (IEconomicStrategy interface)
     * @dev For patronage, this just checks if patron has active subscription
     */
    function processPayment(
        string calldata songId,
        address patron,
        uint256 amount,
        PaymentType paymentType
    ) external override returns (Split[] memory splits) {
        require(msg.sender == address(router), "Only router");

        PatronageConfig memory config = patronageConfigs[songId];
        require(config.artist != address(0), "Song not configured");

        // Verify active subscription
        require(
            hasActiveSubscription(patron, config.artist),
            "No active subscription"
        );

        // For patronage, no additional payment needed for streams
        // Just return empty splits (payment already made via subscription)
        return new Split[](0);
    }

    /**
     * @notice Calculate splits (IEconomicStrategy interface)
     */
    function calculateSplits(
        string calldata songId,
        uint256 amount
    ) external view override returns (Split[] memory splits) {
        PatronageConfig memory config = patronageConfigs[songId];
        require(config.artist != address(0), "Song not configured");

        // All subscription fees go to artist
        splits = new Split[](1);
        splits[0] = Split({
            recipient: config.artist,
            amount: config.monthlyFee,
            basisPoints: 10000,
            role: "artist"
        });

        return splits;
    }

    /**
     * @notice Get artist statistics
     */
    function getArtistStats(address artist) external view returns (
        uint256 activePatrons,
        uint256 totalRevenue,
        uint256 monthlyRecurring
    ) {
        return (
            patronCount[artist],
            artistRevenue[artist],
            patronCount[artist] * subscriptions[address(0)][artist].monthlyFee  // Simplified
        );
    }

    /**
     * @notice Get patron statistics
     */
    function getPatronStats(address patron, address artist) external view returns (
        uint256 subscriptionTier,
        uint256 totalPaid,
        uint256 durationDays,
        bool active
    ) {
        Subscription memory sub = subscriptions[patron][artist];

        return (
            getSubscriptionTier(patron, artist),
            (block.timestamp - sub.startTime) / 30 days * sub.monthlyFee,
            (block.timestamp - sub.startTime) / 1 days,
            sub.active
        );
    }
}
