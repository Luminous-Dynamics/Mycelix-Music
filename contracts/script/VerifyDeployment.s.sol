// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/FlowToken.sol";
import "../src/EconomicStrategyRouter.sol";
import "../src/strategies/PayPerStreamStrategy.sol";
import "../src/strategies/GiftEconomyStrategy.sol";
import "../src/CGCRegistry.sol";

/**
 * @title VerifyDeployment
 * @notice Post-deployment verification script
 * @dev Run with: forge script script/VerifyDeployment.s.sol --rpc-url $RPC_URL
 */
contract VerifyDeployment is Script {
    function run() external view {
        // Load deployment addresses from environment
        address routerAddress = vm.envAddress("ROUTER_ADDRESS");
        address flowTokenAddress = vm.envAddress("FLOW_TOKEN_ADDRESS");

        console.log("==========================================================");
        console.log("Post-Deployment Verification");
        console.log("==========================================================");
        console.log("");

        // ============================================================================
        // Verify FlowToken
        // ============================================================================

        console.log("1. Verifying FlowToken...");
        FlowToken flowToken = FlowToken(flowTokenAddress);

        try flowToken.name() returns (string memory name) {
            console.log("   Name:", name);
            require(keccak256(bytes(name)) == keccak256(bytes("Flow Token")), "Invalid name");
        } catch {
            revert("FlowToken.name() failed");
        }

        try flowToken.symbol() returns (string memory symbol) {
            console.log("   Symbol:", symbol);
            require(keccak256(bytes(symbol)) == keccak256(bytes("FLOW")), "Invalid symbol");
        } catch {
            revert("FlowToken.symbol() failed");
        }

        console.log("   ✅ FlowToken verified");
        console.log("");

        // ============================================================================
        // Verify Router
        // ============================================================================

        console.log("2. Verifying EconomicStrategyRouter...");
        EconomicStrategyRouter router = EconomicStrategyRouter(routerAddress);

        try router.flowToken() returns (address token) {
            console.log("   Flow Token:", token);
            require(token == flowTokenAddress, "Flow token mismatch");
        } catch {
            revert("Router.flowToken() failed");
        }

        try router.protocolFeeBps() returns (uint256 fee) {
            console.log("   Protocol Fee:", fee, "bps");
            require(fee <= 500, "Protocol fee too high");
        } catch {
            revert("Router.protocolFeeBps() failed");
        }

        try router.protocolTreasury() returns (address treasury) {
            console.log("   Treasury:", treasury);
            require(treasury != address(0), "Invalid treasury");
        } catch {
            revert("Router.protocolTreasury() failed");
        }

        console.log("   ✅ Router verified");
        console.log("");

        // ============================================================================
        // Verify Strategies
        // ============================================================================

        console.log("3. Verifying Strategies...");
        bytes32 ppsId = keccak256("pay-per-stream-v1");
        bytes32 geId = keccak256("gift-economy-v1");

        try router.registeredStrategies(ppsId) returns (address ppsAddress) {
            console.log("   PayPerStream:", ppsAddress);
            require(ppsAddress != address(0), "PPS not registered");

            // Verify PPS contract
            PayPerStreamStrategy pps = PayPerStreamStrategy(ppsAddress);
            require(address(pps.router()) == routerAddress, "PPS router mismatch");
            console.log("   ✅ PayPerStreamStrategy verified");
        } catch {
            revert("PayPerStreamStrategy verification failed");
        }

        try router.registeredStrategies(geId) returns (address geAddress) {
            console.log("   GiftEconomy:", geAddress);
            require(geAddress != address(0), "GE not registered");

            // Verify GE contract
            GiftEconomyStrategy ge = GiftEconomyStrategy(geAddress);
            require(address(ge.router()) == routerAddress, "GE router mismatch");
            console.log("   ✅ GiftEconomyStrategy verified");
        } catch {
            revert("GiftEconomyStrategy verification failed");
        }

        console.log("");

        // ============================================================================
        // Summary
        // ============================================================================

        console.log("==========================================================");
        console.log("✅ All Verifications Passed!");
        console.log("==========================================================");
        console.log("");
        console.log("Deployment is valid and ready for use.");
        console.log("");
    }
}
