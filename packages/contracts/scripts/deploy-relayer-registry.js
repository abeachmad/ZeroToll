const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy RelayerRegistry Contract
 * 
 * This script deploys the RelayerRegistry contract which manages
 * the decentralized relayer network for ZeroToll gasless swaps.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-relayer-registry.js --network amoy
 *   npx hardhat run scripts/deploy-relayer-registry.js --network sepolia
 */

// Executor addresses (will be updated after deployment)
const EXECUTORS = {
  80002: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Amoy - deployer for now
  11155111: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" // Sepolia - deployer for now
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("\n=== Deploying RelayerRegistry ===");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), chainId === 80002 ? "POL" : "ETH");

  // Get executor address for this network
  const executor = EXECUTORS[chainId];
  if (!executor) {
    throw new Error(`No executor configured for chain ID ${chainId}`);
  }

  console.log("\nConfiguration:");
  console.log("Executor:", executor);
  console.log("Min Stake:", "10 ETH/POL");
  console.log("Max Relayers:", "100");
  console.log("Slash Percentage:", "10%");

  // Deploy RelayerRegistry
  console.log("\nDeploying RelayerRegistry...");
  const RelayerRegistry = await hre.ethers.getContractFactory("RelayerRegistry");
  const registry = await RelayerRegistry.deploy(executor);
  await registry.waitForDeployment();
  
  const registryAddress = await registry.getAddress();
  console.log("✅ RelayerRegistry deployed to:", registryAddress);

  // Get contract info
  const minStake = await registry.MIN_STAKE();
  const maxRelayers = await registry.MAX_RELAYERS();
  const slashPercentage = await registry.SLASH_PERCENTAGE();
  
  console.log("\nContract Configuration:");
  console.log("Min Stake:", hre.ethers.formatEther(minStake), chainId === 80002 ? "POL" : "ETH");
  console.log("Max Relayers:", maxRelayers.toString());
  console.log("Slash Percentage:", slashPercentage.toString() + "%");
  console.log("Owner:", await registry.owner());
  console.log("Executor:", await registry.executor());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RelayerRegistry: {
        address: registryAddress,
        executor: executor,
        minStake: hre.ethers.formatEther(minStake),
        maxRelayers: maxRelayers.toString(),
        slashPercentage: slashPercentage.toString()
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `relayer-registry-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to:", filename);

  // Verify contract on block explorer
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await registry.deploymentTransaction().wait(5);
    
    console.log("Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: registryAddress,
        constructorArguments: [executor],
      });
      console.log("✅ Contract verified");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }

  // Print summary
  console.log("\n=== Deployment Summary ===");
  console.log("RelayerRegistry:", registryAddress);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", chainId);
  console.log("\n=== Next Steps ===");
  console.log("1. Update backend relayer with registry address");
  console.log("2. Register first relayer:");
  console.log(`   await registry.registerRelayer({ value: ethers.parseEther("10") })`);
  console.log("3. Update executor address if needed:");
  console.log(`   await registry.setExecutor("0xNEW_EXECUTOR_ADDRESS")`);
  console.log("4. Monitor relayer registrations:");
  console.log(`   await registry.getActiveRelayers()`);
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
