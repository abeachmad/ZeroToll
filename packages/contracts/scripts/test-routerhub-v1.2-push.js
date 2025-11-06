const hre = require("hardhat");

async function main() {
  const ROUTERHUB = "0x1449279761a3e6642B02E82A7be9E5234be00159"; // v1.2.1 with 800k gas
  const ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  const [signer] = await hre.ethers.getSigners();
  console.log(`Testing from: ${signer.address}`);

  // Get contracts
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const link = await hre.ethers.getContractAt("IERC20", LINK);

  // Check initial balances
  console.log("\n📊 Initial State:");
  const initialUSDC = await usdc.balanceOf(signer.address);
  const initialLINK = await link.balanceOf(signer.address);
  console.log(`  Signer USDC: ${hre.ethers.formatUnits(initialUSDC, 6)}`);
  console.log(`  Signer LINK: ${hre.ethers.formatUnits(initialLINK, 18)}`);

  // Approve RouterHub
  console.log("\n1️⃣  Approving RouterHub...");
  const allowance = await usdc.allowance(signer.address, ROUTERHUB);
  if (allowance < hre.ethers.parseUnits("0.01", 6)) {
    const approveTx = await usdc.approve(ROUTERHUB, hre.ethers.MaxUint256);
    await approveTx.wait();
    console.log(`  ✅ Approved (TX: ${approveTx.hash})`);
  } else {
    console.log(`  ✅ Already approved`);
  }

  // Build Intent
  const intent = {
    user: signer.address,
    tokenIn: USDC,
    amtIn: hre.ethers.parseUnits("0.01", 6), // 0.01 USDC
    tokenOut: LINK,
    minOut: hre.ethers.parseUnits("0.00001", 18), // min 0.00001 LINK
    dstChainId: 11155111,
    deadline: Math.floor(Date.now() / 1000) + 600,
    feeToken: hre.ethers.ZeroAddress,
    feeMode: 0, // NATIVE
    feeCapToken: 0,
    routeHint: "0x",
    nonce: Date.now(),
  };

  console.log("\n2️⃣  Building Intent:");
  console.log(`  User: ${intent.user}`);
  console.log(`  TokenIn: USDC (${USDC})`);
  console.log(`  TokenOut: LINK (${LINK})`);
  console.log(`  AmountIn: ${hre.ethers.formatUnits(intent.amtIn, 6)} USDC`);
  console.log(`  MinOut: ${hre.ethers.formatUnits(intent.minOut, 18)} LINK`);

  // Encode routeData (adapter.swap call)
  const adapterInterface = new hre.ethers.Interface([
    "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) returns (uint256)"
  ]);

  const routeData = adapterInterface.encodeFunctionData("swap", [
    USDC,
    LINK,
    intent.amtIn,
    intent.minOut,
    ROUTERHUB, // ← FIX: recipient must be RouterHub, not user!
    intent.deadline,
  ]);

  console.log("\n3️⃣  Executing Route via RouterHub v1.2 (PUSH PATTERN)...");
  console.log(`  Adapter: ${ADAPTER}`);
  
  try {
    const tx = await routerHub.executeRoute(intent, ADAPTER, routeData, {
      gasLimit: 1200000, // High enough for 2x safeTransfer + 800k adapter call
    });
    
    console.log(`  📤 TX sent: ${tx.hash}`);
    console.log(`  ⏳ Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    
    console.log("\n" + "=".repeat(70));
    console.log("🎉 TRANSACTION SUCCESSFUL!");
    console.log("=".repeat(70));
    console.log(`TX Hash: ${receipt.hash}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // Check for PrefundPushed event
    console.log("\n📋 Events:");
    for (const log of receipt.logs) {
      try {
        const parsed = routerHub.interface.parseLog(log);
        if (parsed) {
          console.log(`  ✅ ${parsed.name}:`, parsed.args);
        }
      } catch (e) {
        // Not a RouterHub event, skip
      }
    }

    // Check final balances
    console.log("\n📊 Final State:");
    const finalUSDC = await usdc.balanceOf(signer.address);
    const finalLINK = await link.balanceOf(signer.address);
    console.log(`  Signer USDC: ${hre.ethers.formatUnits(finalUSDC, 6)} (Δ ${hre.ethers.formatUnits(finalUSDC - initialUSDC, 6)})`);
    console.log(`  Signer LINK: ${hre.ethers.formatUnits(finalLINK, 18)} (Δ ${hre.ethers.formatUnits(finalLINK - initialLINK, 18)})`);

    console.log("\n🔗 View on Sepolia Explorer:");
    console.log(`https://sepolia.etherscan.io/tx/${receipt.hash}`);

  } catch (error) {
    console.error("\n❌ Transaction failed:");
    console.error(error);
    
    if (error.receipt) {
      console.log(`\nTX Hash: ${error.receipt.hash}`);
      console.log(`Block: ${error.receipt.blockNumber}`);
      console.log(`Gas Used: ${error.receipt.gasUsed.toString()}`);
      console.log(`Status: ${error.receipt.status}`);
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
