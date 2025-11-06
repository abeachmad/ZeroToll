const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing MockDEXAdapter.swap() directly...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Testing with account:", signer.address);
  
  const ADAPTER = "0xEE4BeDddFdCfD485AbF3fF5DaE5ab34071338e24"; // FINAL with decimal fix
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  const adapterAbi = [
    "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) payable returns (uint256)",
    "function getQuote(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut, address[] path)"
  ];
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)"
  ];
  
  const adapter = await hre.ethers.getContractAt(adapterAbi, ADAPTER);
  const usdc = await hre.ethers.getContractAt(erc20Abi, USDC);
  const link = await hre.ethers.getContractAt(erc20Abi, LINK);
  
  const usdcDecimals = await usdc.decimals();
  const linkDecimals = await link.decimals();
  
  const amountIn = hre.ethers.parseUnits("0.01", usdcDecimals);
  const minOut = hre.ethers.parseUnits("0.0004", linkDecimals);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  
  console.log("\n1️⃣ Getting quote from adapter...");
  
  try {
    const [amountOut, path] = await adapter.getQuote(USDC, LINK, amountIn);
    console.log(`Quote: ${hre.ethers.formatUnits(amountIn, usdcDecimals)} USDC → ${hre.ethers.formatUnits(amountOut, linkDecimals)} LINK`);
    console.log("Path:", path);
    
    if (amountOut < minOut) {
      console.error(`❌ Quote (${amountOut}) is less than minOut (${minOut})`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ getQuote failed:", error.message);
    process.exit(1);
  }
  
  console.log("\n2️⃣ Approving adapter to spend USDC...");
  
  const approveTx = await usdc.approve(ADAPTER, amountIn);
  await approveTx.wait();
  console.log("✅ Approval successful");
  
  console.log("\n3️⃣ Calling adapter.swap()...");
  
  const linkBefore = await link.balanceOf(signer.address);
  console.log(`LINK balance before: ${hre.ethers.formatUnits(linkBefore, linkDecimals)}`);
  
  try {
    const tx = await adapter.swap(
      USDC,
      LINK,
      amountIn,
      minOut,
      signer.address,
      deadline
    );
    
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("✅ Swap successful!");
      
      const linkAfter = await link.balanceOf(signer.address);
      const received = linkAfter - linkBefore;
      console.log(`LINK balance after: ${hre.ethers.formatUnits(linkAfter, linkDecimals)}`);
      console.log(`LINK received: ${hre.ethers.formatUnits(received, linkDecimals)}`);
      console.log("\nExplorer:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    } else {
      console.log("❌ Transaction reverted");
    }
    
  } catch (error) {
    console.error("\n❌ Swap failed!");
    console.error("Error:", error.message);
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    if (error.data) {
      console.error("Data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
