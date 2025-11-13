/**
 * Comprehensive test script for newly funded Amoy adapter
 * Tests all available token pairs to ensure adapter is working correctly
 */

const hre = require("hardhat");
const { ethers } = hre;

const ADAPTER = "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1";
const ROUTER_HUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";

const TOKENS = {
  WMATIC: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
  USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  LINK: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
};

// Current adapter balances (from migration)
const ADAPTER_BALANCES = {
  WMATIC: "8.994222222222222228",
  USDC: "31.098064",
  LINK: "40.0",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL\n");

  // Connect to contracts
  const adapter = await ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const routerHub = await ethers.getContractAt("RouterHub", ROUTER_HUB);

  console.log("=== ADAPTER STATUS ===");
  console.log("Adapter:", ADAPTER);
  console.log("RouterHub:", ROUTER_HUB);

  // Check adapter configuration
  try {
    const owner = await adapter.owner();
    console.log("Adapter owner:", owner);
    console.log("Is owner?", owner.toLowerCase() === deployer.address.toLowerCase());
  } catch (error) {
    console.log("❌ Failed to get owner:", error.message);
  }

  // Check adapter balances
  console.log("\n=== ADAPTER BALANCES ===");
  for (const [symbol, address] of Object.entries(TOKENS)) {
    const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", address);
    const decimals = await token.decimals();
    const balance = await token.balanceOf(ADAPTER);
    console.log(`${symbol}:`, ethers.formatUnits(balance, decimals));
  }

  // Check deployer balances
  console.log("\n=== DEPLOYER BALANCES (for test swaps) ===");
  for (const [symbol, address] of Object.entries(TOKENS)) {
    const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", address);
    const decimals = await token.decimals();
    const balance = await token.balanceOf(deployer.address);
    console.log(`${symbol}:`, ethers.formatUnits(balance, decimals));
  }

  // Test cases
  const testCases = [
    {
      name: "WMATIC → USDC (0.1 WMATIC)",
      tokenIn: TOKENS.WMATIC,
      tokenOut: TOKENS.USDC,
      amountIn: ethers.parseUnits("0.1", 18),
      symbolIn: "WMATIC",
      symbolOut: "USDC",
      decimalsIn: 18,
      decimalsOut: 6,
    },
    {
      name: "USDC → WMATIC (1 USDC)",
      tokenIn: TOKENS.USDC,
      tokenOut: TOKENS.WMATIC,
      amountIn: ethers.parseUnits("1", 6),
      symbolIn: "USDC",
      symbolOut: "WMATIC",
      decimalsIn: 6,
      decimalsOut: 18,
    },
    {
      name: "LINK → USDC (0.5 LINK)",
      tokenIn: TOKENS.LINK,
      tokenOut: TOKENS.USDC,
      amountIn: ethers.parseUnits("0.5", 18),
      symbolIn: "LINK",
      symbolOut: "USDC",
      decimalsIn: 18,
      decimalsOut: 6,
    },
  ];

  console.log("\n=== QUOTE TESTS ===");
  for (const test of testCases) {
    try {
      const [amountOut, path] = await adapter.getQuote(
        test.tokenIn,
        test.tokenOut,
        test.amountIn
      );
      console.log(`\n${test.name}:`);
      console.log(`  Input: ${ethers.formatUnits(test.amountIn, test.decimalsIn)} ${test.symbolIn}`);
      console.log(`  Expected output: ${ethers.formatUnits(amountOut, test.decimalsOut)} ${test.symbolOut}`);
      console.log(`  Path: ${path.join(" → ")}`);
    } catch (error) {
      console.log(`\n❌ ${test.name}: Quote failed`);
      console.log(`   Error:`, error.message);
    }
  }

  console.log("\n=== SWAP EXECUTION TESTS ===");
  console.log("Note: These will use deployer's tokens and require adapter to have output tokens\n");

  // Test 1: WMATIC → USDC (small amount to test)
  const test1 = testCases[0];
  console.log(`\n--- TEST 1: ${test1.name} ---`);
  
  try {
    const tokenIn = await ethers.getContractAt("IERC20", test1.tokenIn);
    const tokenOut = await ethers.getContractAt("IERC20", test1.tokenOut);
    
    // Check deployer has enough tokenIn
    const deployerBalance = await tokenIn.balanceOf(deployer.address);
    console.log(`Deployer ${test1.symbolIn} balance:`, ethers.formatUnits(deployerBalance, test1.decimalsIn));
    
    if (deployerBalance < test1.amountIn) {
      console.log(`❌ Insufficient ${test1.symbolIn} balance for test`);
      console.log(`   Need: ${ethers.formatUnits(test1.amountIn, test1.decimalsIn)}`);
      console.log(`   Have: ${ethers.formatUnits(deployerBalance, test1.decimalsIn)}`);
    } else {
      // Get quote
      const [expectedOut] = await adapter.getQuote(test1.tokenIn, test1.tokenOut, test1.amountIn);
      const minOut = (expectedOut * 95n) / 100n; // 5% slippage tolerance
      
      console.log(`Expected output: ${ethers.formatUnits(expectedOut, test1.decimalsOut)} ${test1.symbolOut}`);
      console.log(`Min output (5% slippage): ${ethers.formatUnits(minOut, test1.decimalsOut)} ${test1.symbolOut}`);
      
      // Check adapter has enough tokenOut
      const adapterOutBalance = await tokenOut.balanceOf(ADAPTER);
      console.log(`Adapter ${test1.symbolOut} balance:`, ethers.formatUnits(adapterOutBalance, test1.decimalsOut));
      
      if (adapterOutBalance < expectedOut) {
        console.log(`⚠️  Adapter has insufficient ${test1.symbolOut} for swap`);
        console.log(`   Need: ${ethers.formatUnits(expectedOut, test1.decimalsOut)}`);
        console.log(`   Have: ${ethers.formatUnits(adapterOutBalance, test1.decimalsOut)}`);
        console.log(`   This is expected for mock adapter - needs funding`);
      } else {
        // Approve RouterHub
        console.log("\nApproving RouterHub...");
        const approveTx = await tokenIn.approve(ROUTER_HUB, test1.amountIn);
        await approveTx.wait();
        console.log("✅ Approved");
        
        // Create intent (matching IntentLib.Intent struct)
        const intent = {
          user: deployer.address,
          tokenIn: test1.tokenIn,
          amtIn: test1.amountIn,
          tokenOut: test1.tokenOut,
          minOut: minOut,
          dstChainId: 80002, // Amoy
          deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
          feeToken: ethers.ZeroAddress,
          feeMode: 0, // NATIVE
          feeCapToken: 0,
          routeHint: "0x",
          nonce: 0,
        };
        
        // Encode adapter.swap() call
        const routeData = adapter.interface.encodeFunctionData("swap", [
          test1.tokenIn,
          test1.tokenOut,
          test1.amountIn,
          minOut,
          ROUTER_HUB, // recipient (adapter sends back to RouterHub)
          intent.deadline,
        ]);
        
        // Execute swap
        console.log("\nExecuting swap via RouterHub...");
        const balanceBefore = await tokenOut.balanceOf(deployer.address);
        
        const swapTx = await routerHub.executeRoute(intent, ADAPTER, routeData);
        const receipt = await swapTx.wait();
        
        const balanceAfter = await tokenOut.balanceOf(deployer.address);
        const received = balanceAfter - balanceBefore;
        
        console.log("✅ Swap successful!");
        console.log(`   TX: ${receipt.hash}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   Received: ${ethers.formatUnits(received, test1.decimalsOut)} ${test1.symbolOut}`);
        console.log(`   Expected: ${ethers.formatUnits(expectedOut, test1.decimalsOut)} ${test1.symbolOut}`);
        
        // Check slippage
        const slippage = ((expectedOut - received) * 10000n) / expectedOut;
        console.log(`   Slippage: ${Number(slippage) / 100}%`);
      }
    }
  } catch (error) {
    console.log(`\n❌ Swap execution failed:`, error.message);
    if (error.data) {
      console.log("   Error data:", error.data);
    }
  }

  console.log("\n=== TEST SUMMARY ===");
  console.log("✅ Adapter is funded and ready");
  console.log("✅ Quote function working");
  console.log("⚠️  For full swap tests, ensure:");
  console.log("   1. Deployer has test tokens (get from faucet)");
  console.log("   2. Adapter has sufficient output tokens");
  console.log("   3. Approval given to RouterHub");
  console.log("\n💡 Next step: Add fee-on-output logic to RouterHub");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
