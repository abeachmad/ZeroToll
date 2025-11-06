const hre = require("hardhat");

async function main() {
  console.log("💰 Funding MockDEXAdapter with tokens...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding from account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const MOCK_ADAPTER_ADDRESS = "0x5a1f5079cb2818dd0A4f6CDBECA2a15A299ec892";
  
  const tokens = {
    USDC: {
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      amount: hre.ethers.parseUnits("5", 6), // 5 USDC (6 decimals) - reduced for testing
      decimals: 6
    },
    LINK: {
      address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      amount: hre.ethers.parseUnits("10", 18), // 10 LINK (18 decimals)
      decimals: 18
    }
  };

  // MockDEXAdapter ABI for fundAdapter
  const mockAdapterAbi = [
    "function fundAdapter(address token, uint256 amount) external"
  ];
  
  const mockAdapter = await hre.ethers.getContractAt(mockAdapterAbi, MOCK_ADAPTER_ADDRESS);

  // ERC20 ABI for approval
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
  ];

  for (const [symbol, tokenInfo] of Object.entries(tokens)) {
    console.log(`\n📦 Funding ${symbol}...`);
    
    try {
      const token = await hre.ethers.getContractAt(erc20Abi, tokenInfo.address);
      
      // Check deployer balance
      const balance = await token.balanceOf(deployer.address);
      console.log(`  Deployer ${symbol} balance: ${hre.ethers.formatUnits(balance, tokenInfo.decimals)}`);
      
      if (balance < tokenInfo.amount) {
        console.log(`  ⚠️ Insufficient balance to fund ${symbol}`);
        continue;
      }
      
      // Approve MockDEXAdapter to pull tokens
      console.log(`  Approving ${symbol}...`);
      const approveTx = await token.approve(MOCK_ADAPTER_ADDRESS, tokenInfo.amount);
      await approveTx.wait();
      console.log(`  ✅ Approved`);
      
      // Fund adapter
      console.log(`  Transferring ${hre.ethers.formatUnits(tokenInfo.amount, tokenInfo.decimals)} ${symbol} to adapter...`);
      const fundTx = await mockAdapter.fundAdapter(tokenInfo.address, tokenInfo.amount);
      await fundTx.wait();
      console.log(`  ✅ ${symbol} funded!`);
      
    } catch (error) {
      console.error(`  ❌ Error funding ${symbol}:`, error.message);
    }
  }

  console.log("\n✅ Funding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
