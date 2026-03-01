const hre = require("hardhat");

async function main() {
  console.log("💰 Funding new MockDEXAdapter with LINK...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding from account:", deployer.address);

  const ADAPTER = "0xcf9f209DCED8181937E289E3D68f8B2cEB77A904"; // FINAL adapter with defensive checks
  const LINK_TOKEN = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
  
  const erc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const link = await hre.ethers.getContractAt(erc20Abi, LINK_TOKEN);

  const linkBalance = await link.balanceOf(deployer.address);
  const decimals = await link.decimals();
  console.log(`Deployer LINK balance: ${hre.ethers.formatUnits(linkBalance, decimals)}`);

  const fundAmount = hre.ethers.parseUnits("10", decimals); // Reduced to 10 LINK
  
  console.log(`\n💸 Transferring ${hre.ethers.formatUnits(fundAmount, decimals)} LINK to adapter...`);
  const tx = await link.transfer(ADAPTER, fundAmount);
  await tx.wait();
  console.log("✅ LINK funded!");

  const adapterBalance = await link.balanceOf(ADAPTER);
  console.log(`Adapter LINK balance: ${hre.ethers.formatUnits(adapterBalance, decimals)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
