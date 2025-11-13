/**
 * Test Fee Collection
 * Execute a swap and verify 0.5% fee flows to Paymaster
 */

const hre = require("hardhat");
const { ethers } = hre;

// Network configurations
const CONFIG = {
  amoy: {
    routerHub: "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881",
    paymaster: "0x620138B987C5EE4fb2476a2D409d67979D0AE50F",
    adapter: "0xc8a769B6dd35c34B8c5612b340cCA52Fca7B041c", // OdosAdapter (correct checksum)
    tokenIn: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", // WMATIC
    tokenOut: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC
  },
  sepolia: {
    routerHub: "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84",
    paymaster: "0x2058E1DC26cE80f543157182734aA95DABE70FD7",
    adapter: "0x...", // TODO: Add Sepolia adapter
    tokenIn: "0x...", // TODO: Add Sepolia WMATIC
    tokenOut: "0x...", // TODO: Add Sepolia USDC
  }
};

async function main() {
  const [signer] = await ethers.getSigners();
  const network = hre.network.name;
  
  console.log("\n=== TESTING FEE COLLECTION ===");
  console.log("Network:", network);
  console.log("Tester:", signer.address);
  console.log("");
  
  const config = CONFIG[network];
  if (!config || !config.adapter || config.adapter === "0x...") {
    console.log("❌ Configuration not complete for network:", network);
    console.log("   Please update CONFIG with adapter and token addresses");
    return;
  }
  
  // Ensure addresses are properly checksummed
  config.adapter = ethers.getAddress(config.adapter);
  config.tokenIn = ethers.getAddress(config.tokenIn);
  config.tokenOut = ethers.getAddress(config.tokenOut);
  config.paymaster = ethers.getAddress(config.paymaster);

  // Connect to contracts
  const routerHub = await ethers.getContractAt("RouterHub", config.routerHub);
  
  // ERC20 ABI for token operations
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];
  
  const tokenIn = new ethers.Contract(config.tokenIn, ERC20_ABI, signer);
  const tokenOut = new ethers.Contract(config.tokenOut, ERC20_ABI, signer);
  
  // Check fee configuration
  console.log("=== CURRENT FEE CONFIGURATION ===");
  const feeBps = await routerHub.gaslessFeeBps();
  const feeRecipient = await routerHub.gaslessFeeRecipient();
  console.log("Fee BPS:", feeBps.toString(), `(${Number(feeBps) / 100}%)`);
  console.log("Fee Recipient:", feeRecipient);
  
  if (feeRecipient.toLowerCase() !== config.paymaster.toLowerCase()) {
    console.log("❌ Fee recipient mismatch!");
    console.log("   Expected:", config.paymaster);
    console.log("   Got:", feeRecipient);
    return;
  }
  console.log("✅ Fee recipient correctly set to Paymaster");
  console.log("");

  // Check balances BEFORE swap
  console.log("=== BALANCES BEFORE SWAP ===");
  const userTokenInBefore = await tokenIn.balanceOf(signer.address);
  const userTokenOutBefore = await tokenOut.balanceOf(signer.address);
  const paymasterTokenOutBefore = await tokenOut.balanceOf(config.paymaster);
  
  console.log(`User ${await tokenIn.symbol()}:`, ethers.formatUnits(userTokenInBefore, await tokenIn.decimals()));
  console.log(`User ${await tokenOut.symbol()}:`, ethers.formatUnits(userTokenOutBefore, await tokenOut.decimals()));
  console.log(`Paymaster ${await tokenOut.symbol()}:`, ethers.formatUnits(paymasterTokenOutBefore, await tokenOut.decimals()));
  console.log("");

  // Swap parameters
  const amountIn = ethers.parseUnits("0.1", await tokenIn.decimals()); // 0.1 WMATIC
  const minOut = ethers.parseUnits("0.01", await tokenOut.decimals()); // Minimum 0.01 USDC (very conservative)
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  console.log("=== EXECUTING SWAP ===");
  console.log(`Amount In: ${ethers.formatUnits(amountIn, await tokenIn.decimals())} ${await tokenIn.symbol()}`);
  console.log(`Min Out: ${ethers.formatUnits(minOut, await tokenOut.decimals())} ${await tokenOut.symbol()}`);
  
  // Check allowance
  const allowance = await tokenIn.allowance(signer.address, config.routerHub);
  if (allowance < amountIn) {
    console.log("\nApproving RouterHub to spend tokens...");
    const approveTx = await tokenIn.approve(config.routerHub, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✅ Approval confirmed");
  }

  // Build Intent struct
  const intent = {
    user: signer.address,
    tokenIn: config.tokenIn,
    amtIn: amountIn,
    tokenOut: config.tokenOut,
    minOut: minOut,
    dstChainId: 0, // Same chain
    deadline: deadline,
    feeToken: ethers.ZeroAddress,
    feeMode: 0, // NATIVE
    feeCapToken: 0,
    routeHint: "0x",
    nonce: 0
  };

  // Execute swap
  console.log("\nExecuting swap...");
  const tx = await routerHub.executeRoute(
    intent,
    config.adapter,
    "0x" // Odos adapter uses empty routeData
  );
  console.log("Transaction submitted:", tx.hash);
  
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Swap executed!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log("   Block:", receipt.blockNumber);
  console.log("");

  // Check balances AFTER swap
  console.log("=== BALANCES AFTER SWAP ===");
  const userTokenInAfter = await tokenIn.balanceOf(signer.address);
  const userTokenOutAfter = await tokenOut.balanceOf(signer.address);
  const paymasterTokenOutAfter = await tokenOut.balanceOf(config.paymaster);
  
  console.log(`User ${await tokenIn.symbol()}:`, ethers.formatUnits(userTokenInAfter, await tokenIn.decimals()));
  console.log(`User ${await tokenOut.symbol()}:`, ethers.formatUnits(userTokenOutAfter, await tokenOut.decimals()));
  console.log(`Paymaster ${await tokenOut.symbol()}:`, ethers.formatUnits(paymasterTokenOutAfter, await tokenOut.decimals()));
  console.log("");

  // Calculate changes
  const tokenInSpent = userTokenInBefore - userTokenInAfter;
  const tokenOutReceived = userTokenOutAfter - userTokenOutBefore;
  const paymasterFeeReceived = paymasterTokenOutAfter - paymasterTokenOutBefore;
  
  console.log("=== CHANGES ===");
  console.log(`User spent: ${ethers.formatUnits(tokenInSpent, await tokenIn.decimals())} ${await tokenIn.symbol()}`);
  console.log(`User received: ${ethers.formatUnits(tokenOutReceived, await tokenOut.decimals())} ${await tokenOut.symbol()}`);
  console.log(`Paymaster fee: ${ethers.formatUnits(paymasterFeeReceived, await tokenOut.decimals())} ${await tokenOut.symbol()}`);
  console.log("");

  // Verify fee calculation
  const expectedFeeRate = Number(feeBps) / 10000; // 0.005 for 50 bps
  const grossOutput = tokenOutReceived + paymasterFeeReceived;
  const calculatedFee = grossOutput * BigInt(Math.floor(expectedFeeRate * 10000)) / 10000n;
  const actualFeeRate = Number(paymasterFeeReceived) / Number(grossOutput);
  
  console.log("=== FEE VERIFICATION ===");
  console.log(`Gross output (before fee): ${ethers.formatUnits(grossOutput, await tokenOut.decimals())} ${await tokenOut.symbol()}`);
  console.log(`Expected fee rate: ${expectedFeeRate * 100}%`);
  console.log(`Actual fee rate: ${(actualFeeRate * 100).toFixed(3)}%`);
  console.log(`Fee tolerance: ${Math.abs(actualFeeRate - expectedFeeRate) < 0.0001 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (paymasterFeeReceived > 0n) {
    console.log("\n✅ FEE COLLECTION SUCCESSFUL!");
    console.log(`   Paymaster received ${ethers.formatUnits(paymasterFeeReceived, await tokenOut.decimals())} ${await tokenOut.symbol()}`);
    console.log(`   User received ${ethers.formatUnits(tokenOutReceived, await tokenOut.decimals())} ${await tokenOut.symbol()} (after fee)`);
  } else {
    console.log("\n❌ FEE COLLECTION FAILED!");
    console.log("   Paymaster received 0 tokens");
    console.log("   Check RouterHub fee configuration");
  }
  
  console.log("\n=== TEST COMPLETE ===");
  console.log("Transaction:", tx.hash);
  console.log(`Block Explorer: https://${network === 'amoy' ? 'www.oklink.com/amoy' : 'sepolia.etherscan.io'}/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
