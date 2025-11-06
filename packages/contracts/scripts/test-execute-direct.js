const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing RouterHub.executeRoute directly...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with account:", signer.address);
  
  const ROUTER_HUB = "0x19091A6c655704c8fb55023635eE3298DcDf66FF";
  const ADAPTER = "0xEE4BeDddFdCfD485AbF3fF5DaE5ab34071338e24"; // FINAL with decimal fix
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  // First, verify adapter is whitelisted
  console.log("📋 Verifying adapter state...\n");
  
  const routerAbi = [
    "function whitelistedAdapter(address) view returns (bool)",
    "function executeRoute((address user, address tokenIn, uint256 amtIn, address tokenOut, uint256 minOut, uint64 dstChainId, uint64 deadline, address feeToken, uint8 feeMode, uint256 feeCapToken, bytes routeHint, uint256 nonce) intent, address adapter, bytes routeData) returns (uint256)"
  ];
  
  const routerHub = await hre.ethers.getContractAt(routerAbi, ROUTER_HUB);
  
  const isWhitelisted = await routerHub.whitelistedAdapter(ADAPTER);
  console.log(`Adapter ${ADAPTER} whitelisted:`, isWhitelisted);
  
  if (!isWhitelisted) {
    console.error("❌ Adapter is NOT whitelisted! This is the problem.");
    console.log("\nTo fix, run:");
    console.log(`  npx hardhat run scripts/whitelist-adapter.js --network sepolia`);
    process.exit(1);
  }
  
  // Check adapter supported tokens
  console.log("\n📦 Checking adapter configuration...\n");
  
  const adapterAbi = [
    "function supportedTokens(address) view returns (bool)",
    "function owner() view returns (address)",
    "function protocolName() view returns (string)"
  ];
  
  const adapter = await hre.ethers.getContractAt(adapterAbi, ADAPTER);
  
  const usdcSupported = await adapter.supportedTokens(USDC);
  const linkSupported = await adapter.supportedTokens(LINK);
  const owner = await adapter.owner();
  const protocolName = await adapter.protocolName();
  
  console.log("Adapter protocol:", protocolName);
  console.log("Adapter owner:", owner);
  console.log(`USDC (${USDC}) supported:`, usdcSupported);
  console.log(`LINK (${LINK}) supported:`, linkSupported);
  
  if (!usdcSupported || !linkSupported) {
    console.error("\n❌ One or both tokens not supported by adapter!");
    process.exit(1);
  }
  
  // Check token balances
  console.log("\n💰 Checking token balances...\n");
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)"
  ];
  
  const usdc = await hre.ethers.getContractAt(erc20Abi, USDC);
  const link = await hre.ethers.getContractAt(erc20Abi, LINK);
  
  const usdcDecimals = await usdc.decimals();
  const linkDecimals = await link.decimals();
  
  const signerUSDC = await usdc.balanceOf(signer.address);
  const adapterLINK = await link.balanceOf(ADAPTER);
  
  console.log(`Signer USDC balance: ${hre.ethers.formatUnits(signerUSDC, usdcDecimals)}`);
  console.log(`Adapter LINK balance: ${hre.ethers.formatUnits(adapterLINK, linkDecimals)}`);
  
  // Now try to execute the swap
  console.log("\n🚀 Attempting executeRoute...\n");
  
  const amountIn = hre.ethers.parseUnits("0.01", usdcDecimals);
  const minOut = hre.ethers.parseUnits("0.0004", linkDecimals);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
  
  console.log("Intent parameters:");
  console.log("  user:", signer.address);
  console.log("  tokenIn:", USDC);
  console.log("  amtIn:", amountIn.toString(), `(${hre.ethers.formatUnits(amountIn, usdcDecimals)} USDC)`);
  console.log("  tokenOut:", LINK);
  console.log("  minOut:", minOut.toString(), `(${hre.ethers.formatUnits(minOut, linkDecimals)} LINK)`);
  console.log("  deadline:", deadline, `(expires in 600s)`);
  
  // Build intent
  const intent = {
    user: signer.address,
    tokenIn: USDC,
    amtIn: amountIn,
    tokenOut: LINK,
    minOut: minOut,
    dstChainId: 11155111,
    deadline: deadline,
    feeToken: USDC,
    feeMode: 1, // INPUT
    feeCapToken: hre.ethers.parseUnits("0.01", 18),
    routeHint: "0x",
    nonce: Math.floor(Date.now() / 1000)
  };
  
  // Build route data (encoded swap() call)
  const swapAbi = ["function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) returns (uint256)"];
  const iface = new hre.ethers.Interface(swapAbi);
  
  const routeData = iface.encodeFunctionData("swap", [
    USDC,
    LINK,
    amountIn,
    minOut,
    signer.address, // recipient
    deadline
  ]);
  
  console.log("\nRoute data (swap call):", routeData.slice(0, 66) + "...");
  
  // Step 1: Approve RouterHub to spend USDC
  console.log("\n🔐 Step 1: Approving RouterHub to spend USDC...");
  
  const approveTx = await usdc.approve(ROUTER_HUB, amountIn);
  await approveTx.wait();
  console.log("✅ Approval successful");
  
  // Step 2: Call executeRoute
  console.log("\n📡 Step 2: Calling RouterHub.executeRoute...");
  
  try {
    // First try with estimateGas to see the revert reason
    console.log("Estimating gas (to catch revert)...");
    
    const gasEstimate = await routerHub.executeRoute.estimateGas(
      intent,
      ADAPTER,
      routeData
    );
    
    console.log("Gas estimate:", gasEstimate.toString());
    
    // If we get here, the call should succeed
    const tx = await routerHub.executeRoute(
      intent,
      ADAPTER,
      routeData,
      { gasLimit: gasEstimate * 120n / 100n } // 20% buffer
    );
    
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("\n✅ SUCCESS! Transaction confirmed!");
      console.log("Explorer:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    } else {
      console.log("\n❌ Transaction reverted");
      console.log("Explorer:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    }
    
  } catch (error) {
    console.log("\n❌ REVERT CAUGHT!");
    console.log("\nFull error:");
    console.log(error);
    
    if (error.data) {
      console.log("\nError data:", error.data);
    }
    
    if (error.reason) {
      console.log("\nRevert reason:", error.reason);
    }
    
    // Try to decode the error
    if (error.error && error.error.data) {
      console.log("\nRaw error data:", error.error.data);
      
      // Check if it's a standard Error(string)
      if (error.error.data.startsWith("0x08c379a0")) {
        try {
          const errorAbi = ["error Error(string message)"];
          const errorIface = new hre.ethers.Interface(errorAbi);
          const decoded = errorIface.parseError(error.error.data);
          console.log("\nDecoded error:", decoded.args[0]);
        } catch (e) {
          console.log("Could not decode error");
        }
      }
    }
    
    console.log("\n🔍 Debugging suggestions:");
    console.log("1. The adapter may be reverting inside swap()");
    console.log("2. Check if adapter has enough LINK to transfer out");
    console.log("3. Verify the swap() function signature matches");
    console.log("4. Check if RouterHub is calling adapter correctly");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
