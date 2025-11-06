/**
 * Step-by-step test to isolate the exact failure point
 */

const hre = require("hardhat");

async function main() {
  console.log("🔬 Step-by-step debugging...\n");
  
  const [signer] = await hre.ethers.getSigners();

  const ROUTERHUB = "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b";
  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const USDC = "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB);
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);

  // Step 1: Check quote
  console.log("Step 1: Getting quote from adapter...");
  const [quoteOut, path] = await adapter.getQuote(USDC, WPOL, 100000n);
  console.log("  Quote:", hre.ethers.formatEther(quoteOut), "WPOL for 0.1 USDC");
  console.log("  Path:", path);

  // Step 2: Check if 0.01 WPOL minOut is achievable
  const minOut = hre.ethers.parseEther("0.01");
  console.log("\n  Step 2: Checking slippage...");
  console.log("  Min out required:", hre.ethers.formatEther(minOut), "WPOL");
  console.log("  Quote out:", hre.ethers.formatEther(quoteOut), "WPOL");
  console.log("  Slippage check:", quoteOut >= minOut ? "✅ PASS" : "❌ FAIL");

  // Step 3: Check allowance
  console.log("\nStep 3: Checking allowance...");
  const allowance = await usdc.allowance(signer.address, ROUTERHUB);
  console.log("  Allowance:", allowance > 100000n ? "✅ Sufficient" : "❌ Insufficient");

  // Step 4: Check balances
  console.log("\nStep 4: Checking balances...");
  const signerUSDC = await usdc.balanceOf(signer.address);
  const adapterWPOL = await hre.ethers.getContractAt("IERC20", WPOL).then(c => c.balanceOf(ADAPTER));
  console.log("  Signer USDC:", hre.ethers.formatUnits(signerUSDC, 6));
  console.log("  Adapter WPOL:", hre.ethers.formatEther(adapterWPOL));

  // Step 5: Try the swap
  console.log("\nStep 5: Attempting swap via RouterHub...");
  
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const intent = {
    user: signer.address,
    tokenIn: USDC,
    amtIn: 100000n,
    tokenOut: WPOL,
    minOut: minOut,
    dstChainId: 80002,
    deadline: deadline,
    feeToken: "0x0000000000000000000000000000000000000000",
    feeMode: 0,
    feeCapToken: 0,
    routeHint: "0x",
    nonce: 0
  };

  const routeData = adapter.interface.encodeFunctionData("swap", [
    USDC, WPOL, 100000n, minOut, signer.address, deadline
  ]);

  console.log("  Encoded routeData, length:", routeData.length);
  
  // Try with higher gas limit
  try {
    const tx = await routerHub.executeRoute(intent, ADAPTER, routeData, {
      gasLimit: 2000000, // Increased to 2M
      maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
    });
    
    console.log("\n⏳ TX sent:", tx.hash);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("\n🎉🎉🎉 SUCCESS! 🎉🎉🎉");
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("TX: https://amoy.polygonscan.com/tx/" + tx.hash);
    }
  } catch (error) {
    console.error("\n❌ Failed at Step 5");
    console.error("Gas used:", error.receipt?.gasUsed.toString());
    console.error("TX:", error.receipt?.hash);
  }
}

main().catch(console.error);
