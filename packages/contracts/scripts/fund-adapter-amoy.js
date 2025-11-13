#!/usr/bin/env node

/**
 * Fund MockDEXAdapter dengan test tokens untuk swap execution
 */

const { ethers } = require("hardhat");

const ADAPTER = "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1";

// Tokens
const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";

// Faucet addresses (if available) - skip for now
const AMOUNT_WMATIC = ethers.parseEther("100");  // 100 WMATIC
const AMOUNT_USDC = ethers.parseUnits("1000", 6);  // 1000 USDC

async function main() {
  console.log("💰 Funding MockDEXAdapter with test tokens...\n");

  const [deployer] = await ethers.getSigners();
  console.log("From:", deployer.address);
  console.log("To:", ADAPTER);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL\n");

  // Get token contracts
  const wmatic = await ethers.getContractAt("IERC20", WMATIC);
  const usdc = await ethers.getContractAt("IERC20", USDC);

  // Check balances
  const wmaticBalance = await wmatic.balanceOf(deployer.address);
  const usdcBalance = await usdc.balanceOf(deployer.address);

  console.log("Deployer balances:");
  console.log("  WMATIC:", ethers.formatEther(wmaticBalance));
  console.log("  USDC:", ethers.formatUnits(usdcBalance, 6));
  console.log();

  // Transfer WMATIC if we have it
  if (wmaticBalance >= AMOUNT_WMATIC) {
    console.log(`Transferring ${ethers.formatEther(AMOUNT_WMATIC)} WMATIC...`);
    const tx1 = await wmatic.transfer(ADAPTER, AMOUNT_WMATIC);
    await tx1.wait();
    console.log("✅ WMATIC transferred!");
  } else {
    console.log("⚠️  Not enough WMATIC, skipping");
  }

  // Transfer USDC if we have it
  if (usdcBalance >= AMOUNT_USDC) {
    console.log(`Transferring ${ethers.formatUnits(AMOUNT_USDC, 6)} USDC...`);
    const tx2 = await usdc.transfer(ADAPTER, AMOUNT_USDC);
    await tx2.wait();
    console.log("✅ USDC transferred!");
  } else {
    console.log("⚠️  Not enough USDC, skipping");
  }

  // Check adapter balances
  console.log("\nAdapter balances:");
  const adapterWmatic = await wmatic.balanceOf(ADAPTER);
  const adapterUsdc = await usdc.balanceOf(ADAPTER);
  console.log("  WMATIC:", ethers.formatEther(adapterWmatic));
  console.log("  USDC:", ethers.formatUnits(adapterUsdc, 6));

  console.log("\n✅ Done!");
  console.log("\n💡 If you need test tokens, use:");
  console.log("   - Polygon Faucet: https://faucet.polygon.technology");
  console.log("   - Wrap POL → WMATIC via WMATIC contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
