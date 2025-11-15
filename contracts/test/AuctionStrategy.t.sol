// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../strategies/AuctionStrategy.sol";
import "../mocks/MockERC20.sol";
import "../mocks/MockRouter.sol";

contract AuctionStrategyTest is Test {
    AuctionStrategy public strategy;
    MockERC20 public flowToken;
    MockRouter public router;

    address public artist = address(0x1);
    address public buyer1 = address(0x2);
    address public buyer2 = address(0x3);
    address public buyer3 = address(0x4);

    string public songId = "song-auction-1";

    function setUp() public {
        flowToken = new MockERC20("FLOW", "FLOW");
        router = new MockRouter();

        strategy = new AuctionStrategy(address(flowToken), address(router));

        // Mint tokens to buyers
        flowToken.mint(buyer1, 1000 ether);
        flowToken.mint(buyer2, 1000 ether);
        flowToken.mint(buyer3, 1000 ether);

        // Approve strategy
        vm.prank(buyer1);
        flowToken.approve(address(strategy), type(uint256).max);

        vm.prank(buyer2);
        flowToken.approve(address(strategy), type(uint256).max);

        vm.prank(buyer3);
        flowToken.approve(address(strategy), type(uint256).max);
    }

    /**
     * Test Dutch auction creation
     */
    function testCreateDutchAuction() public {
        vm.prank(artist);
        strategy.createDutchAuction(
            songId,
            artist,
            100 ether,  // Start price
            10 ether,   // End price (reserve)
            7 days,     // Duration
            100,        // Total supply
            0           // Price decrement (not used for linear)
        );

        (
            address auctionArtist,
            uint256 startPrice,
            uint256 endPrice,
            uint256 startTime,
            uint256 endTime,
            uint256 totalSupply,
            uint256 sold,
            ,
            bool active,
        ) = strategy.auctions(songId);

        assertEq(auctionArtist, artist);
        assertEq(startPrice, 100 ether);
        assertEq(endPrice, 10 ether);
        assertEq(startTime, block.timestamp);
        assertEq(endTime, block.timestamp + 7 days);
        assertEq(totalSupply, 100);
        assertEq(sold, 0);
        assertTrue(active);
    }

    /**
     * Test current price calculation at auction start
     */
    function testGetCurrentPriceAtStart() public {
        _createBasicDutchAuction();

        uint256 currentPrice = strategy.getCurrentPrice(songId);
        assertEq(currentPrice, 100 ether);  // Should be start price
    }

    /**
     * Test current price calculation midway
     */
    function testGetCurrentPriceMidway() public {
        _createBasicDutchAuction();

        // Fast forward 3.5 days (half of 7 days)
        vm.warp(block.timestamp + 3.5 days);

        uint256 currentPrice = strategy.getCurrentPrice(songId);

        // Price should be halfway between start (100) and end (10)
        // 100 - (90 * 0.5) = 55
        assertEq(currentPrice, 55 ether);
    }

    /**
     * Test current price at auction end
     */
    function testGetCurrentPriceAtEnd() public {
        _createBasicDutchAuction();

        // Fast forward past auction end
        vm.warp(block.timestamp + 8 days);

        uint256 currentPrice = strategy.getCurrentPrice(songId);
        assertEq(currentPrice, 10 ether);  // Should be end/reserve price
    }

    /**
     * Test purchase access
     */
    function testPurchaseAccess() public {
        _createBasicDutchAuction();

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);

        vm.prank(buyer1);
        uint256 pricePaid = strategy.purchaseAccess(songId, 100 ether);

        // Should pay start price
        assertEq(pricePaid, 100 ether);

        // Check payment transferred
        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + 100 ether);

        // Check access granted
        assertTrue(strategy.hasAccess(songId, buyer1));

        // Check auction stats updated
        (, , , , , , uint256 sold, , , ) = strategy.auctions(songId);
        assertEq(sold, 1);
    }

    /**
     * Test purchase at declining price
     */
    function testPurchaseAtDecliningPrice() public {
        _createBasicDutchAuction();

        // Fast forward to half price
        vm.warp(block.timestamp + 3.5 days);

        uint256 artistBalanceBefore = flowToken.balanceOf(artist);

        vm.prank(buyer1);
        uint256 pricePaid = strategy.purchaseAccess(songId, 60 ether);

        // Should pay current price (~55 ether)
        assertApproxEqAbs(pricePaid, 55 ether, 0.1 ether);

        assertEq(flowToken.balanceOf(artist), artistBalanceBefore + pricePaid);
    }

    /**
     * Test cannot purchase if price too high
     */
    function testCannotPurchaseIfPriceTooHigh() public {
        _createBasicDutchAuction();

        vm.prank(buyer1);
        vm.expectRevert("Price too high");
        strategy.purchaseAccess(songId, 50 ether);  // Max price too low
    }

    /**
     * Test cannot purchase twice
     */
    function testCannotPurchaseTwice() public {
        _createBasicDutchAuction();

        vm.prank(buyer1);
        strategy.purchaseAccess(songId, 100 ether);

        vm.prank(buyer1);
        vm.expectRevert("Already purchased");
        strategy.purchaseAccess(songId, 100 ether);
    }

    /**
     * Test auction sells out
     */
    function testAuctionSellsOut() public {
        // Create auction with only 2 supply
        vm.prank(artist);
        strategy.createDutchAuction(
            songId,
            artist,
            100 ether,
            10 ether,
            7 days,
            2,  // Only 2 available
            0
        );

        // First purchase
        vm.prank(buyer1);
        strategy.purchaseAccess(songId, 100 ether);

        // Auction still active
        (, , , , , , , , bool active, ) = strategy.auctions(songId);
        assertTrue(active);

        // Second purchase should end auction
        vm.prank(buyer2);
        strategy.purchaseAccess(songId, 100 ether);

        // Auction should be ended
        (, , , , , , , , active, ) = strategy.auctions(songId);
        assertFalse(active);

        // Third purchase should fail
        vm.prank(buyer3);
        vm.expectRevert("Auction not active");
        strategy.purchaseAccess(songId, 100 ether);
    }

    /**
     * Test manual auction end
     */
    function testEndAuctionManually() public {
        _createBasicDutchAuction();

        vm.prank(artist);
        strategy.endAuction(songId);

        (, , , , , , , , bool active, ) = strategy.auctions(songId);
        assertFalse(active);
    }

    /**
     * Test only artist can end auction
     */
    function testOnlyArtistCanEndAuction() public {
        _createBasicDutchAuction();

        vm.prank(buyer1);
        vm.expectRevert("Not artist");
        strategy.endAuction(songId);
    }

    /**
     * Test get auction stats
     */
    function testGetAuctionStats() public {
        _createBasicDutchAuction();

        // Make a purchase
        vm.prank(buyer1);
        strategy.purchaseAccess(songId, 100 ether);

        (
            uint256 currentPrice,
            uint256 sold,
            uint256 remaining,
            uint256 totalRevenue,
            uint256 avgPrice,
            bool active
        ) = strategy.getAuctionStats(songId);

        assertEq(currentPrice, 100 ether);
        assertEq(sold, 1);
        assertEq(remaining, 99);
        assertEq(totalRevenue, 100 ether);
        assertEq(avgPrice, 100 ether);
        assertTrue(active);
    }

    /**
     * Test purchase history
     */
    function testGetPurchaseHistory() public {
        _createBasicDutchAuction();

        // Make multiple purchases
        vm.prank(buyer1);
        strategy.purchaseAccess(songId, 100 ether);

        vm.warp(block.timestamp + 1 days);

        vm.prank(buyer2);
        strategy.purchaseAccess(songId, 100 ether);

        // Get purchase history
        AuctionStrategy.Purchase[] memory history = strategy.getPurchaseHistory(songId, 0, 10);

        assertEq(history.length, 2);
        assertEq(history[0].buyer, buyer1);
        assertEq(history[1].buyer, buyer2);
        assertEq(history[0].pricePaid, 100 ether);
    }

    /**
     * Test average price calculation
     */
    function testAveragePriceCalculation() public {
        _createBasicDutchAuction();

        // Purchase at start (100 ether)
        vm.prank(buyer1);
        strategy.purchaseAccess(songId, 100 ether);

        // Purchase at midpoint (~55 ether)
        vm.warp(block.timestamp + 3.5 days);
        vm.prank(buyer2);
        strategy.purchaseAccess(songId, 60 ether);

        (
            ,
            uint256 sold,
            ,
            ,
            uint256 avgPrice,
        ) = strategy.getAuctionStats(songId);

        assertEq(sold, 2);
        // Average of 100 and ~55 should be ~77.5
        assertApproxEqAbs(avgPrice, 77.5 ether, 1 ether);
    }

    /**
     * Test process payment requires access
     */
    function testProcessPaymentRequiresAccess() public {
        _createBasicDutchAuction();

        // Without purchase should fail
        vm.prank(address(router));
        vm.expectRevert("No access");
        strategy.processPayment(
            songId,
            buyer1,
            0,
            IEconomicStrategy.PaymentType.STREAM
        );

        // With purchase should succeed
        vm.prank(buyer1);
        strategy.purchaseAccess(songId, 100 ether);

        vm.prank(address(router));
        IEconomicStrategy.Split[] memory splits = strategy.processPayment(
            songId,
            buyer1,
            0,
            IEconomicStrategy.PaymentType.STREAM
        );

        // Should return empty splits (access already purchased)
        assertEq(splits.length, 0);
    }

    /**
     * Test calculate splits
     */
    function testCalculateSplits() public {
        _createBasicDutchAuction();

        IEconomicStrategy.Split[] memory splits = strategy.calculateSplits(songId, 0);

        assertEq(splits.length, 1);
        assertEq(splits[0].recipient, artist);
        assertEq(splits[0].amount, 100 ether);  // Current price at start
        assertEq(splits[0].basisPoints, 10000);
    }

    /**
     * Test multiple purchases track correctly
     */
    function testMultiplePurchasesTracking() public {
        _createBasicDutchAuction();

        uint256 totalRevenue = 0;

        // Purchase 1
        vm.prank(buyer1);
        uint256 price1 = strategy.purchaseAccess(songId, 100 ether);
        totalRevenue += price1;

        // Purchase 2 (price has dropped)
        vm.warp(block.timestamp + 2 days);
        vm.prank(buyer2);
        uint256 price2 = strategy.purchaseAccess(songId, 100 ether);
        totalRevenue += price2;

        // Purchase 3 (price dropped more)
        vm.warp(block.timestamp + 2 days);
        vm.prank(buyer3);
        uint256 price3 = strategy.purchaseAccess(songId, 100 ether);
        totalRevenue += price3;

        // Check all have access
        assertTrue(strategy.hasAccess(songId, buyer1));
        assertTrue(strategy.hasAccess(songId, buyer2));
        assertTrue(strategy.hasAccess(songId, buyer3));

        // Check sold count
        (, , , , , , uint256 sold, , , ) = strategy.auctions(songId);
        assertEq(sold, 3);

        // Check artist received all payments
        assertEq(strategy.artistRevenue(artist), totalRevenue);
    }

    /**
     * Test auction cannot be purchased after time ends
     */
    function testCannotPurchaseAfterTimeEnds() public {
        _createBasicDutchAuction();

        // Fast forward past auction end
        vm.warp(block.timestamp + 8 days);

        vm.prank(buyer1);
        vm.expectRevert("Auction ended");
        strategy.purchaseAccess(songId, 10 ether);
    }

    // Helper function
    function _createBasicDutchAuction() internal {
        vm.prank(artist);
        strategy.createDutchAuction(
            songId,
            artist,
            100 ether,  // Start price
            10 ether,   // End price
            7 days,     // Duration
            100,        // Total supply
            0           // Price decrement
        );
    }
}
