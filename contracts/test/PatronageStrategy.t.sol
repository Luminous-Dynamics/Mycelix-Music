// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../strategies/PatronageStrategy.sol";
import "../mocks/MockERC20.sol";
import "../mocks/MockRouter.sol";

contract PatronageStrategyTest is Test {
    PatronageStrategy public strategy;
    MockERC20 public flowToken;
    MockRouter public router;

    address public artist = address(0x1);
    address public patron1 = address(0x2);
    address public patron2 = address(0x3);

    string public songId = "song-patronage-1";

    function setUp() public {
        flowToken = new MockERC20("FLOW", "FLOW");
        router = new MockRouter();

        strategy = new PatronageStrategy(address(flowToken), address(router));

        // Mint tokens to patrons
        flowToken.mint(patron1, 1000 ether);
        flowToken.mint(patron2, 1000 ether);

        // Approve strategy
        vm.prank(patron1);
        flowToken.approve(address(strategy), type(uint256).max);

        vm.prank(patron2);
        flowToken.approve(address(strategy), type(uint256).max);
    }

    /**
     * Test basic patronage configuration
     */
    function testConfigurePatronage() public {
        uint256[] memory tierBonuses = new uint256[](4);
        tierBonuses[0] = 0;     // Tier 1: No bonus
        tierBonuses[1] = 500;   // Tier 2: 5% bonus
        tierBonuses[2] = 1000;  // Tier 3: 10% bonus
        tierBonuses[3] = 2000;  // Tier 4: 20% bonus

        vm.prank(artist);
        strategy.configurePatronage(
            songId,
            artist,
            10 ether,  // $10/month
            0,         // No minimum duration
            true,      // Allow cancellation
            tierBonuses
        );

        (
            address configArtist,
            uint256 monthlyFee,
            ,
            bool allowCancellation,
        ) = strategy.patronageConfigs(songId);

        assertEq(configArtist, artist);
        assertEq(monthlyFee, 10 ether);
        assertTrue(allowCancellation);
    }

    /**
     * Test subscription creation
     */
    function testSubscribe() public {
        _configureBasicPatronage();

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Check subscription was created
        (
            uint256 monthlyFee,
            uint256 startTime,
            uint256 lastPayment,
            bool active
        ) = strategy.subscriptions(patron1, artist);

        assertEq(monthlyFee, 10 ether);
        assertEq(startTime, block.timestamp);
        assertEq(lastPayment, block.timestamp);
        assertTrue(active);

        // Check payment was transferred
        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + 10 ether);

        // Check artist stats
        assertEq(strategy.patronCount(artist), 1);
        assertEq(strategy.artistRevenue(artist), 10 ether);
    }

    /**
     * Test cannot subscribe twice
     */
    function testCannotSubscribeTwice() public {
        _configureBasicPatronage();

        vm.startPrank(patron1);
        strategy.subscribe(artist, 10 ether);

        vm.expectRevert("Already subscribed");
        strategy.subscribe(artist, 10 ether);
        vm.stopPrank();
    }

    /**
     * Test subscription renewal
     */
    function testRenewSubscription() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Fast forward 30 days
        vm.warp(block.timestamp + 30 days);

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);

        vm.prank(patron1);
        strategy.renewSubscription(artist);

        // Check payment was made
        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + 10 ether);

        // Check revenue updated
        assertEq(strategy.artistRevenue(artist), 20 ether);

        // Check last payment updated
        (, , uint256 lastPayment, ) = strategy.subscriptions(patron1, artist);
        assertEq(lastPayment, block.timestamp);
    }

    /**
     * Test cannot renew too early
     */
    function testCannotRenewTooEarly() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Try to renew after only 15 days
        vm.warp(block.timestamp + 15 days);

        vm.prank(patron1);
        vm.expectRevert("Too early to renew");
        strategy.renewSubscription(artist);
    }

    /**
     * Test subscription cancellation
     */
    function testCancelSubscription() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        assertEq(strategy.patronCount(artist), 1);

        vm.prank(patron1);
        strategy.cancelSubscription(artist, songId);

        // Check subscription is inactive
        (, , , bool active) = strategy.subscriptions(patron1, artist);
        assertFalse(active);

        // Check patron count decreased
        assertEq(strategy.patronCount(artist), 0);
    }

    /**
     * Test cannot cancel with minimum duration
     */
    function testCannotCancelWithMinimumDuration() public {
        uint256[] memory tierBonuses = new uint256[](0);

        vm.prank(artist);
        strategy.configurePatronage(
            songId,
            artist,
            10 ether,
            90 days,   // 3 month minimum
            false,     // No early cancellation
            tierBonuses
        );

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Try to cancel after only 1 month
        vm.warp(block.timestamp + 30 days);

        vm.prank(patron1);
        vm.expectRevert("Minimum duration not met");
        strategy.cancelSubscription(artist, songId);

        // Should work after 90 days
        vm.warp(block.timestamp + 60 days);  // Total 90 days

        vm.prank(patron1);
        strategy.cancelSubscription(artist, songId);

        (, , , bool active) = strategy.subscriptions(patron1, artist);
        assertFalse(active);
    }

    /**
     * Test has active subscription
     */
    function testHasActiveSubscription() public {
        _configureBasicPatronage();

        // No subscription yet
        assertFalse(strategy.hasActiveSubscription(patron1, artist));

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Should have active subscription
        assertTrue(strategy.hasActiveSubscription(patron1, artist));

        // After cancellation
        vm.prank(patron1);
        strategy.cancelSubscription(artist, songId);

        assertFalse(strategy.hasActiveSubscription(patron1, artist));
    }

    /**
     * Test subscription expires without payment
     */
    function testSubscriptionExpiry() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Should be active initially
        assertTrue(strategy.hasActiveSubscription(patron1, artist));

        // Still active after 30 days (within grace period)
        vm.warp(block.timestamp + 30 days);
        assertTrue(strategy.hasActiveSubscription(patron1, artist));

        // Still active after 37 days (end of grace period)
        vm.warp(block.timestamp + 7 days);
        assertTrue(strategy.hasActiveSubscription(patron1, artist));

        // Expired after 38 days
        vm.warp(block.timestamp + 1 days);
        assertFalse(strategy.hasActiveSubscription(patron1, artist));
    }

    /**
     * Test subscription tiers
     */
    function testSubscriptionTiers() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        // Tier 1: 0-3 months
        assertEq(strategy.getSubscriptionTier(patron1, artist), 1);

        // Tier 2: 3-6 months
        vm.warp(block.timestamp + 100 days);
        assertEq(strategy.getSubscriptionTier(patron1, artist), 2);

        // Tier 3: 6-12 months
        vm.warp(block.timestamp + 100 days);
        assertEq(strategy.getSubscriptionTier(patron1, artist), 3);

        // Tier 4: 12+ months
        vm.warp(block.timestamp + 200 days);
        assertEq(strategy.getSubscriptionTier(patron1, artist), 4);
    }

    /**
     * Test process payment requires active subscription
     */
    function testProcessPaymentRequiresSubscription() public {
        _configureBasicPatronage();

        // Without subscription should fail
        vm.prank(address(router));
        vm.expectRevert("No active subscription");
        strategy.processPayment(
            songId,
            patron1,
            0,
            IEconomicStrategy.PaymentType.STREAM
        );

        // With subscription should succeed
        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        vm.prank(address(router));
        IEconomicStrategy.Split[] memory splits = strategy.processPayment(
            songId,
            patron1,
            0,
            IEconomicStrategy.PaymentType.STREAM
        );

        // Should return empty splits (already paid via subscription)
        assertEq(splits.length, 0);
    }

    /**
     * Test calculate splits
     */
    function testCalculateSplits() public {
        _configureBasicPatronage();

        IEconomicStrategy.Split[] memory splits = strategy.calculateSplits(songId, 0);

        assertEq(splits.length, 1);
        assertEq(splits[0].recipient, artist);
        assertEq(splits[0].amount, 10 ether);
        assertEq(splits[0].basisPoints, 10000);
    }

    /**
     * Test artist statistics
     */
    function testGetArtistStats() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        vm.prank(patron2);
        strategy.subscribe(artist, 10 ether);

        (
            uint256 activePatrons,
            uint256 totalRevenue,
        ) = strategy.getArtistStats(artist);

        assertEq(activePatrons, 2);
        assertEq(totalRevenue, 20 ether);
    }

    /**
     * Test multiple patrons
     */
    function testMultiplePatrons() public {
        _configureBasicPatronage();

        vm.prank(patron1);
        strategy.subscribe(artist, 10 ether);

        vm.prank(patron2);
        strategy.subscribe(artist, 10 ether);

        assertEq(strategy.patronCount(artist), 2);
        assertEq(strategy.artistRevenue(artist), 20 ether);

        // Both should have active subscriptions
        assertTrue(strategy.hasActiveSubscription(patron1, artist));
        assertTrue(strategy.hasActiveSubscription(patron2, artist));
    }

    // Helper function
    function _configureBasicPatronage() internal {
        uint256[] memory tierBonuses = new uint256[](0);

        vm.prank(artist);
        strategy.configurePatronage(
            songId,
            artist,
            10 ether,  // $10/month
            0,         // No minimum duration
            true,      // Allow cancellation
            tierBonuses
        );
    }
}
