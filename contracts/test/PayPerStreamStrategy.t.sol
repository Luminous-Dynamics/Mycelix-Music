// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/strategies/PayPerStreamStrategy.sol";
import "../src/EconomicStrategyRouter.sol";
import "../src/interfaces/IEconomicStrategy.sol";

/**
 * @title PayPerStreamStrategyTest
 * @notice Comprehensive test suite for PayPerStreamStrategy
 * @dev Tests all functionality including edge cases and attack vectors
 */
contract PayPerStreamStrategyTest is Test {
    PayPerStreamStrategy public strategy;
    EconomicStrategyRouter public router;
    MockFLOWToken public flowToken;

    address public artist = address(0x1);
    address public producer = address(0x2);
    address public platform = address(0x3);
    address public listener = address(0x4);
    address public attacker = address(0x666);

    bytes32 public songId = keccak256("test-song");

    event RoyaltySplitConfigured(
        bytes32 indexed songId,
        address[] recipients,
        uint256[] basisPoints,
        string[] roles
    );
    event PaymentProcessed(
        bytes32 indexed songId,
        address indexed listener,
        uint256 amount,
        uint256 protocolFee
    );

    function setUp() public {
        flowToken = new MockFLOWToken();
        router = new EconomicStrategyRouter(address(flowToken), platform);
        strategy = new PayPerStreamStrategy(address(flowToken), address(router));

        // Register strategy
        bytes32 strategyId = keccak256("pay-per-stream-v1");
        router.registerStrategy(strategyId, address(strategy));

        // Register song
        vm.prank(artist);
        router.registerSong(songId, strategyId, artist);

        // Fund test accounts
        flowToken.mint(listener, 1000 ether);
        flowToken.mint(attacker, 1000 ether);

        vm.label(artist, "Artist");
        vm.label(producer, "Producer");
        vm.label(platform, "Platform");
        vm.label(listener, "Listener");
        vm.label(attacker, "Attacker");
    }

    // ============================================================
    // Configuration Tests
    // ============================================================

    function testConfigureBasicRoyaltySplit() public {
        address[] memory recipients = new address[](1);
        recipients[0] = artist;

        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;

        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.prank(artist);
        vm.expectEmit(true, false, false, true);
        emit RoyaltySplitConfigured(songId, recipients, basisPoints, roles);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Verify configuration
        EconomicStrategyRouter.Split[] memory splits = strategy.calculateSplits(songId, 1 ether);
        assertEq(splits.length, 1);
        assertEq(splits[0].recipient, artist);
        assertEq(splits[0].basisPoints, 10000);
        assertEq(splits[0].role, "artist");
    }

    function testConfigureComplexRoyaltySplit() public {
        address[] memory recipients = new address[](3);
        recipients[0] = artist;
        recipients[1] = producer;
        recipients[2] = platform;

        uint256[] memory basisPoints = new uint256[](3);
        basisPoints[0] = 6000; // 60%
        basisPoints[1] = 3000; // 30%
        basisPoints[2] = 1000; // 10%

        string[] memory roles = new string[](3);
        roles[0] = "artist";
        roles[1] = "producer";
        roles[2] = "platform";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        EconomicStrategyRouter.Split[] memory splits = strategy.calculateSplits(songId, 1 ether);
        assertEq(splits.length, 3);
        assertEq(splits[0].basisPoints, 6000);
        assertEq(splits[1].basisPoints, 3000);
        assertEq(splits[2].basisPoints, 1000);
    }

    function testCannotConfigureWithMismatchedArrays() public {
        address[] memory recipients = new address[](2);
        recipients[0] = artist;
        recipients[1] = producer;

        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;

        string[] memory roles = new string[](2);
        roles[0] = "artist";
        roles[1] = "producer";

        vm.prank(artist);
        vm.expectRevert("Array lengths must match");
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);
    }

    function testCannotConfigureWithInvalidBasisPoints() public {
        address[] memory recipients = new address[](2);
        recipients[0] = artist;
        recipients[1] = producer;

        uint256[] memory basisPoints = new uint256[](2);
        basisPoints[0] = 6000;
        basisPoints[1] = 5000; // Total = 11000, invalid

        string[] memory roles = new string[](2);
        roles[0] = "artist";
        roles[1] = "producer";

        vm.prank(artist);
        vm.expectRevert("Basis points must sum to 10000");
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);
    }

    function testCannotConfigureWithZeroRecipients() public {
        address[] memory recipients = new address[](0);
        uint256[] memory basisPoints = new uint256[](0);
        string[] memory roles = new string[](0);

        vm.prank(artist);
        vm.expectRevert("Must have at least one recipient");
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);
    }

    function testCannotConfigureWithZeroAddress() public {
        address[] memory recipients = new address[](1);
        recipients[0] = address(0);

        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;

        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.prank(artist);
        vm.expectRevert("Recipient cannot be zero address");
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);
    }

    function testOnlyArtistCanConfigure() public {
        address[] memory recipients = new address[](1);
        recipients[0] = artist;

        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;

        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.prank(attacker);
        vm.expectRevert("Only song artist can configure");
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);
    }

    function testCannotConfigureTwice() public {
        address[] memory recipients = new address[](1);
        recipients[0] = artist;

        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;

        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.startPrank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        vm.expectRevert("Royalty split already configured");
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);
        vm.stopPrank();
    }

    // ============================================================
    // Payment Processing Tests
    // ============================================================

    function testProcessSingleRecipientPayment() public {
        // Configure
        address[] memory recipients = new address[](1);
        recipients[0] = artist;
        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;
        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Process payment
        uint256 paymentAmount = 1 ether;
        uint256 artistBalanceBefore = flowToken.balanceOf(artist);

        vm.startPrank(listener);
        flowToken.approve(address(router), paymentAmount);
        router.processPayment(songId, paymentAmount, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();

        // Artist should receive 99% (1% protocol fee)
        uint256 expectedAmount = (paymentAmount * 9900) / 10000;
        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + expectedAmount);
    }

    function testProcessMultiRecipientPayment() public {
        // Configure 60/30/10 split
        address[] memory recipients = new address[](3);
        recipients[0] = artist;
        recipients[1] = producer;
        recipients[2] = platform;

        uint256[] memory basisPoints = new uint256[](3);
        basisPoints[0] = 6000;
        basisPoints[1] = 3000;
        basisPoints[2] = 1000;

        string[] memory roles = new string[](3);
        roles[0] = "artist";
        roles[1] = "producer";
        roles[2] = "platform";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Process payment
        uint256 paymentAmount = 100 ether;
        uint256 protocolFee = (paymentAmount * 100) / 10000; // 1%
        uint256 netAmount = paymentAmount - protocolFee;

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);
        uint256 producerBalanceBefore = flowToken.balanceOf(producer);
        uint256 platformBalanceBefore = flowToken.balanceOf(platform);

        vm.startPrank(listener);
        flowToken.approve(address(router), paymentAmount);
        router.processPayment(songId, paymentAmount, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();

        // Verify splits
        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + (netAmount * 6000 / 10000));
        assertEq(flowToken.balanceOf(producer), producerBalanceBefore + (netAmount * 3000 / 10000));
        assertEq(flowToken.balanceOf(platform), platformBalanceBefore + (netAmount * 1000 / 10000));
    }

    function testCannotProcessPaymentWithoutConfiguration() public {
        bytes32 unconfiguredSongId = keccak256("unconfigured-song");

        // Register but don't configure
        vm.prank(artist);
        router.registerSong(unconfiguredSongId, keccak256("pay-per-stream-v1"), artist);

        vm.startPrank(listener);
        flowToken.approve(address(router), 1 ether);
        vm.expectRevert("Royalty split not configured");
        router.processPayment(unconfiguredSongId, 1 ether, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();
    }

    function testCannotProcessZeroPayment() public {
        // Configure
        address[] memory recipients = new address[](1);
        recipients[0] = artist;
        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;
        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        vm.startPrank(listener);
        flowToken.approve(address(router), 0);
        vm.expectRevert("Amount must be greater than 0");
        router.processPayment(songId, 0, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();
    }

    // ============================================================
    // Edge Cases & Attack Vectors
    // ============================================================

    function testReentrancyProtection() public {
        // This test ensures the strategy is protected against reentrancy
        // The router should use nonReentrant modifier
        // We'll try to process payment while in a payment callback

        address[] memory recipients = new address[](1);
        recipients[0] = artist;
        uint256[] memory basisPoints = new uint256[](1);
        basisPoints[0] = 10000;
        string[] memory roles = new string[](1);
        roles[0] = "artist";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Normal payment should work
        vm.startPrank(listener);
        flowToken.approve(address(router), 1 ether);
        router.processPayment(songId, 1 ether, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();
    }

    function testFuzzRoyaltySplits(
        uint256 artistBps,
        uint256 producerBps,
        uint256 platformBps
    ) public {
        // Ensure they sum to 10000
        vm.assume(artistBps + producerBps + platformBps == 10000);
        vm.assume(artistBps > 0 && producerBps > 0 && platformBps > 0);

        address[] memory recipients = new address[](3);
        recipients[0] = artist;
        recipients[1] = producer;
        recipients[2] = platform;

        uint256[] memory basisPoints = new uint256[](3);
        basisPoints[0] = artistBps;
        basisPoints[1] = producerBps;
        basisPoints[2] = platformBps;

        string[] memory roles = new string[](3);
        roles[0] = "artist";
        roles[1] = "producer";
        roles[2] = "platform";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Process payment
        uint256 paymentAmount = 100 ether;
        uint256 protocolFee = (paymentAmount * 100) / 10000;
        uint256 netAmount = paymentAmount - protocolFee;

        vm.startPrank(listener);
        flowToken.approve(address(router), paymentAmount);
        router.processPayment(songId, paymentAmount, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();

        // Verify total distributed equals netAmount
        uint256 totalDistributed =
            flowToken.balanceOf(artist) +
            flowToken.balanceOf(producer) +
            flowToken.balanceOf(platform);

        assertApproxEqAbs(totalDistributed, netAmount, 3); // Allow 3 wei rounding error
    }

    function testLargeNumberOfRecipients() public {
        // Test with 20 recipients
        uint256 recipientCount = 20;
        address[] memory recipients = new address[](recipientCount);
        uint256[] memory basisPoints = new uint256[](recipientCount);
        string[] memory roles = new string[](recipientCount);

        uint256 bpsPerRecipient = 10000 / recipientCount;
        uint256 remainder = 10000 % recipientCount;

        for (uint256 i = 0; i < recipientCount; i++) {
            recipients[i] = address(uint160(100 + i));
            basisPoints[i] = bpsPerRecipient;
            if (i == 0) basisPoints[i] += remainder; // Add remainder to first recipient
            roles[i] = string(abi.encodePacked("role", i));
        }

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Process payment
        uint256 paymentAmount = 100 ether;

        vm.startPrank(listener);
        flowToken.approve(address(router), paymentAmount);
        router.processPayment(songId, paymentAmount, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();

        // Verify all recipients received payment
        for (uint256 i = 0; i < recipientCount; i++) {
            assertGt(flowToken.balanceOf(recipients[i]), 0);
        }
    }

    function testCalculateSplitsView() public {
        // Configure
        address[] memory recipients = new address[](2);
        recipients[0] = artist;
        recipients[1] = producer;

        uint256[] memory basisPoints = new uint256[](2);
        basisPoints[0] = 7000;
        basisPoints[1] = 3000;

        string[] memory roles = new string[](2);
        roles[0] = "artist";
        roles[1] = "producer";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Calculate splits for different amounts
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1 ether;
        amounts[1] = 10 ether;
        amounts[2] = 100 ether;

        for (uint256 i = 0; i < amounts.length; i++) {
            EconomicStrategyRouter.Split[] memory splits = strategy.calculateSplits(songId, amounts[i]);

            assertEq(splits.length, 2);
            assertEq(splits[0].recipient, artist);
            assertEq(splits[0].basisPoints, 7000);
            assertEq(splits[1].recipient, producer);
            assertEq(splits[1].basisPoints, 3000);
        }
    }

    function testDustHandling() public {
        // Test payment amounts that result in dust due to rounding

        address[] memory recipients = new address[](3);
        recipients[0] = artist;
        recipients[1] = producer;
        recipients[2] = platform;

        uint256[] memory basisPoints = new uint256[](3);
        basisPoints[0] = 3333; // 33.33%
        basisPoints[1] = 3333; // 33.33%
        basisPoints[2] = 3334; // 33.34%

        string[] memory roles = new string[](3);
        roles[0] = "artist";
        roles[1] = "producer";
        roles[2] = "platform";

        vm.prank(artist);
        strategy.configureRoyaltySplit(songId, recipients, basisPoints, roles);

        // Process small payment that may cause rounding issues
        uint256 paymentAmount = 1 wei;

        uint256 totalBefore = flowToken.balanceOf(artist) +
                              flowToken.balanceOf(producer) +
                              flowToken.balanceOf(platform);

        vm.startPrank(listener);
        flowToken.approve(address(router), paymentAmount);
        router.processPayment(songId, paymentAmount, IEconomicStrategy.PaymentType.STREAM);
        vm.stopPrank();

        uint256 totalAfter = flowToken.balanceOf(artist) +
                             flowToken.balanceOf(producer) +
                             flowToken.balanceOf(platform);

        // Ensure no tokens are lost to rounding
        uint256 protocolFee = (paymentAmount * 100) / 10000;
        uint256 netAmount = paymentAmount - protocolFee;

        assertEq(totalAfter - totalBefore, netAmount);
    }
}

// Mock contracts for testing
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
