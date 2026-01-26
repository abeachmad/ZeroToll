// Deploy ZeroTollDelegate for EIP-7702 gasless swaps
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Contract addresses by network
const ADDRESSES = {
  // Polygon Amoy
  80002: {
    router: "0xD83D377E4698317731b2953854c01d39C60815d7", // RouterV3 with fee support
    treasury: "0xD6a7294445F34d0F7244b2072696106904ea807B", // Treasury
    weth: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9" // WPOL on Amoy
  },
  // Ethereum Sepolia
  11155111: {
    router: "0xB54e95a30E4Aa355380798313E0791833C7F0BFF", // RouterV3 with fee support
    treasury: "0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10", // Treasury
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" // WETH on Sepolia
  }
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = await deployer.getChainId();
  
  console.log("\n=== Deploying ZeroTollDelegate ===");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  // Get addresses for this network
  const addresses = ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`No addresses configured for chain ID ${chainId}`);
  }
  
  console.log("\nConfiguration:");
  console.log("Router:", addresses.router);
  console.log("Treasury:", addresses.treasury);
  console.log("WETH/WPOL:", addresses.weth);
  
  // Deploy ZeroTollDelegate
  console.log("\nDeploying ZeroTollDelegate...");
  const ZeroTollDelegate = await hre.ethers.getContractFactory("ZeroTollDelegate");
  const delegate = await ZeroTollDelegate.deploy(
    addresses.router,
    addresses.treasury,
    addresses.weth
  );
  
  await delegate.deployed();
  console.log("✅ ZeroTollDelegate deployed to:", delegate.address);
  
  // Verify domain separator
  const domainSeparator = await delegate.DOMAIN_SEPARATOR();
  console.log("Domain Separator:", domainSeparator);
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: chainId,
    timestamp: Date.now(),
    deployer: deployer.address,
    contracts: {
      ZeroTollDelegate: {
        address: delegate.address,
        router: addresses.router,
        treasury: addresses.treasury,
        weth: addresses.weth,
        domainSeparator: domainSeparator
      }
    },
    transactionHash: delegate.deployTransaction.hash,
    blockNumber: delegate.deployTransaction.blockNumber
  };
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `zerotoll-delegate-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to:", filename);
  
  // Wait for confirmations before verification
  console.log("\nWaiting for 5 confirmations...");
  await delegate.deployTransaction.wait(5);
  
  // Verify on Etherscan/Polygonscan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nVerifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: delegate.address,
        constructorArguments: [
          addresses.router,
          addresses.treasury,
          addresses.weth
        ]
      });
      console.log("✅ Contract verified");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }
  
  console.log("\n=== Deployment Complete ===");
  console.log("ZeroTollDelegate:", delegate.address);
  console.log("\nNext steps:");
  console.log("1. Update frontend config with delegate address");
  console.log("2. Update relayer with EIP-7702 support");
  console.log("3. Test gasless swaps on testnet");
  console.log("4. Compare gas costs with ERC-4337");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
