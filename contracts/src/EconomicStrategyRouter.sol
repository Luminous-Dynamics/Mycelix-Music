// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IEconomicStrategy
 * @notice Interface that all economic strategy contracts must implement
 */
interface IEconomicStrategy {
    enum PaymentType {
        STREAM,          // Per-stream payment
        TIP,             // Voluntary tip
        SUBSCRIPTION,    // Monthly subscription
        PURCHASE         // One-time purchase
    }

    /**
     * @notice Process a payment according to this strategy's rules
     * @param songId Unique identifier for the song
     * @param listener Address of the listener
     * @param amount Amount of FLOW tokens being paid
     * @param paymentType Type of payment (stream, tip, subscription, etc.)
     */
    function processPayment(
        bytes32 songId,
        address listener,
        uint256 amount,
        PaymentType paymentType
    ) external;

    /**
     * @notice Get the minimum payment amount for this strategy
     * @param songId Unique identifier for the song
     * @param paymentType Type of payment
     * @return Minimum payment amount in FLOW tokens
     */
    function getMinPayment(bytes32 songId, PaymentType paymentType) external view returns (uint256);

    /**
     * @notice Check if a listener is authorized to access a song
     * @param songId Unique identifier for the song
     * @param listener Address of the listener
     * @return True if authorized
     */
    function isAuthorized(bytes32 songId, address listener) external view returns (bool);
}

/**
 * @title EconomicStrategyRouter
 * @notice Core routing contract that delegates payment processing to pluggable strategy contracts
 * @dev Each song can use a different economic strategy, enabling modular economics
 */
contract EconomicStrategyRouter is Ownable, ReentrancyGuard {
    // FLOW token interface (from living-treasury)
    IERC20 public immutable flowToken;

    // Mapping: strategyId => strategy contract address
    mapping(bytes32 => address) public registeredStrategies;

    // Mapping: songId => strategyId
    mapping(bytes32 => bytes32) public songStrategy;

    // Mapping: songId => artist address
    mapping(bytes32 => address) public songArtist;

    // Protocol fee (in basis points, 100 = 1%)
    uint256 public protocolFeeBps = 100; // 1%

    // Protocol treasury address
    address public protocolTreasury;

    // Events
    event StrategyRegistered(bytes32 indexed strategyId, address strategyAddress);
    event SongRegistered(bytes32 indexed songId, bytes32 strategyId, address artist);
    event PaymentProcessed(
        bytes32 indexed songId,
        address indexed listener,
        uint256 amount,
        IEconomicStrategy.PaymentType paymentType
    );
    event ProtocolFeeUpdated(uint256 newFeeBps);
    event ProtocolTreasuryUpdated(address newTreasury);

    /**
     * @notice Constructor
     * @param _flowToken Address of the FLOW token contract
     * @param _protocolTreasury Address to receive protocol fees
     */
    constructor(address _flowToken, address _protocolTreasury) {
        require(_flowToken != address(0), "Invalid FLOW token address");
        require(_protocolTreasury != address(0), "Invalid treasury address");

        flowToken = IERC20(_flowToken);
        protocolTreasury = _protocolTreasury;
    }

    /**
     * @notice Register a new economic strategy
     * @param strategyId Unique identifier for the strategy
     * @param strategyAddress Address of the strategy contract
     */
    function registerStrategy(bytes32 strategyId, address strategyAddress) external onlyOwner {
        require(strategyAddress != address(0), "Invalid strategy address");
        require(registeredStrategies[strategyId] == address(0), "Strategy already registered");

        registeredStrategies[strategyId] = strategyAddress;
        emit StrategyRegistered(strategyId, strategyAddress);
    }

    /**
     * @notice Register a song with a specific economic strategy
     * @param songId Unique identifier for the song
     * @param strategyId The economic strategy to use
     * @param artist Address of the artist
     */
    function registerSong(
        bytes32 songId,
        bytes32 strategyId,
        address artist
    ) external {
        require(songStrategy[songId] == bytes32(0), "Song already registered");
        require(registeredStrategies[strategyId] != address(0), "Strategy not registered");
        require(artist != address(0), "Invalid artist address");

        songStrategy[songId] = strategyId;
        songArtist[songId] = artist;

        emit SongRegistered(songId, strategyId, artist);
    }

    /**
     * @notice Process a payment for a song
     * @param songId Unique identifier for the song
     * @param amount Amount of FLOW tokens to pay
     * @param paymentType Type of payment (stream, tip, subscription, etc.)
     */
    function processPayment(
        bytes32 songId,
        uint256 amount,
        IEconomicStrategy.PaymentType paymentType
    ) external nonReentrant {
        bytes32 strategyId = songStrategy[songId];
        require(strategyId != bytes32(0), "Song not registered");

        address strategyAddress = registeredStrategies[strategyId];
        require(strategyAddress != address(0), "Strategy not found");

        IEconomicStrategy strategy = IEconomicStrategy(strategyAddress);

        // Check minimum payment
        uint256 minPayment = strategy.getMinPayment(songId, paymentType);
        require(amount >= minPayment, "Payment below minimum");

        // Transfer FLOW tokens from listener to this contract
        require(
            flowToken.transferFrom(msg.sender, address(this), amount),
            "FLOW transfer failed"
        );

        // Calculate protocol fee
        uint256 protocolFee = (amount * protocolFeeBps) / 10000;
        uint256 netAmount = amount - protocolFee;

        // Transfer protocol fee to treasury
        if (protocolFee > 0) {
            require(flowToken.transfer(protocolTreasury, protocolFee), "Protocol fee transfer failed");
        }

        // Approve strategy to spend the net amount
        require(flowToken.approve(strategyAddress, netAmount), "Approval failed");

        // Delegate to strategy contract
        strategy.processPayment(songId, msg.sender, netAmount, paymentType);

        emit PaymentProcessed(songId, msg.sender, amount, paymentType);
    }

    /**
     * @notice Check if a listener is authorized to access a song
     * @param songId Unique identifier for the song
     * @param listener Address of the listener
     * @return True if authorized
     */
    function isAuthorized(bytes32 songId, address listener) external view returns (bool) {
        bytes32 strategyId = songStrategy[songId];
        if (strategyId == bytes32(0)) return false;

        address strategyAddress = registeredStrategies[strategyId];
        if (strategyAddress == address(0)) return false;

        IEconomicStrategy strategy = IEconomicStrategy(strategyAddress);
        return strategy.isAuthorized(songId, listener);
    }

    /**
     * @notice Update protocol fee (only owner)
     * @param newFeeBps New fee in basis points
     */
    function updateProtocolFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "Fee too high (max 5%)");
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(newFeeBps);
    }

    /**
     * @notice Update protocol treasury address (only owner)
     * @param newTreasury New treasury address
     */
    function updateProtocolTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        protocolTreasury = newTreasury;
        emit ProtocolTreasuryUpdated(newTreasury);
    }

    /**
     * @notice Get strategy address for a song
     * @param songId Unique identifier for the song
     * @return Address of the strategy contract
     */
    function getStrategyForSong(bytes32 songId) external view returns (address) {
        bytes32 strategyId = songStrategy[songId];
        return registeredStrategies[strategyId];
    }
}
