const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const SEPOLIA_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";
  const SEPOLIA_WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
  
  const weth = await hre.ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", SEPOLIA_WETH);
  
  console.log("=== FUNDING SEPOLIA ADAPTER WITH WETH ===\n");
  console.log(`Adapter: ${SEPOLIA_ADAPTER}`);
  console.log(`Deployer: ${deployer.address}\n`);
  
  // Check deployer ETH balance
  const ethBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH: ${hre.ethers.formatEther(ethBalance)} ETH`);
  
  // Deposit 0.05 ETH to WETH
  console.log("\n1. Wrapping 0.05 ETH → WETH...");
  const depositTx = await weth.deposit({ value: hre.ethers.parseEther("0.05") });
  await depositTx.wait();
  console.log(`✅ Wrapped! TX: ${depositTx.hash}`);
  
  // Check WETH balance
  const wethBalance = await weth.balanceOf(deployer.address);
  console.log(`\nDeployer WETH: ${hre.ethers.formatEther(wethBalance)} WETH`);
  
  // Transfer 0.04 WETH to adapter (keep 0.01 for deployer)
  console.log("\n2. Transferring 0.04 WETH to adapter...");
  const transferTx = await weth.transfer(SEPOLIA_ADAPTER, hre.ethers.parseEther("0.04"));
  await transferTx.wait();
  console.log(`✅ Transferred! TX: ${transferTx.hash}`);
  
  // Verify adapter balance
  const adapterWeth = await weth.balanceOf(SEPOLIA_ADAPTER);
  console.log(`\nAdapter WETH: ${hre.ethers.formatEther(adapterWeth)} WETH`);
  console.log("\n✅ Sepolia adapter now has WETH for swaps!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
