// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../strategies/PlatformSubscriptionStrategy.sol";
import "../core/MusicNFT.sol";

contract PlatformSubscriptionStrategyTest is Test {
    PlatformSubscriptionStrategy public subscription;
    MusicNFT public musicNFT;

    address public owner = address(1);
    address public platform = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public artist1 = address(5);
    address public artist2 = address(6);

    // Tier prices (in wei)
    uint256 constant FREE_PRICE = 0;
    uint256 constant BASIC_PRICE = 0.01 ether;
    uint256 constant PREMIUM_PRICE = 0.02 ether;
    uint256 constant SUPPORTER_PRICE = 0.05 ether;

    uint256 constant GRACE_PERIOD = 7 days;
    uint256 constant SUBSCRIPTION_PERIOD = 30 days;

    event Subscribed(address indexed user, uint8 tier, uint256 endDate);
    event Renewed(address indexed user, uint8 tier, uint256 endDate);
    event Cancelled(address indexed user, uint8 tier);
    event TierUpgraded(address indexed user, uint8 fromTier, uint8 toTier);
    event RevenueDistributed(uint256 artistShare, uint256 platformShare, uint256 patronagePool);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy contracts
        musicNFT = new MusicNFT();
        subscription = new PlatformSubscriptionStrategy(address(musicNFT), platform);

        // Give users some ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);

        vm.stopPrank();
    }

    // ============================================
    // BASIC FUNCTIONALITY TESTS
    // ============================================

    function testSubscribeFREE() public {
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit Subscribed(user1, 0, block.timestamp + SUBSCRIPTION_PERIOD);

        subscription.subscribe(0); // FREE tier

        (uint8 tier, uint256 endDate, bool active, bool autoRenew) = subscription.subscriptions(user1);
        assertEq(tier, 0, "Should be FREE tier");
        assertEq(endDate, block.timestamp + SUBSCRIPTION_PERIOD, "End date should be 30 days from now");
        assertTrue(active, "Subscription should be active");
        assertTrue(autoRenew, "Auto-renew should be enabled");
    }

    function testSubscribeBASIC() public {
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit Subscribed(user1, 1, block.timestamp + SUBSCRIPTION_PERIOD);

        subscription.subscribe{value: BASIC_PRICE}(1); // BASIC tier

        (uint8 tier, uint256 endDate, bool active, ) = subscription.subscriptions(user1);
        assertEq(tier, 1, "Should be BASIC tier");
        assertTrue(active, "Subscription should be active");
    }

    function testSubscribePREMIUM() public {
        vm.prank(user1);
        subscription.subscribe{value: PREMIUM_PRICE}(2); // PREMIUM tier

        (uint8 tier, , , ) = subscription.subscriptions(user1);
        assertEq(tier, 2, "Should be PREMIUM tier");
    }

    function testSubscribeSUPPORTER() public {
        vm.prank(user1);
        subscription.subscribe{value: SUPPORTER_PRICE}(3); // ARTIST_SUPPORTER tier

        (uint8 tier, , , ) = subscription.subscriptions(user1);
        assertEq(tier, 3, "Should be ARTIST_SUPPORTER tier");
    }

    function testSubscribeRevertInvalidTier() public {
        vm.prank(user1);
        vm.expectRevert("Invalid tier");
        subscription.subscribe{value: BASIC_PRICE}(4); // Invalid tier
    }

    function testSubscribeRevertInsufficientPayment() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient payment");
        subscription.subscribe{value: 0.005 ether}(1); // BASIC tier costs 0.01 ETH
    }

    function testSubscribeRevertAlreadyActive() public {
        vm.startPrank(user1);
        subscription.subscribe(0); // Subscribe to FREE

        vm.expectRevert("Already subscribed");
        subscription.subscribe(0); // Try to subscribe again
        vm.stopPrank();
    }

    function testUpgradeTier() public {
        vm.startPrank(user1);

        // Subscribe to BASIC
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Advance time by 15 days (half the period)
        vm.warp(block.timestamp + 15 days);

        // Upgrade to PREMIUM (should pay pro-rated amount)
        uint256 proRatedAmount = (PREMIUM_PRICE - BASIC_PRICE) / 2; // Half the difference

        vm.expectEmit(true, false, false, true);
        emit TierUpgraded(user1, 1, 2);

        subscription.upgradeTier{value: PREMIUM_PRICE - BASIC_PRICE}(2);

        (uint8 tier, , , ) = subscription.subscriptions(user1);
        assertEq(tier, 2, "Should be upgraded to PREMIUM");

        vm.stopPrank();
    }

    function testDowngradeTier() public {
        vm.startPrank(user1);

        // Subscribe to PREMIUM
        subscription.subscribe{value: PREMIUM_PRICE}(2);

        // Downgrade to BASIC (no refund, takes effect at period end)
        subscription.downgradeTier(1);

        (uint8 tier, , , ) = subscription.subscriptions(user1);
        assertEq(tier, 2, "Should still be PREMIUM until period end");

        // Warp to period end
        vm.warp(block.timestamp + SUBSCRIPTION_PERIOD + 1);

        // Renew (should be at BASIC tier)
        subscription.renewSubscription{value: BASIC_PRICE}();

        (tier, , , ) = subscription.subscriptions(user1);
        assertEq(tier, 1, "Should be downgraded to BASIC");

        vm.stopPrank();
    }

    function testRenewSubscription() public {
        vm.startPrank(user1);

        // Subscribe to BASIC
        subscription.subscribe{value: BASIC_PRICE}(1);
        uint256 firstEndDate = block.timestamp + SUBSCRIPTION_PERIOD;

        // Warp to just before expiry
        vm.warp(block.timestamp + SUBSCRIPTION_PERIOD - 1 days);

        // Renew
        vm.expectEmit(true, false, false, true);
        emit Renewed(user1, 1, firstEndDate + SUBSCRIPTION_PERIOD);

        subscription.renewSubscription{value: BASIC_PRICE}();

        (, uint256 endDate, bool active, ) = subscription.subscriptions(user1);
        assertEq(endDate, firstEndDate + SUBSCRIPTION_PERIOD, "End date should extend by 30 days");
        assertTrue(active, "Should still be active");

        vm.stopPrank();
    }

    function testAutoRenewalWithSufficientBalance() public {
        vm.startPrank(user1);

        // Subscribe to BASIC with auto-renew
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Warp to expiry
        vm.warp(block.timestamp + SUBSCRIPTION_PERIOD + 1);

        // Trigger renewal check (would be called by keeper/backend)
        subscription.processAutoRenewal{value: BASIC_PRICE}(user1);

        (, , bool active, ) = subscription.subscriptions(user1);
        assertTrue(active, "Should be auto-renewed");

        vm.stopPrank();
    }

    function testCancelSubscription() public {
        vm.startPrank(user1);

        // Subscribe to BASIC
        subscription.subscribe{value: BASIC_PRICE}(1);
        uint256 endDate = block.timestamp + SUBSCRIPTION_PERIOD;

        // Cancel subscription
        vm.expectEmit(true, false, false, true);
        emit Cancelled(user1, 1);

        subscription.cancelSubscription();

        (, uint256 subEndDate, bool active, bool autoRenew) = subscription.subscriptions(user1);
        assertEq(subEndDate, endDate, "End date should not change");
        assertTrue(active, "Should remain active until end date");
        assertFalse(autoRenew, "Auto-renew should be disabled");

        // Warp past end date
        vm.warp(endDate + 1);

        // Check status
        assertFalse(subscription.isActive(user1), "Should be inactive after end date");

        vm.stopPrank();
    }

    function testGracePeriod() public {
        vm.startPrank(user1);

        // Subscribe to BASIC
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Warp to expiry
        vm.warp(block.timestamp + SUBSCRIPTION_PERIOD + 1);

        // Should still have access during grace period
        assertTrue(subscription.hasAccess(user1), "Should have access during grace period");

        // Warp past grace period
        vm.warp(block.timestamp + GRACE_PERIOD + 1);

        // Should not have access anymore
        assertFalse(subscription.hasAccess(user1), "Should not have access after grace period");

        vm.stopPrank();
    }

    // ============================================
    // REVENUE DISTRIBUTION TESTS
    // ============================================

    function testRevenueDistribution() public {
        // User1 subscribes to BASIC
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Record plays: user1 listens to artist1 (10 plays) and artist2 (5 plays)
        vm.startPrank(address(subscription));
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist1);
        subscription.recordPlay(user1, artist2);
        subscription.recordPlay(user1, artist2);
        subscription.recordPlay(user1, artist2);
        subscription.recordPlay(user1, artist2);
        subscription.recordPlay(user1, artist2);
        vm.stopPrank();

        // Distribute revenue
        uint256 platformBalanceBefore = platform.balance;

        vm.prank(owner);
        subscription.distributeRevenue();

        // Check distribution
        // Total: 0.01 ETH
        // Artist share: 70% = 0.007 ETH
        // Platform share: 20% = 0.002 ETH
        // Patronage pool: 10% = 0.001 ETH

        // Artist1 should get 10/15 * 0.007 = 0.00466... ETH
        // Artist2 should get 5/15 * 0.007 = 0.00233... ETH

        uint256 artist1Balance = subscription.artistRevenue(artist1);
        uint256 artist2Balance = subscription.artistRevenue(artist2);
        uint256 platformBalance = platform.balance - platformBalanceBefore;

        assertEq(platformBalance, 0.002 ether, "Platform should get 20%");
        assertGt(artist1Balance, artist2Balance, "Artist1 should have more revenue");
        assertEq(artist1Balance + artist2Balance, 0.007 ether, "Artists should get 70% total");
    }

    function testRevenueDistributionMultipleUsers() public {
        // User1 subscribes to BASIC
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        // User2 subscribes to PREMIUM
        vm.prank(user2);
        subscription.subscribe{value: PREMIUM_PRICE}(2);

        // Record plays
        vm.startPrank(address(subscription));
        // User1: 10 plays to artist1
        for (uint i = 0; i < 10; i++) {
            subscription.recordPlay(user1, artist1);
        }
        // User2: 20 plays to artist2
        for (uint i = 0; i < 20; i++) {
            subscription.recordPlay(user2, artist2);
        }
        vm.stopPrank();

        // Distribute revenue
        vm.prank(owner);
        subscription.distributeRevenue();

        // Total revenue: 0.01 + 0.02 = 0.03 ETH
        // Artist share: 70% = 0.021 ETH
        // Platform share: 20% = 0.006 ETH
        // Patronage pool: 10% = 0.003 ETH

        uint256 totalArtistRevenue = subscription.artistRevenue(artist1) + subscription.artistRevenue(artist2);
        assertEq(totalArtistRevenue, 0.021 ether, "Total artist revenue should be 70%");
    }

    function testPatronagePoolDistribution() public {
        // User1 subscribes to ARTIST_SUPPORTER tier
        vm.prank(user1);
        subscription.subscribe{value: SUPPORTER_PRICE}(3);

        // Record plays to artist1
        vm.startPrank(address(subscription));
        for (uint i = 0; i < 10; i++) {
            subscription.recordPlay(user1, artist1);
        }
        vm.stopPrank();

        // Distribute revenue
        vm.prank(owner);
        subscription.distributeRevenue();

        // Artist should get base share (70%) + patronage bonus (10%)
        uint256 artist1Revenue = subscription.artistRevenue(artist1);

        // Expected: 70% of 0.05 + 100% of (10% of 0.05) = 0.035 + 0.005 = 0.04 ETH
        assertEq(artist1Revenue, 0.04 ether, "Artist should get base + patronage");
    }

    function testNoPlaysNoRevenue() public {
        // User subscribes but doesn't play any songs
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Distribute revenue
        vm.prank(owner);
        subscription.distributeRevenue();

        // Platform should get 20%, but artists get 0 (70% goes back to pool or platform)
        uint256 platformBalance = platform.balance;
        assertGt(platformBalance, 0.002 ether, "Platform should get at least 20%");
    }

    // ============================================
    // EDGE CASES & SECURITY TESTS
    // ============================================

    function testFractionalPayments() public {
        // Test with very small amounts to check precision
        vm.prank(owner);
        subscription.updateTierPrice(1, 1 wei); // 1 wei for BASIC

        vm.prank(user1);
        subscription.subscribe{value: 1 wei}(1);

        // Record plays
        vm.startPrank(address(subscription));
        subscription.recordPlay(user1, artist1);
        vm.stopPrank();

        // Distribute revenue
        vm.prank(owner);
        subscription.distributeRevenue();

        // Should not revert due to precision issues
        uint256 artist1Revenue = subscription.artistRevenue(artist1);
        assertGt(artist1Revenue, 0, "Artist should receive some revenue");
    }

    function testSubscriptionExpiry() public {
        vm.startPrank(user1);

        // Subscribe to BASIC
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Verify active
        assertTrue(subscription.isActive(user1), "Should be active");
        assertTrue(subscription.hasAccess(user1), "Should have access");

        // Warp past expiry + grace period
        vm.warp(block.timestamp + SUBSCRIPTION_PERIOD + GRACE_PERIOD + 1);

        // Verify expired
        assertFalse(subscription.isActive(user1), "Should be expired");
        assertFalse(subscription.hasAccess(user1), "Should not have access");

        vm.stopPrank();
    }

    function testConcurrentSubscriptions() public {
        // Multiple users subscribe at the same time
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        vm.prank(user2);
        subscription.subscribe{value: PREMIUM_PRICE}(2);

        // Both should have active subscriptions
        assertTrue(subscription.isActive(user1), "User1 should be active");
        assertTrue(subscription.isActive(user2), "User2 should be active");

        (uint8 tier1, , , ) = subscription.subscriptions(user1);
        (uint8 tier2, , , ) = subscription.subscriptions(user2);

        assertEq(tier1, 1, "User1 should have BASIC");
        assertEq(tier2, 2, "User2 should have PREMIUM");
    }

    function testReentrancyProtection() public {
        // Try to create a reentrancy attack
        ReentrancyAttacker attacker = new ReentrancyAttacker(subscription);
        vm.deal(address(attacker), 1 ether);

        vm.prank(address(attacker));
        vm.expectRevert(); // Should revert due to reentrancy guard
        attacker.attack{value: BASIC_PRICE}();
    }

    function testUnauthorizedWithdrawal() public {
        // User1 subscribes
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        // User2 tries to withdraw artist revenue without being artist
        vm.prank(user2);
        vm.expectRevert("No revenue available");
        subscription.withdrawArtistRevenue();
    }

    function testIntegerOverflow() public {
        // Try to cause overflow with very large play counts
        vm.startPrank(address(subscription));

        // Record max uint256 plays (should not overflow)
        for (uint i = 0; i < 1000; i++) {
            subscription.recordPlay(user1, artist1);
        }

        vm.stopPrank();

        // Should not revert
        vm.prank(owner);
        subscription.distributeRevenue();
    }

    function testPauseSubscriptions() public {
        // Owner pauses subscriptions
        vm.prank(owner);
        subscription.pause();

        // New subscriptions should fail
        vm.prank(user1);
        vm.expectRevert("Pausable: paused");
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Unpause
        vm.prank(owner);
        subscription.unpause();

        // Should work now
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        assertTrue(subscription.isActive(user1), "Should be active after unpause");
    }

    function testChangeDistributionRatios() public {
        // Owner changes distribution ratios
        vm.prank(owner);
        subscription.updateDistributionRatios(60, 30, 10); // 60% artists, 30% platform, 10% patronage

        // User subscribes
        vm.prank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        // Record plays
        vm.startPrank(address(subscription));
        subscription.recordPlay(user1, artist1);
        vm.stopPrank();

        // Distribute
        uint256 platformBalanceBefore = platform.balance;

        vm.prank(owner);
        subscription.distributeRevenue();

        uint256 platformShare = platform.balance - platformBalanceBefore;
        assertEq(platformShare, 0.003 ether, "Platform should get 30%");
    }

    function testOnlyOwnerCanUpdateTierPrices() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        subscription.updateTierPrice(1, 0.02 ether);

        // Owner can update
        vm.prank(owner);
        subscription.updateTierPrice(1, 0.02 ether);

        assertEq(subscription.tierPrices(1), 0.02 ether, "Tier price should be updated");
    }

    // ============================================
    // GAS OPTIMIZATION TESTS
    // ============================================

    function testSubscribeGas() public {
        vm.prank(user1);
        uint256 gasBefore = gasleft();
        subscription.subscribe{value: BASIC_PRICE}(1);
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 100000, "Subscribe should cost less than 100k gas");
    }

    function testRenewalGas() public {
        vm.startPrank(user1);
        subscription.subscribe{value: BASIC_PRICE}(1);

        vm.warp(block.timestamp + SUBSCRIPTION_PERIOD - 1 days);

        uint256 gasBefore = gasleft();
        subscription.renewSubscription{value: BASIC_PRICE}();
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 80000, "Renewal should cost less than 80k gas");
        vm.stopPrank();
    }

    function testBatchDistributionGas() public {
        // Subscribe 10 users
        address[] memory users = new address[](10);
        for (uint i = 0; i < 10; i++) {
            users[i] = address(uint160(100 + i));
            vm.deal(users[i], 1 ether);
            vm.prank(users[i]);
            subscription.subscribe{value: BASIC_PRICE}(1);
        }

        // Record plays
        vm.startPrank(address(subscription));
        for (uint i = 0; i < 10; i++) {
            subscription.recordPlay(users[i], artist1);
        }
        vm.stopPrank();

        // Distribute
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        subscription.distributeRevenue();
        uint256 gasUsed = gasBefore - gasleft();

        // Should scale linearly, not exponentially
        assertLt(gasUsed, 500000, "Batch distribution should be gas-optimized");
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function testGetSubscriptionInfo() public {
        vm.prank(user1);
        subscription.subscribe{value: PREMIUM_PRICE}(2);

        (uint8 tier, uint256 endDate, bool active, bool autoRenew) = subscription.getSubscriptionInfo(user1);

        assertEq(tier, 2, "Should return correct tier");
        assertEq(endDate, block.timestamp + SUBSCRIPTION_PERIOD, "Should return correct end date");
        assertTrue(active, "Should return active status");
        assertTrue(autoRenew, "Should return auto-renew status");
    }

    function testGetTierFeatures() public {
        // Test tier access levels
        vm.prank(user1);
        subscription.subscribe{value: FREE_PRICE}(0); // FREE

        assertFalse(subscription.canAccessPremiumContent(user1), "FREE tier should not access premium");
        assertFalse(subscription.canDownload(user1), "FREE tier should not download");

        // Upgrade to PREMIUM
        vm.prank(user1);
        subscription.upgradeTier{value: PREMIUM_PRICE}(2);

        assertTrue(subscription.canAccessPremiumContent(user1), "PREMIUM tier should access premium");
        assertTrue(subscription.canDownload(user1), "PREMIUM tier should download");
    }
}

// Reentrancy attacker contract for testing
contract ReentrancyAttacker {
    PlatformSubscriptionStrategy public subscription;

    constructor(PlatformSubscriptionStrategy _subscription) {
        subscription = _subscription;
    }

    function attack() external payable {
        subscription.subscribe{value: msg.value}(1);
    }

    receive() external payable {
        // Try to reenter
        if (address(subscription).balance > 0) {
            subscription.subscribe{value: 0.01 ether}(1);
        }
    }
}
