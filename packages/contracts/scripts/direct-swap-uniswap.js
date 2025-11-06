const hre = require("hardhat");

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 DIRECT SWAP TEST - Sepolia Uniswap V2");
  console.log("=".repeat(70));

  // Contracts
  const UNISWAP_V2_ROUTER = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

  const [signer] = await hre.ethers.getSigners();
  console.log(`\n🔑 Using account: ${signer.address}`);

  // Get contracts
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const link = await hre.ethers.getContractAt("IERC20", LINK);

  // Uniswap V2 Router ABI
  const routerAbi = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
  ];
  const router = new hre.ethers.Contract(UNISWAP_V2_ROUTER, routerAbi, signer);

  // Check balances
  const usdcBalance = await usdc.balanceOf(signer.address);
  const linkBalanceBefore = await link.balanceOf(signer.address);

  console.log(`\n📊 Initial Balances:`);
  console.log(`  USDC: ${hre.ethers.formatUnits(usdcBalance, 6)}`);
  console.log(`  LINK: ${hre.ethers.formatUnits(linkBalanceBefore, 18)}`);

  // Swap params
  const amountIn = hre.ethers.parseUnits("0.01", 6); // 0.01 USDC
  const amountOutMin = 0; // Accept any amount for testnet
  const path = [USDC, WETH, LINK]; // Route through WETH
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  console.log(`\n📋 Swap Parameters:`);
  console.log(`  Amount In: ${hre.ethers.formatUnits(amountIn, 6)} USDC`);
  console.log(`  Path: USDC → WETH → LINK`);
  console.log(`  Deadline: ${deadline}`);

  // Step 1: Approve router
  console.log(`\n1️⃣  Approving Uniswap Router...`);
  const currentAllowance = await usdc.allowance(signer.address, UNISWAP_V2_ROUTER);
  
  if (currentAllowance < amountIn) {
    const approveTx = await usdc.approve(UNISWAP_V2_ROUTER, hre.ethers.MaxUint256, {
      gasLimit: 100000
    });
    console.log(`  📤 Approve TX: ${approveTx.hash}`);
    await approveTx.wait();
    console.log(`  ✅ Approved!`);
  } else {
    console.log(`  ✅ Already approved`);
  }

  // Step 2: Execute swap
  console.log(`\n2️⃣  Executing swap...`);
  try {
    const swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      signer.address,
      deadline,
      {
        gasLimit: 700000
      }
    );

    console.log(`  📤 Swap TX: ${swapTx.hash}`);
    console.log(`  ⏳ Waiting for confirmation...`);

    const receipt = await swapTx.wait();

    console.log("\n" + "=".repeat(70));
    if (receipt.status === 1) {
      console.log("🎉 SWAP SUCCESSFUL!");
    } else {
      console.log("❌ SWAP FAILED!");
    }
    console.log("=".repeat(70));

    console.log(`\n📋 Transaction Details:`);
    console.log(`  TX Hash: ${receipt.hash}`);
    console.log(`  Block: ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Check final balances
    const linkBalanceAfter = await link.balanceOf(signer.address);
    const linkReceived = linkBalanceAfter - linkBalanceBefore;

    console.log(`\n📊 Final Balances:`);
    console.log(`  LINK received: ${hre.ethers.formatUnits(linkReceived, 18)}`);

    console.log(`\n🔗 View on Sepolia Explorer:`);
    console.log(`  https://sepolia.etherscan.io/tx/${receipt.hash}`);

    console.log("\n" + "=".repeat(70));
    console.log("✅ PROOF-OF-LIFE COMPLETE!");
    console.log("="repeat(70));

  } catch (error) {
    console.error("\n❌ Swap failed:");
    console.error(error.message);
    if (error.receipt) {
      console.log(`\nTX Hash: ${error.receipt.hash}`);
      console.log(`Status: ${error.receipt.status}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
