// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../../contracts/src/interfaces/IEconomicStrategy.sol";
import "../../contracts/src/EconomicStrategyRouter.sol";

/**
 * @title DynamicPricingStrategy
 * @notice Example custom economic strategy with dynamic pricing based on demand
 * @dev Demonstrates how to create your own economic model
 *
 * Features:
 * - Dynamic pricing: Price increases with popularity
 * - Bulk discounts: Listeners who buy bundles get discounts
 * - Time-based promotions: Cheaper during off-peak hours
 * - Artist-controlled parameters
 */
contract DynamicPricingStrategy is IEconomicStrategy {
    // ============================================================================
    // State Variables
    // ============================================================================

    address public immutable router;
    IERC20 public immutable flowToken;

    struct PricingConfig {
        bool initialized;
        address artist;
        uint256 basePrice;           // Base price per stream
        uint256 popularityMultiplier; // Multiplier per 100 plays (in basis points)
        uint256 bulkDiscountThreshold; // Number of plays for bulk discount
        uint256 bulkDiscountBps;     // Bulk discount in basis points
        uint256 offPeakDiscountBps;  // Off-peak hours discount
        uint256 offPeakStartHour;    // Start hour for off-peak (0-23)
        uint256 offPeakEndHour;      // End hour for off-peak (0-23)
    }

    struct SongStats {
        uint256 totalPlays;
        uint256 lastPriceUpdate;
        uint256 currentPrice;
    }

    struct ListenerStats {
        uint256 totalPlays;
        uint256 lastPlayTime;
    }

    mapping(bytes32 => PricingConfig) public pricingConfigs;
    mapping(bytes32 => SongStats) public songStats;
    mapping(bytes32 => mapping(address => ListenerStats)) public listenerStats;

    // ============================================================================
    // Events
    // ============================================================================

    event PricingConfigured(
        bytes32 indexed songId,
        uint256 basePrice,
        uint256 popularityMultiplier
    );

    event PriceUpdated(
        bytes32 indexed songId,
        uint256 oldPrice,
        uint256 newPrice
    );

    event BulkDiscountApplied(
        bytes32 indexed songId,
        address indexed listener,
        uint256 discount
    );

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor(address _flowToken, address _router) {
        flowToken = IERC20(_flowToken);
        router = _router;
    }

    // ============================================================================
    // Configuration
    // ============================================================================

    function configurePricing(
        bytes32 songId,
        address artist,
        uint256 basePrice,
        uint256 popularityMultiplier,
        uint256 bulkDiscountThreshold,
        uint256 bulkDiscountBps,
        uint256 offPeakDiscountBps,
        uint256 offPeakStartHour,
        uint256 offPeakEndHour
    ) external {
        require(msg.sender == EconomicStrategyRouter(router).getSongArtist(songId),
            "Only artist can configure");
        require(!pricingConfigs[songId].initialized, "Already configured");
        require(basePrice > 0, "Base price must be > 0");
        require(popularityMultiplier <= 5000, "Multiplier too high (max 50%)");
        require(bulkDiscountBps <= 5000, "Bulk discount too high (max 50%)");
        require(offPeakDiscountBps <= 5000, "Off-peak discount too high (max 50%)");
        require(offPeakStartHour < 24 && offPeakEndHour < 24, "Invalid hours");

        pricingConfigs[songId] = PricingConfig({
            initialized: true,
            artist: artist,
            basePrice: basePrice,
            popularityMultiplier: popularityMultiplier,
            bulkDiscountThreshold: bulkDiscountThreshold,
            bulkDiscountBps: bulkDiscountBps,
            offPeakDiscountBps: offPeakDiscountBps,
            offPeakStartHour: offPeakStartHour,
            offPeakEndHour: offPeakEndHour
        });

        songStats[songId] = SongStats({
            totalPlays: 0,
            lastPriceUpdate: block.timestamp,
            currentPrice: basePrice
        });

        emit PricingConfigured(songId, basePrice, popularityMultiplier);
    }

    // ============================================================================
    // Payment Processing
    // ============================================================================

    function processPayment(
        bytes32 songId,
        address listener,
        uint256 amount,
        PaymentType paymentType
    ) external override returns (uint256 netAmount) {
        require(msg.sender == router, "Only router can process payments");
        require(paymentType == PaymentType.STREAM, "Only STREAM supported");

        PricingConfig memory config = pricingConfigs[songId];
        require(config.initialized, "Pricing not configured");

        // Calculate current price
        uint256 currentPrice = calculateCurrentPrice(songId);

        require(amount >= currentPrice, "Insufficient payment");

        // Update stats
        songStats[songId].totalPlays++;
        listenerStats[songId][listener].totalPlays++;
        listenerStats[songId][listener].lastPlayTime = block.timestamp;

        // Transfer payment to artist
        require(flowToken.transferFrom(listener, config.artist, amount),
            "Transfer failed");

        // Check if price needs updating (every 100 plays)
        if (songStats[songId].totalPlays % 100 == 0) {
            updatePrice(songId);
        }

        return amount;
    }

    // ============================================================================
    // Price Calculation
    // ============================================================================

    function calculateCurrentPrice(bytes32 songId) public view returns (uint256) {
        PricingConfig memory config = pricingConfigs[songId];
        SongStats memory stats = songStats[songId];

        // Start with base price
        uint256 price = config.basePrice;

        // Apply popularity multiplier (increases with play count)
        uint256 popularityIncrease = (stats.totalPlays / 100) * config.popularityMultiplier;
        price = (price * (10000 + popularityIncrease)) / 10000;

        // Apply off-peak discount if applicable
        uint256 currentHour = (block.timestamp / 3600) % 24;
        if (isOffPeakHour(currentHour, config.offPeakStartHour, config.offPeakEndHour)) {
            price = (price * (10000 - config.offPeakDiscountBps)) / 10000;
        }

        return price;
    }

    function calculateBulkPrice(
        bytes32 songId,
        address listener
    ) public view returns (uint256) {
        PricingConfig memory config = pricingConfigs[songId];
        ListenerStats memory stats = listenerStats[songId][listener];

        uint256 price = calculateCurrentPrice(songId);

        // Apply bulk discount if threshold met
        if (stats.totalPlays >= config.bulkDiscountThreshold) {
            price = (price * (10000 - config.bulkDiscountBps)) / 10000;
        }

        return price;
    }

    function isOffPeakHour(
        uint256 currentHour,
        uint256 startHour,
        uint256 endHour
    ) internal pure returns (bool) {
        if (startHour < endHour) {
            return currentHour >= startHour && currentHour < endHour;
        } else {
            // Wraps around midnight
            return currentHour >= startHour || currentHour < endHour;
        }
    }

    function updatePrice(bytes32 songId) internal {
        uint256 oldPrice = songStats[songId].currentPrice;
        uint256 newPrice = calculateCurrentPrice(songId);

        if (oldPrice != newPrice) {
            songStats[songId].currentPrice = newPrice;
            songStats[songId].lastPriceUpdate = block.timestamp;

            emit PriceUpdated(songId, oldPrice, newPrice);
        }
    }

    // ============================================================================
    // IEconomicStrategy Interface
    // ============================================================================

    function calculateSplits(
        bytes32 songId,
        uint256 amount
    ) external view override returns (Split[] memory) {
        PricingConfig memory config = pricingConfigs[songId];
        require(config.initialized, "Pricing not configured");

        Split[] memory splits = new Split[](1);
        splits[0] = Split({
            recipient: config.artist,
            basisPoints: 10000, // 100% to artist
            role: "artist"
        });

        return splits;
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    function getSongStats(bytes32 songId) external view returns (
        uint256 totalPlays,
        uint256 currentPrice,
        uint256 lastPriceUpdate
    ) {
        SongStats memory stats = songStats[songId];
        return (stats.totalPlays, stats.currentPrice, stats.lastPriceUpdate);
    }

    function getListenerStats(
        bytes32 songId,
        address listener
    ) external view returns (
        uint256 totalPlays,
        uint256 lastPlayTime,
        uint256 currentPrice,
        uint256 bulkPrice
    ) {
        ListenerStats memory stats = listenerStats[songId][listener];
        return (
            stats.totalPlays,
            stats.lastPlayTime,
            calculateCurrentPrice(songId),
            calculateBulkPrice(songId, listener)
        );
    }
}

/**
 * USAGE EXAMPLE:
 *
 * // Deploy
 * DynamicPricingStrategy strategy = new DynamicPricingStrategy(flowToken, router);
 *
 * // Configure for a song
 * strategy.configurePricing(
 *     songHash,
 *     artistAddress,
 *     0.01 ether,    // Base price: 0.01 tokens
 *     500,           // 5% price increase per 100 plays
 *     50,            // Bulk discount after 50 plays
 *     1000,          // 10% bulk discount
 *     2000,          // 20% off-peak discount
 *     22,            // Off-peak starts at 10 PM
 *     6              // Off-peak ends at 6 AM
 * );
 *
 * // Price evolution:
 * // - Start: 0.01 tokens
 * // - After 100 plays: 0.0105 tokens (5% increase)
 * // - After 200 plays: 0.011 tokens (10% increase)
 * // - During off-peak (10 PM - 6 AM): 20% discount
 * // - For listeners with 50+ plays: 10% additional discount
 */
