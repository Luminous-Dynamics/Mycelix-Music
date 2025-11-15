// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/FlowToken.sol";
import "../src/EconomicStrategyRouter.sol";
import "../src/strategies/PayPerStreamStrategy.sol";
import "../src/strategies/GiftEconomyStrategy.sol";
import "../src/CGCRegistry.sol";

/**
 * @title DeployMainnet
 * @notice Foundry deployment script for Gnosis Chain mainnet
 * @dev Run with: forge script script/DeployMainnet.s.sol --rpc-url $GNOSIS_RPC_URL --broadcast --verify
 */
contract DeployMainnet is Script {
    // Deployment configuration
    address public constant PROTOCOL_TREASURY = 0x742d35Cc6634C0532925a3b844Bc454e4438f44e; // UPDATE THIS
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%

    // Strategy IDs
    bytes32 public constant PAY_PER_STREAM_ID = keccak256("pay-per-stream-v1");
    bytes32 public constant GIFT_ECONOMY_ID = keccak256("gift-economy-v1");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("==========================================================");
        console.log("Mycelix Music - Mainnet Deployment");
        console.log("==========================================================");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Protocol Treasury:", PROTOCOL_TREASURY);
        console.log("==========================================================");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============================================================================
        // Step 1: Deploy FlowToken
        // ============================================================================

        console.log("Step 1: Deploying FlowToken...");
        FlowToken flowToken = new FlowToken();
        console.log("FlowToken deployed at:", address(flowToken));
        console.log("");

        // ============================================================================
        // Step 2: Deploy CGCRegistry
        // ============================================================================

        console.log("Step 2: Deploying CGCRegistry...");
        CGCRegistry cgcRegistry = new CGCRegistry();
        console.log("CGCRegistry deployed at:", address(cgcRegistry));
        console.log("");

        // ============================================================================
        // Step 3: Deploy EconomicStrategyRouter
        // ============================================================================

        console.log("Step 3: Deploying EconomicStrategyRouter...");
        EconomicStrategyRouter router = new EconomicStrategyRouter(
            address(flowToken),
            PROTOCOL_TREASURY
        );
        console.log("Router deployed at:", address(router));
        console.log("");

        // ============================================================================
        // Step 4: Deploy PayPerStreamStrategy
        // ============================================================================

        console.log("Step 4: Deploying PayPerStreamStrategy...");
        PayPerStreamStrategy payPerStream = new PayPerStreamStrategy(
            address(flowToken),
            address(router)
        );
        console.log("PayPerStreamStrategy deployed at:", address(payPerStream));
        console.log("");

        // ============================================================================
        // Step 5: Deploy GiftEconomyStrategy
        // ============================================================================

        console.log("Step 5: Deploying GiftEconomyStrategy...");
        GiftEconomyStrategy giftEconomy = new GiftEconomyStrategy(
            address(flowToken),
            address(router),
            address(cgcRegistry)
        );
        console.log("GiftEconomyStrategy deployed at:", address(giftEconomy));
        console.log("");

        // ============================================================================
        // Step 6: Register Strategies
        // ============================================================================

        console.log("Step 6: Registering strategies...");
        router.registerStrategy(PAY_PER_STREAM_ID, address(payPerStream));
        console.log("Registered PayPerStreamStrategy");

        router.registerStrategy(GIFT_ECONOMY_ID, address(giftEconomy));
        console.log("Registered GiftEconomyStrategy");
        console.log("");

        // ============================================================================
        // Step 7: Set Protocol Fee
        // ============================================================================

        console.log("Step 7: Setting protocol fee...");
        router.updateProtocolFee(PROTOCOL_FEE_BPS);
        console.log("Protocol fee set to:", PROTOCOL_FEE_BPS, "bps (1%)");
        console.log("");

        vm.stopBroadcast();

        // ============================================================================
        // Deployment Summary
        // ============================================================================

        console.log("==========================================================");
        console.log("Deployment Complete!");
        console.log("==========================================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("-------------------");
        console.log("FlowToken:              ", address(flowToken));
        console.log("CGCRegistry:            ", address(cgcRegistry));
        console.log("Router:                 ", address(router));
        console.log("PayPerStreamStrategy:   ", address(payPerStream));
        console.log("GiftEconomyStrategy:    ", address(giftEconomy));
        console.log("");
        console.log("Environment Variables:");
        console.log("---------------------");
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=", address(router));
        console.log("NEXT_PUBLIC_FLOW_TOKEN_ADDRESS=", address(flowToken));
        console.log("NEXT_PUBLIC_CGC_REGISTRY_ADDRESS=", address(cgcRegistry));
        console.log("NEXT_PUBLIC_CHAIN_ID=100");
        console.log("");
        console.log("Next Steps:");
        console.log("-----------");
        console.log("1. Verify contracts on block explorer");
        console.log("2. Update .env with addresses above");
        console.log("3. Transfer ownership to multi-sig (if applicable)");
        console.log("4. Run post-deployment verification");
        console.log("5. Deploy backend API");
        console.log("6. Deploy frontend");
        console.log("");
        console.log("==========================================================");

        // Save deployment to file
        string memory deploymentJson = string(abi.encodePacked(
            '{',
            '"network":"gnosis-mainnet",',
            '"chainId":100,',
            '"timestamp":"', vm.toString(block.timestamp), '",',
            '"deployer":"', vm.toString(deployer), '",',
            '"contracts":{',
            '"FlowToken":"', vm.toString(address(flowToken)), '",',
            '"CGCRegistry":"', vm.toString(address(cgcRegistry)), '",',
            '"Router":"', vm.toString(address(router)), '",',
            '"PayPerStreamStrategy":"', vm.toString(address(payPerStream)), '",',
            '"GiftEconomyStrategy":"', vm.toString(address(giftEconomy)), '"',
            '}',
            '}'
        ));

        vm.writeFile("deployments/mainnet-latest.json", deploymentJson);
        console.log("Deployment info saved to: deployments/mainnet-latest.json");
    }
}
