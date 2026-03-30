const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const {
  loadSharedConfig,
  saveSharedConfig,
  syncSharedConfig,
  getChainConfig,
} = require('../../shared-config/scripts/shared-config.cjs');

async function main() {
  const networkName = hre.network.name;
  const sharedConfig = loadSharedConfig();
  const { key, chain } = getChainConfig(sharedConfig, networkName);

  const [deployer] = await hre.ethers.getSigners();
  const feeRecipient =
    chain.contracts.feeSink ||
    chain.contracts.treasury ||
    process.env.TREASURY_ADDRESS ||
    deployer.address;
  const wrappedNativeToken = chain.contracts.wrappedToken;
  const permit2 = sharedConfig.permit2 || process.env.PERMIT2_ADDRESS;

  if (!wrappedNativeToken) {
    throw new Error(`No wrappedToken configured for ${networkName}.`);
  }
  if (!permit2) {
    throw new Error(`No Permit2 configured for ${networkName}.`);
  }

  console.log(`\n🔐 Deploying ConfidentialIntentEscrow to ${networkName}...`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Fee recipient: ${feeRecipient}\n`);
  console.log(`Wrapped native token: ${wrappedNativeToken}\n`);
  console.log(`Permit2: ${permit2}\n`);

  const Factory = await hre.ethers.getContractFactory('ConfidentialIntentEscrow');
  const escrow = await Factory.deploy(feeRecipient, wrappedNativeToken, permit2);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`✅ ConfidentialIntentEscrow: ${address}`);

  const trustedOperatorTx = await escrow.setTrustedOperator(deployer.address, true);
  await trustedOperatorTx.wait();
  console.log(`✅ Trusted operator enabled for deployer: ${deployer.address}`);

  const deployment = {
    network: networkName,
    networkKey: key,
    chainId: chain.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    feeRecipient,
    wrappedNativeToken,
    permit2,
    confidentialIntentEscrow: address,
    trustedOperator: deployer.address,
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outputFile = path.join(
    deploymentsDir,
    `confidential-intent-escrow-${networkName}-${Date.now()}.json`
  );
  fs.writeFileSync(outputFile, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`📝 Wrote deployment file: ${outputFile}`);

  if (process.argv.includes('--sync') || process.env.SYNC_SHARED_CONFIG === '1') {
    chain.contracts.confidentialIntentEscrow = address;
    saveSharedConfig(sharedConfig);
    console.log('♻️  Syncing shared config artifacts...');
    syncSharedConfig();
    console.log(`✅ Shared config updated for ${key}`);
  } else {
    console.log('ℹ️  Shared config not updated automatically. Re-run with --sync to persist the address.');
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };
