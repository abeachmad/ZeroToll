const hre = require("hardhat");

async function main() {
  const ADAPTER_V7 = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  const ROUTERHUB_V12 = "0x7439Be8D0A9642c2Ac2E14e6876555433fe004dB";
  const LINK_ADDRESS = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  const [signer] = await hre.ethers.getSigners();
  console.log(`Setting up from: ${signer.address}`);

  // Whitelist adapter v7 in RouterHub v1.2
  console.log("\n1. Whitelisting adapter v7 in RouterHub v1.2...");
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB_V12);
  const whitelistTx = await routerHub.whitelistAdapter(ADAPTER_V7, true);
  await whitelistTx.wait();
  console.log(`✅ TX: ${whitelistTx.hash}`);

  // Fund adapter with LINK
  console.log("\n2. Funding adapter with 5 LINK...");
  const link = await hre.ethers.getContractAt("IERC20", LINK_ADDRESS);
  const fundAmount = hre.ethers.parseUnits("5", 18);
  const fundTx = await link.transfer(ADAPTER_V7, fundAmount);
  await fundTx.wait();
  console.log(`✅ TX: ${fundTx.hash}`);

  // Verify balances
  const adapterBalance = await link.balanceOf(ADAPTER_V7);
  console.log(`\n✅ Adapter LINK balance: ${hre.ethers.formatUnits(adapterBalance, 18)}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Setup complete!");
  console.log("=".repeat(60));
  console.log(`RouterHub v1.2: ${ROUTERHUB_V12}`);
  console.log(`Adapter v7: ${ADAPTER_V7}`);
  console.log(`Adapter whitelisted: YES`);
  console.log(`Adapter funded: ${hre.ethers.formatUnits(adapterBalance, 18)} LINK`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
