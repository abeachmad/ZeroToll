const hre = require("hardhat");

async function main() {
  console.log("💰 Approving RouterHub for MAX USDC...\n");

  // Use deployer account (not relayer)
  const [signer] = await hre.ethers.getSigners();
  console.log("Approving from account:", signer.address);

  const ROUTER_HUB = "0x19091A6c655704c8fb55023635eE3298DcDf66FF";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  const usdc = await hre.ethers.getContractAt("IERC20", USDC);

  // Approve max uint256
  const maxApproval = hre.ethers.MaxUint256;
  
  console.log("Current allowance:", hre.ethers.formatUnits(
    await usdc.allowance(signer.address, ROUTER_HUB),
    6
  ), "USDC");
  
  console.log("Approving for:", maxApproval.toString());
  
  const tx = await usdc.approve(ROUTER_HUB, maxApproval);
  console.log("TX:", tx.hash);
  await tx.wait();
  
  console.log("✅ Approved!");
  
  const newAllowance = await usdc.allowance(signer.address, ROUTER_HUB);
  console.log("New allowance:", newAllowance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
