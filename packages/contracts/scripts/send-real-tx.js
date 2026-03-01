const hre = require("hardhat");

async function main() {
  console.log("🚀 SENDING REAL TX to RouterHub.executeRoute (no gas estimation)\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Sending from:", signer.address);

  const ROUTER_HUB = "0x19091A6c655704c8fb55023635eE3298DcDf66FF";
  const ADAPTER = "0xEE4BeDddFdCfD485AbF3fF5DaE5ab34071338e24";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);

  const intent = {
    user: signer.address,
    tokenIn: USDC,
    amtIn: 10000,
    tokenOut: LINK,
    minOut: 400000000000000n,
    dstChainId: 11155111,
    deadline: Math.floor(Date.now() / 1000) + 600,
    feeToken: USDC,
    feeMode: 1,
    feeCapToken: 0,
    routeHint: "0x",
    nonce: 0
  };

  const swapSelector = "0x9908fc8b";
  const routeData = hre.ethers.concat([
    swapSelector,
    hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256", "address", "uint256"],
      [USDC, LINK, 10000, 400000000000000n, signer.address, intent.deadline]
    )
  ]);

  console.log("Intent:", intent);
  console.log("Adapter:", ADAPTER);
  console.log("Route data:", routeData.slice(0, 66) + "...");
  console.log("");

  console.log("Sending TX with manual gas settings...");
  
  try {
    const tx = await routerHub.executeRoute(
      intent,
      ADAPTER,
      routeData,
      {
        gasLimit: 800000 // High gas limit
      }
    );
    
    console.log("TX sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log("✅ SUCCESS!");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Explorer:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    
  } catch (e) {
    console.log("❌ FAILED!");
    console.log("Error:", e.message);
    
    if (e.receipt) {
      console.log("TX was mined but reverted");
      console.log("TX hash:", e.receipt.hash);
      console.log("Gas used:", e.receipt.gasUsed.toString());
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
