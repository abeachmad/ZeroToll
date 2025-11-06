const hre = require("hardhat");

async function main() {
  console.log("🔍 Testing RouterHub → Adapter flow step by step\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with account:", signer.address);

  const ROUTER_HUB = "0x19091A6c655704c8fb55023635eE3298DcDf66FF";
  const ADAPTER = "0xEE4BeDddFdCfD485AbF3fF5DaE5ab34071338e24";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function transfer(address,uint256) returns (bool)",
    "function decimals() view returns (uint8)"
  ];

  const usdc = await hre.ethers.getContractAt(erc20Abi, USDC);

  console.log("📊 STEP 1: Check current state");
  const signerUSDC = await usdc.balanceOf(signer.address);
  const routerUSDC = await usdc.balanceOf(ROUTER_HUB);
  const signerToRouter = await usdc.allowance(signer.address, ROUTER_HUB);
  const routerToAdapter = await usdc.allowance(ROUTER_HUB, ADAPTER);

  console.log("  Signer USDC:", hre.ethers.formatUnits(signerUSDC, 6));
  console.log("  RouterHub USDC:", hre.ethers.formatUnits(routerUSDC, 6));
  console.log("  Signer→RouterHub allowance:", hre.ethers.formatUnits(signerToRouter, 6));
  console.log("  RouterHub→Adapter allowance:", hre.ethers.formatUnits(routerToAdapter, 6));
  console.log("");

  console.log("📊 STEP 2: Manually send USDC to RouterHub (testing)");
  console.log("  This simulates what happens after RouterHub.transferFrom succeeds");
  
  const tx1 = await usdc.transfer(ROUTER_HUB, 10000);
  console.log("  TX:", tx1.hash);
  await tx1.wait();
  
  const routerUSDCAfter = await usdc.balanceOf(ROUTER_HUB);
  console.log("  ✅ RouterHub USDC now:", hre.ethers.formatUnits(routerUSDCAfter, 6));
  console.log("");

  console.log("📊 STEP 3: Check if adapter can now pull from RouterHub");
  console.log("  Need RouterHub to approve adapter first...");
  
  // We can't do this because we don't control RouterHub
  console.log("  ⚠️ Cannot test: We don't have RouterHub's private key");
  console.log("");

  console.log("💡 INSIGHT:");
  console.log("  The issue is that RouterHub needs to approve the adapter");
  console.log("  RouterHub DOES this on line 53: IERC20(tokenIn).approve(adapter, intent.amtIn)");
  console.log("  So this should work... unless there's a bug in the adapter");
  console.log("");

  console.log("🔍 Let's check what happens when adapter pulls from an address with balance but no approval");
  
  const adapterAbi = [
    "function swap(address,address,uint256,uint256,address,uint256) returns (uint256)"
  ];
  
  const adapter = await hre.ethers.getContractAt(adapterAbi, ADAPTER);
  
  console.log("  Simulating: adapter.swap() where caller (signer) has USDC but adapter has no allowance");
  
  try {
    await adapter.swap.staticCall(
      USDC,
      LINK,
      10000,
      400000000000000n,
      signer.address,
      Math.floor(Date.now() / 1000) + 600
    );
    console.log("  ✅ Would succeed");
  } catch (e) {
    console.log("  ❌ Would fail:", e.message.split('(')[0].trim());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
