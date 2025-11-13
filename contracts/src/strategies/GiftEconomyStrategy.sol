// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../EconomicStrategyRouter.sol";

/**
 * @title GiftEconomyStrategy
 * @notice Free streaming model with optional tipping + CGC rewards for engaged listeners
 */
contract GiftEconomyStrategy is IEconomicStrategy, Ownable {
    IERC20 public immutable flowToken;
    address public immutable router;

    // CGC Registry interface (from commons-charter)
    interface ICGCRegistry {
        function awardCGC(address recipient, uint256 amount, string memory reason) external;
    }

    ICGCRegistry public cgcRegistry;

    struct GiftConfig {
        address artist;
        bool acceptsGifts;
        uint256 minGiftAmount;
        address[] recipients;
        uint256[] basisPoints;
        string[] roles;
        bool initialized;
    }

    struct RewardConfig {
        uint256 cgcPerListen;
        uint256 earlyListenerBonus;
        uint256 earlyListenerThreshold;
        uint256 repeatListenerMultiplier; // 10000 = 1x
    }

    struct ListenerProfile {
        uint256 totalStreamsCount;
        uint256 lastStreamTimestamp;
        uint256 cgcBalance;
        uint256 totalGiftsGiven;
        bool isEarlyListener;
    }

    mapping(bytes32 => GiftConfig) public giftConfigs;
    mapping(bytes32 => RewardConfig) public rewardConfigs;
    mapping(bytes32 => mapping(address => ListenerProfile)) public listenerProfiles;
    mapping(bytes32 => uint256) public listenerCount;
    mapping(bytes32 => uint256) public totalTipsReceived;

    // Events
    event GiftConfigured(
        bytes32 indexed songId,
        address indexed artist,
        bool acceptsGifts,
        uint256 minGiftAmount
    );
    event TipReceived(bytes32 indexed songId, address indexed listener, uint256 amount);
    event StreamReward(
        bytes32 indexed songId,
        address indexed listener,
        uint256 cgcAmount,
        bool isEarlyListener,
        bool isRepeatListener
    );
    event CGCDistributed(address indexed listener, uint256 amount);

    modifier onlyRouter() {
        require(msg.sender == router, "Only router can call");
        _;
    }

    modifier onlySongArtist(bytes32 songId) {
        require(
            EconomicStrategyRouter(router).songArtist(songId) == msg.sender,
            "Not song artist"
        );
        _;
    }

    constructor(address _flowToken, address _router, address _cgcRegistry) {
        require(_flowToken != address(0), "Invalid FLOW token");
        require(_router != address(0), "Invalid router");
        require(_cgcRegistry != address(0), "Invalid CGC registry");

        flowToken = IERC20(_flowToken);
        router = _router;
        cgcRegistry = ICGCRegistry(_cgcRegistry);
    }

    /**
     * @notice Configure gift + reward parameters for a song
     */
    function configureGiftEconomy(
        bytes32 songId,
        address[] calldata recipients,
        uint256[] calldata basisPoints,
        string[] calldata roles,
        bool acceptsGifts,
        uint256 minGiftAmount,
        uint256 cgcPerListen,
        uint256 earlyListenerBonus,
        uint256 earlyListenerThreshold,
        uint256 repeatListenerMultiplier
    ) external onlySongArtist(songId) {
        require(!giftConfigs[songId].initialized, "Already configured");
        require(recipients.length > 0, "No recipients");
        require(
            recipients.length == basisPoints.length && recipients.length == roles.length,
            "Length mismatch"
        );
        require(cgcPerListen > 0, "CGC per listen must be > 0");
        require(repeatListenerMultiplier >= 10000, "Invalid multiplier");

        uint256 totalBps = 0;
        for (uint256 i = 0; i < basisPoints.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            totalBps += basisPoints[i];
        }
        require(totalBps == 10000, "Splits must sum to 100%");

        GiftConfig storage config = giftConfigs[songId];
        config.artist = msg.sender;
        config.acceptsGifts = acceptsGifts;
        config.minGiftAmount = minGiftAmount;
        config.initialized = true;

        for (uint256 i = 0; i < recipients.length; i++) {
            config.recipients.push(recipients[i]);
            config.basisPoints.push(basisPoints[i]);
            config.roles.push(roles[i]);
        }

        rewardConfigs[songId] = RewardConfig({
            cgcPerListen: cgcPerListen,
            earlyListenerBonus: earlyListenerBonus,
            earlyListenerThreshold: earlyListenerThreshold,
            repeatListenerMultiplier: repeatListenerMultiplier
        });

        emit GiftConfigured(songId, msg.sender, acceptsGifts, minGiftAmount);
    }

    /**
     * @notice Process free listens or voluntary tips routed by the EconomicStrategyRouter
     */
    function processPayment(
        bytes32 songId,
        address listener,
        uint256 amount,
        EconomicStrategyRouter.PaymentType paymentType
    ) external override onlyRouter {
        GiftConfig storage config = giftConfigs[songId];
        require(config.initialized, "Gift economy not configured");

        RewardConfig storage rewards = rewardConfigs[songId];
        if (paymentType == EconomicStrategyRouter.PaymentType.STREAM || amount == 0) {
            _rewardListener(songId, listener, config, rewards);
            return;
        }

        if (paymentType == EconomicStrategyRouter.PaymentType.TIP) {
            require(config.acceptsGifts, "Gifts not accepted");
            require(amount >= config.minGiftAmount, "Gift too small");

            _distributeGift(songId, amount, config);
            totalTipsReceived[songId] += amount;

            ListenerProfile storage profile = listenerProfiles[songId][listener];
            profile.totalGiftsGiven += amount;

            emit TipReceived(songId, listener, amount);
            _rewardListener(songId, listener, config, rewards);
            return;
        }

        revert("Unsupported payment type");
    }

    /**
     * @notice Minimum payment enforcement (tips may require a floor)
     */
    function getMinPayment(
        bytes32 songId,
        EconomicStrategyRouter.PaymentType paymentType
    ) external view override returns (uint256) {
        if (paymentType != EconomicStrategyRouter.PaymentType.TIP) {
            return 0;
        }

        GiftConfig storage config = giftConfigs[songId];
        if (!config.initialized) {
            return 0;
        }

        return config.minGiftAmount;
    }

    /**
     * @notice Everyone can listen in the gift economy
     */
    function isAuthorized(bytes32 songId, address listener)
        external
        pure
        override
        returns (bool)
    {
        songId;
        listener;
        return true;
    }

    /**
     * @notice Preview how gifts are split amongst recipients
     */
    function calculateSplits(bytes32 songId, uint256 /* amount */ )
        external
        view
        override
        returns (EconomicStrategyRouter.Split[] memory)
    {
        GiftConfig storage config = giftConfigs[songId];
        require(config.initialized, "Gift economy not configured");

        EconomicStrategyRouter.Split[] memory splits =
            new EconomicStrategyRouter.Split[](config.recipients.length);

        for (uint256 i = 0; i < config.recipients.length; i++) {
            splits[i] = EconomicStrategyRouter.Split({
                recipient: config.recipients[i],
                basisPoints: config.basisPoints[i],
                role: config.roles[i]
            });
        }

        return splits;
    }

    // ============================================================
    // Listener Insights
    // ============================================================

    function getListenerProfile(bytes32 songId, address listener)
        external
        view
        returns (ListenerProfile memory)
    {
        return listenerProfiles[songId][listener];
    }

    function getSongStats(bytes32 songId)
        external
        view
        returns (
            GiftConfig memory config,
            RewardConfig memory rewards,
            uint256 listeners,
            uint256 totalTips
        )
    {
        return (giftConfigs[songId], rewardConfigs[songId], listenerCount[songId], totalTipsReceived[songId]);
    }

    // ============================================================
    // Internal Helpers
    // ============================================================

    function _rewardListener(
        bytes32 songId,
        address listener,
        GiftConfig storage config,
        RewardConfig storage rewards
    ) internal {
        ListenerProfile storage profile = listenerProfiles[songId][listener];

        uint256 reward = rewards.cgcPerListen;
        bool isEarly = false;
        bool isRepeat = false;

        if (listenerCount[songId] < rewards.earlyListenerThreshold && !profile.isEarlyListener) {
            reward += rewards.earlyListenerBonus;
            profile.isEarlyListener = true;
            isEarly = true;
        }

        if (profile.totalStreamsCount > 5 && rewards.repeatListenerMultiplier > 10000) {
            reward = (reward * rewards.repeatListenerMultiplier) / 10000;
            isRepeat = true;
        }

        if (profile.totalStreamsCount == 0) {
            listenerCount[songId]++;
        }

        profile.totalStreamsCount++;
        profile.lastStreamTimestamp = block.timestamp;
        profile.cgcBalance += reward;

        cgcRegistry.awardCGC(
            listener,
            reward,
            string(abi.encodePacked("Listened to song: ", bytes32ToString(songId)))
        );

        emit StreamReward(songId, listener, reward, isEarly, isRepeat);
        emit CGCDistributed(listener, reward);
    }

    function _distributeGift(bytes32 songId, uint256 amount, GiftConfig storage config) internal {
        uint256 distributed = 0;
        for (uint256 i = 0; i < config.recipients.length; i++) {
            uint256 share = (amount * config.basisPoints[i]) / 10000;
            distributed += share;
            if (share > 0) {
                require(
                    flowToken.transferFrom(router, config.recipients[i], share),
                    "Gift transfer failed"
                );
            }
        }

        // Handle rounding dust by sending it to the primary artist
        uint256 remainder = amount - distributed;
        if (remainder > 0) {
            require(
                flowToken.transferFrom(router, config.artist, remainder),
                "Remainder transfer failed"
            );
        }
    }

    // ============================================================
    // Admin utilities
    // ============================================================

    function updateCGCRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "Invalid registry");
        cgcRegistry = ICGCRegistry(newRegistry);
    }

    function bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while (i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}
