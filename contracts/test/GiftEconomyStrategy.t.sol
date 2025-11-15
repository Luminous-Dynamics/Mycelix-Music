// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/strategies/GiftEconomyStrategy.sol";
import "../src/EconomicStrategyRouter.sol";
import "../src/interfaces/IEconomicStrategy.sol";

/**
 * @title GiftEconomyStrategyTest
 * @notice Comprehensive test suite for Gift Economy model
 * @dev Tests rewards, bonuses, multipliers, and edge cases
 */
contract GiftEconomyStrategyTest is Test {
    GiftEconomyStrategy public strategy;
    EconomicStrategyRouter public router;
    MockFLOWToken public flowToken;
    MockCGCRegistry public cgcRegistry;

    address public artist = address(0x1);
    address public listener1 = address(0x2);
    address public listener2 = address(0x3);
    address public listener3 = address(0x4);
    address public platform = address(0x5);

    bytes32 public songId = keccak256("gift-song");

    event GiftEconomyConfigured(
        bytes32 indexed songId,
        address indexed artist,
        uint256 cgcPerListen,
        uint256 earlyListenerBonus,
        uint256 earlyListenerThreshold,
        uint256 repeatListenerMultiplier
    );
    event CGCRewarded(
        bytes32 indexed songId,
        address indexed listener,
        uint256 amount,
        string rewardType
    );

    function setUp() public {
        flowToken = new MockFLOWToken();
        cgcRegistry = new MockCGCRegistry();
        router = new EconomicStrategyRouter(address(flowToken), platform);
        strategy = new GiftEconomyStrategy(
            address(flowToken),
            address(router),
            address(cgcRegistry)
        );

        // Register strategy
        bytes32 strategyId = keccak256("gift-economy-v1");
        router.registerStrategy(strategyId, address(strategy));

        // Register song
        vm.prank(artist);
        router.registerSong(songId, strategyId, artist);

        // Fund test accounts
        flowToken.mint(listener1, 1000 ether);
        flowToken.mint(listener2, 1000 ether);
        flowToken.mint(listener3, 1000 ether);

        vm.label(artist, "Artist");
        vm.label(listener1, "Listener1");
        vm.label(listener2, "Listener2");
        vm.label(listener3, "Listener3");
    }

    // ============================================================
    // Configuration Tests
    // ============================================================

    function testConfigureGiftEconomy() public {
        uint256 cgcPerListen = 1 ether;
        uint256 earlyBonus = 5 ether;
        uint256 threshold = 100;
        uint256 multiplier = 15000; // 1.5x

        vm.prank(artist);
        vm.expectEmit(true, true, false, true);
        emit GiftEconomyConfigured(
            songId,
            artist,
            cgcPerListen,
            earlyBonus,
            threshold,
            multiplier
        );
        strategy.configureGiftEconomy(
            songId,
            artist,
            cgcPerListen,
            earlyBonus,
            threshold,
            multiplier
        );

        // Verify configuration by triggering a stream
        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);

        (uint256 streams, , uint256 cgc, bool isEarly) =
            strategy.getListenerProfile(songId, listener1);

        assertEq(streams, 1);
        assertEq(cgc, cgcPerListen + earlyBonus);
        assertTrue(isEarly);
    }

    function testOnlyArtistCanConfigure() public {
        vm.prank(listener1);
        vm.expectRevert("Only song artist can configure");
        strategy.configureGiftEconomy(
            songId,
            artist,
            1 ether,
            5 ether,
            100,
            15000
        );
    }

    function testCannotConfigureTwice() public {
        vm.startPrank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 5 ether, 100, 15000);

        vm.expectRevert("Gift economy already configured");
        strategy.configureGiftEconomy(songId, artist, 2 ether, 10 ether, 200, 20000);
        vm.stopPrank();
    }

    function testCannotConfigureWithInvalidMultiplier() public {
        vm.prank(artist);
        vm.expectRevert("Multiplier must be >= 10000");
        strategy.configureGiftEconomy(songId, artist, 1 ether, 5 ether, 100, 9999);
    }

    function testCannotConfigureWithZeroArtist() public {
        vm.prank(artist);
        vm.expectRevert("Artist cannot be zero address");
        strategy.configureGiftEconomy(songId, address(0), 1 ether, 5 ether, 100, 15000);
    }

    // ============================================================
    // Free Listening & CGC Rewards Tests
    // ============================================================

    function testFreeListening() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 5 ether, 100, 15000);

        uint256 cgcBefore = cgcRegistry.cgcBalance(listener1);

        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);

        uint256 cgcAfter = cgcRegistry.cgcBalance(listener1);

        // Should receive base + early bonus
        assertEq(cgcAfter, cgcBefore + 6 ether); // 1 + 5
    }

    function testEarlyListenerBonus() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            1 ether,  // Base reward
            10 ether, // Early bonus
            3,        // First 3 listeners only
            15000
        );

        // First listener gets bonus
        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        assertEq(cgcRegistry.cgcBalance(listener1), 11 ether);

        // Second listener gets bonus
        vm.prank(address(router));
        strategy.processPayment(songId, listener2, 0, IEconomicStrategy.PaymentType.STREAM);
        assertEq(cgcRegistry.cgcBalance(listener2), 11 ether);

        // Third listener gets bonus
        vm.prank(address(router));
        strategy.processPayment(songId, listener3, 0, IEconomicStrategy.PaymentType.STREAM);
        assertEq(cgcRegistry.cgcBalance(listener3), 11 ether);

        // Fourth listener (new address) does NOT get bonus
        address listener4 = address(0x99);
        vm.prank(address(router));
        strategy.processPayment(songId, listener4, 0, IEconomicStrategy.PaymentType.STREAM);
        assertEq(cgcRegistry.cgcBalance(listener4), 1 ether); // Only base reward
    }

    function testRepeatListenerMultiplier() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            1 ether,
            0,        // No early bonus for simplicity
            1000,     // Large threshold so everyone is early
            20000     // 2x multiplier
        );

        // First 5 listens - no multiplier yet
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(address(router));
            strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        }

        uint256 cgcAfter5 = cgcRegistry.cgcBalance(listener1);
        assertEq(cgcAfter5, 5 ether); // 5 listens * 1 CGC

        // 6th listen - multiplier kicks in
        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);

        uint256 cgcAfter6 = cgcRegistry.cgcBalance(listener1);
        assertEq(cgcAfter6, 7 ether); // 5 + (1 * 2x)
    }

    function testCombinedBonusesAndMultipliers() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            2 ether,   // Base
            8 ether,   // Early bonus
            100,       // Early threshold
            30000      // 3x multiplier
        );

        // First listen: base + early bonus
        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        assertEq(cgcRegistry.cgcBalance(listener1), 10 ether); // 2 + 8

        // Listens 2-5: only base
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(address(router));
            strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        }
        assertEq(cgcRegistry.cgcBalance(listener1), 18 ether); // 10 + (4 * 2)

        // 6th listen: base * multiplier
        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        assertEq(cgcRegistry.cgcBalance(listener1), 24 ether); // 18 + (2 * 3)
    }

    // ============================================================
    // Tipping Tests
    // ============================================================

    function testTipWithCGCReward() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 5 ether, 100, 15000);

        uint256 tipAmount = 10 ether;
        uint256 protocolFee = (tipAmount * 100) / 10000; // 1%
        uint256 netAmount = tipAmount - protocolFee;

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);
        uint256 cgcBefore = cgcRegistry.cgcBalance(listener1);

        vm.startPrank(listener1);
        flowToken.approve(address(router), tipAmount);
        vm.stopPrank();

        vm.prank(address(router));
        strategy.processPayment(songId, listener1, tipAmount, IEconomicStrategy.PaymentType.TIP);

        // Artist receives tip
        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + netAmount);

        // Listener receives CGC (tip counts as a listen)
        assertGt(cgcRegistry.cgcBalance(listener1), cgcBefore);
    }

    function testMultipleTips() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 0, 1000, 15000);

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);

        for (uint256 i = 0; i < 5; i++) {
            uint256 tipAmount = (i + 1) * 1 ether;
            vm.startPrank(listener1);
            flowToken.approve(address(router), tipAmount);
            vm.stopPrank();

            vm.prank(address(router));
            strategy.processPayment(songId, listener1, tipAmount, IEconomicStrategy.PaymentType.TIP);
        }

        // Artist should have received all tips (minus protocol fees)
        uint256 totalTips = 15 ether; // 1+2+3+4+5
        uint256 totalFees = (totalTips * 100) / 10000;
        uint256 expectedNet = totalTips - totalFees;

        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + expectedNet);

        // Listener should have CGC from tips
        assertEq(cgcRegistry.cgcBalance(listener1), 5 ether); // 5 tips = 5 CGC
    }

    function testCannotTipZero() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 0, 1000, 15000);

        vm.prank(address(router));
        vm.expectRevert("Tip amount must be greater than 0");
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.TIP);
    }

    // ============================================================
    // Listener Profile Tests
    // ============================================================

    function testGetListenerProfile() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 5 ether, 100, 15000);

        // Listen 3 times
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(address(router));
            strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        }

        (uint256 totalStreams, uint256 lastStreamTime, uint256 cgcBalance, bool isEarly) =
            strategy.getListenerProfile(songId, listener1);

        assertEq(totalStreams, 3);
        assertGt(lastStreamTime, 0);
        assertEq(cgcBalance, 8 ether); // 1*3 + 5 bonus
        assertTrue(isEarly);
    }

    function testProfileAcrossMultipleListeners() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 2 ether, 10 ether, 2, 20000);

        // Listener 1: 1 stream (early)
        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);

        // Listener 2: 1 stream (early)
        vm.prank(address(router));
        strategy.processPayment(songId, listener2, 0, IEconomicStrategy.PaymentType.STREAM);

        // Listener 3: 1 stream (NOT early)
        vm.prank(address(router));
        strategy.processPayment(songId, listener3, 0, IEconomicStrategy.PaymentType.STREAM);

        (, , uint256 cgc1, bool early1) = strategy.getListenerProfile(songId, listener1);
        (, , uint256 cgc2, bool early2) = strategy.getListenerProfile(songId, listener2);
        (, , uint256 cgc3, bool early3) = strategy.getListenerProfile(songId, listener3);

        assertEq(cgc1, 12 ether); // 2 + 10 bonus
        assertTrue(early1);

        assertEq(cgc2, 12 ether); // 2 + 10 bonus
        assertTrue(early2);

        assertEq(cgc3, 2 ether); // 2 only, no bonus
        assertFalse(early3);
    }

    // ============================================================
    // Calculate Splits Tests
    // ============================================================

    function testCalculateSplits() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 5 ether, 100, 15000);

        EconomicStrategyRouter.Split[] memory splits = strategy.calculateSplits(songId, 100 ether);

        assertEq(splits.length, 1);
        assertEq(splits[0].recipient, artist);
        assertEq(splits[0].basisPoints, 10000); // 100% to artist
        assertEq(splits[0].role, "artist");
    }

    function testCannotCalculateSplitsWithoutConfiguration() public {
        bytes32 unconfiguredSongId = keccak256("unconfigured");

        vm.prank(artist);
        router.registerSong(unconfiguredSongId, keccak256("gift-economy-v1"), artist);

        vm.expectRevert("Gift economy not configured");
        strategy.calculateSplits(unconfiguredSongId, 1 ether);
    }

    // ============================================================
    // Edge Cases & Fuzz Tests
    // ============================================================

    function testFuzzCGCRewards(
        uint256 cgcPerListen,
        uint256 earlyBonus,
        uint256 threshold,
        uint256 multiplier
    ) public {
        // Bound inputs to reasonable ranges
        cgcPerListen = bound(cgcPerListen, 0.01 ether, 100 ether);
        earlyBonus = bound(earlyBonus, 0, 1000 ether);
        threshold = bound(threshold, 1, 10000);
        multiplier = bound(multiplier, 10000, 100000); // 1x to 10x

        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            cgcPerListen,
            earlyBonus,
            threshold,
            multiplier
        );

        // Process several streams
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(address(router));
            strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        }

        // Listener should have some CGC
        assertGt(cgcRegistry.cgcBalance(listener1), 0);
    }

    function testManyListeners() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(songId, artist, 1 ether, 10 ether, 50, 15000);

        // Simulate 100 unique listeners
        for (uint160 i = 1; i <= 100; i++) {
            address listener = address(i + 1000);
            vm.prank(address(router));
            strategy.processPayment(songId, listener, 0, IEconomicStrategy.PaymentType.STREAM);

            (, , uint256 cgc, bool isEarly) = strategy.getListenerProfile(songId, listener);

            if (i <= 50) {
                // Early listeners
                assertEq(cgc, 11 ether);
                assertTrue(isEarly);
            } else {
                // Regular listeners
                assertEq(cgc, 1 ether);
                assertFalse(isEarly);
            }
        }
    }

    function testZeroCGCPerListen() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            0,        // No CGC per listen
            100 ether, // But big early bonus
            10,
            15000
        );

        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);

        // Should still get early bonus
        assertEq(cgcRegistry.cgcBalance(listener1), 100 ether);
    }

    function testZeroEarlyBonus() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            5 ether,
            0,        // No early bonus
            100,
            15000
        );

        vm.prank(address(router));
        strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);

        // Should only get base CGC
        assertEq(cgcRegistry.cgcBalance(listener1), 5 ether);
    }

    function testHighMultiplier() public {
        vm.prank(artist);
        strategy.configureGiftEconomy(
            songId,
            artist,
            1 ether,
            0,
            1000,
            100000    // 10x multiplier
        );

        // Listen 6 times to trigger multiplier
        for (uint256 i = 0; i < 6; i++) {
            vm.prank(address(router));
            strategy.processPayment(songId, listener1, 0, IEconomicStrategy.PaymentType.STREAM);
        }

        // 6th listen should give 10x
        assertEq(cgcRegistry.cgcBalance(listener1), 15 ether); // 5 + (1 * 10)
    }
}

// Mock CGC Registry
contract MockCGCRegistry {
    mapping(address => uint256) public cgcBalance;

    function mint(address to, uint256 amount) public {
        cgcBalance[to] += amount;
    }

    function reward(address listener, uint256 amount, string memory) public {
        cgcBalance[listener] += amount;
    }
}

// Mock FLOW Token (reused from PayPerStreamStrategy tests)
contract MockFLOWToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) public {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        return true;
    }
}
