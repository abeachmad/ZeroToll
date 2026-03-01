const hre = require("hardhat");

async function main() {
  console.log("🏦 Funding Sepolia Adapter...\n");

  const USER_KEY = "5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04";
  const signer = new hre.ethers.Wallet(USER_KEY, hre.ethers.provider);
  
  console.log(`User: ${signer.address}`);
  
  const ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  const USDC_ADDR = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const WETH_ADDR = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  
  const USDC = await hre.ethers.getContractAt("IERC20", USDC_ADDR, signer);
  const WETH = await hre.ethers.getContractAt("IERC20", WETH_ADDR, signer);
  
  const userUSDC = await USDC.balanceOf(signer.address);
  const userETH = await hre.ethers.provider.getBalance(signer.address);
  
  console.log(`\n💰 User Balance:`);
  console.log(`   USDC: ${hre.ethers.formatUnits(userUSDC, 6)}`);
  console.log(`   ETH: ${hre.ethers.formatEther(userETH)}`);
  
  // Transfer 3 USDC
  console.log(`\n📤 Transferring 3 USDC to adapter...`);
  const tx1 = await USDC.transfer(ADAPTER, hre.ethers.parseUnits("3", 6));
  await tx1.wait();
  console.log(`✅ USDC sent: ${tx1.hash}`);
  
  // Wrap 0.01 ETH
  console.log(`\n🔄 Wrapping 0.01 ETH to WETH...`);
  const tx2 = await signer.sendTransaction({
    to: WETH_ADDR,
    value: hre.ethers.parseEther("0.01")
  });
  await tx2.wait();
  console.log(`✅ Wrapped: ${tx2.hash}`);
  
  // Transfer WETH
  console.log(`\n📤 Transferring 0.01 WETH to adapter...`);
  const tx3 = await WETH.transfer(ADAPTER, hre.ethers.parseEther("0.01"));
  await tx3.wait();
  console.log(`✅ WETH sent: ${tx3.hash}`);
  
  const adapterUSDC = await USDC.balanceOf(ADAPTER);
  const adapterWETH = await WETH.balanceOf(ADAPTER);
  
  console.log(`\n📊 Adapter Balance:`);
  console.log(`   USDC: ${hre.ethers.formatUnits(adapterUSDC, 6)}`);
  console.log(`   WETH: ${hre.ethers.formatEther(adapterWETH)}`);
  console.log(`\n✅ Sepolia adapter funded!`);
}

main().catch(console.error);
