// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IEconomicStrategy.sol";
import "../interfaces/IEconomicStrategyRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AuctionStrategy
 * @notice Dutch auction model for limited release songs
 * @dev Implements declining price auction where price drops over time until sold out
 */
contract AuctionStrategy is IEconomicStrategy, Ownable, ReentrancyGuard {
    IEconomicStrategyRouter public router;
    IERC20 public paymentToken;

    // Auction types
    enum AuctionType {
        DUTCH,          // Price decreases over time
        ENGLISH,        // Price increases with bids
        SEALED_BID      // Blind bidding
    }

    // Auction configuration
    struct Auction {
        address artist;          // Artist address
        uint256 startPrice;      // Starting price (highest for Dutch)
        uint256 endPrice;        // Ending price (reserve for Dutch)
        uint256 startTime;       // Auction start timestamp
        uint256 endTime;         // Auction end timestamp
        uint256 totalSupply;     // Total number of access tokens
        uint256 sold;            // Number sold
        AuctionType auctionType; // Type of auction
        bool active;             // Whether auction is active
        uint256 priceDecrement;  // How much price drops per time unit
    }

    // Purchase record
    struct Purchase {
        address buyer;
        uint256 pricePaid;
        uint256 timestamp;
        uint256 accessExpiry;  // When access expires (0 = permanent)
    }

    // Storage
    mapping(string => Auction) public auctions;  // songId => auction
    mapping(string => Purchase[]) public purchases;  // songId => purchases
    mapping(string => mapping(address => bool)) public hasAccess;  // songId => buyer => hasAccess
    mapping(address => uint256) public artistRevenue;  // artist => total revenue

    // Events
    event AuctionCreated(
        string indexed songId,
        address artist,
        uint256 startPrice,
        uint256 endPrice,
        uint256 totalSupply
    );
    event Purchase Made(
        string indexed songId,
        address indexed buyer,
        uint256 pricePaid,
        uint256 timestamp
    );
    event AuctionEnded(string indexed songId, uint256 totalSold, uint256 totalRevenue);
    event PriceUpdated(string indexed songId, uint256 newPrice);

    constructor(address _paymentToken, address _router) {
        paymentToken = IERC20(_paymentToken);
        router = IEconomicStrategyRouter(_router);
    }

    /**
     * @notice Create a Dutch auction for a song
     */
    function createDutchAuction(
        string calldata songId,
        address artist,
        uint256 startPrice,
        uint256 endPrice,
        uint256 duration,
        uint256 totalSupply,
        uint256 priceDecrement
    ) external {
        require(msg.sender == artist || msg.sender == address(router), "Not authorized");
        require(startPrice > endPrice, "Start price must be > end price");
        require(totalSupply > 0, "Supply must be > 0");
        require(duration > 0, "Duration must be > 0");

        auctions[songId] = Auction({
            artist: artist,
            startPrice: startPrice,
            endPrice: endPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            totalSupply: totalSupply,
            sold: 0,
            auctionType: AuctionType.DUTCH,
            active: true,
            priceDecrement: priceDecrement
        });

        emit AuctionCreated(songId, artist, startPrice, endPrice, totalSupply);
    }

    /**
     * @notice Get current price for Dutch auction
     */
    function getCurrentPrice(string calldata songId) public view returns (uint256) {
        Auction memory auction = auctions[songId];
        require(auction.active, "Auction not active");

        if (auction.auctionType != AuctionType.DUTCH) {
            return auction.startPrice;  // For other types, return start price
        }

        // Calculate price based on time elapsed
        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 duration = auction.endTime - auction.startTime;

        if (block.timestamp >= auction.endTime) {
            return auction.endPrice;  // Auction ended, return reserve price
        }

        // Linear price decrease
        uint256 priceRange = auction.startPrice - auction.endPrice;
        uint256 priceDecrease = (priceRange * elapsed) / duration;

        return auction.startPrice - priceDecrease;
    }

    /**
     * @notice Purchase access to a song in auction
     */
    function purchaseAccess(
        string calldata songId,
        uint256 maxPrice
    ) external nonReentrant returns (uint256 pricePaid) {
        Auction storage auction = auctions[songId];
        require(auction.active, "Auction not active");
        require(auction.sold < auction.totalSupply, "Sold out");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(!hasAccess[songId][msg.sender], "Already purchased");

        // Get current price
        pricePaid = getCurrentPrice(songId);
        require(pricePaid <= maxPrice, "Price too high");

        // Transfer payment
        require(
            paymentToken.transferFrom(msg.sender, auction.artist, pricePaid),
            "Payment failed"
        );

        // Record purchase
        purchases[songId].push(Purchase({
            buyer: msg.sender,
            pricePaid: pricePaid,
            timestamp: block.timestamp,
            accessExpiry: 0  // Permanent access
        }));

        hasAccess[songId][msg.sender] = true;
        auction.sold++;
        artistRevenue[auction.artist] += pricePaid;

        emit PurchaseMade(songId, msg.sender, pricePaid, block.timestamp);

        // Check if sold out
        if (auction.sold >= auction.totalSupply) {
            _endAuction(songId);
        }

        return pricePaid;
    }

    /**
     * @notice End auction manually (artist only)
     */
    function endAuction(string calldata songId) external {
        Auction storage auction = auctions[songId];
        require(msg.sender == auction.artist, "Not artist");
        require(auction.active, "Auction not active");

        _endAuction(songId);
    }

    /**
     * @notice Internal function to end auction
     */
    function _endAuction(string memory songId) internal {
        Auction storage auction = auctions[songId];
        auction.active = false;

        uint256 totalRevenue = auction.sold * auction.startPrice;  // Simplified
        emit AuctionEnded(songId, auction.sold, totalRevenue);
    }

    /**
     * @notice Get auction statistics
     */
    function getAuctionStats(string calldata songId) external view returns (
        uint256 currentPrice,
        uint256 sold,
        uint256 remaining,
        uint256 totalRevenue,
        uint256 avgPrice,
        bool active
    ) {
        Auction memory auction = auctions[songId];

        currentPrice = auction.active ? getCurrentPrice(songId) : 0;
        sold = auction.sold;
        remaining = auction.totalSupply - auction.sold;
        totalRevenue = artistRevenue[auction.artist];

        // Calculate average price
        if (sold > 0) {
            Purchase[] memory songPurchases = purchases[songId];
            uint256 sum = 0;
            for (uint256 i = 0; i < songPurchases.length; i++) {
                sum += songPurchases[i].pricePaid;
            }
            avgPrice = sum / sold;
        }

        active = auction.active;
    }

    /**
     * @notice Get purchase history for a song
     */
    function getPurchaseHistory(
        string calldata songId,
        uint256 offset,
        uint256 limit
    ) external view returns (Purchase[] memory) {
        Purchase[] memory allPurchases = purchases[songId];
        uint256 total = allPurchases.length;

        if (offset >= total) {
            return new Purchase[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 resultLength = end - offset;
        Purchase[] memory result = new Purchase[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allPurchases[offset + i];
        }

        return result;
    }

    /**
     * @notice Process payment (IEconomicStrategy interface)
     */
    function processPayment(
        string calldata songId,
        address listener,
        uint256 amount,
        PaymentType paymentType
    ) external override returns (Split[] memory splits) {
        require(msg.sender == address(router), "Only router");

        // Verify listener has purchased access
        require(hasAccess[songId][listener], "No access");

        // For auction, no additional payment needed for plays
        // Access was already purchased
        return new Split[](0);
    }

    /**
     * @notice Calculate splits (IEconomicStrategy interface)
     */
    function calculateSplits(
        string calldata songId,
        uint256 amount
    ) external view override returns (Split[] memory splits) {
        Auction memory auction = auctions[songId];
        require(auction.artist != address(0), "Auction not configured");

        uint256 currentPrice = getCurrentPrice(songId);

        splits = new Split[](1);
        splits[0] = Split({
            recipient: auction.artist,
            amount: currentPrice,
            basisPoints: 10000,
            role: "artist"
        });

        return splits;
    }

    /**
     * @notice Refund mechanism for failed auctions
     * @dev Allows buyers to claim refunds if auction is cancelled
     */
    function claimRefund(string calldata songId) external nonReentrant {
        Auction memory auction = auctions[songId];
        require(!auction.active, "Auction still active");
        require(auction.sold == 0, "Auction had sales");
        require(hasAccess[songId][msg.sender], "No purchase");

        // Find purchase
        Purchase[] memory songPurchases = purchases[songId];
        uint256 refundAmount = 0;

        for (uint256 i = 0; i < songPurchases.length; i++) {
            if (songPurchases[i].buyer == msg.sender) {
                refundAmount = songPurchases[i].pricePaid;
                break;
            }
        }

        require(refundAmount > 0, "No refund available");

        // Transfer refund
        hasAccess[songId][msg.sender] = false;
        paymentToken.transfer(msg.sender, refundAmount);
    }
}
