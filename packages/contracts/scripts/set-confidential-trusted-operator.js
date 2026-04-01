const hre = require('hardhat');

async function main() {
  const escrowAddress = process.env.CONFIDENTIAL_ESCROW_ADDRESS;
  const operatorAddress = process.env.CONFIDENTIAL_TRUSTED_OPERATOR || process.env.RELAYER_ADDRESS;
  const enabled = String(process.env.CONFIDENTIAL_TRUSTED_ENABLED || 'true').toLowerCase() !== 'false';

  if (!escrowAddress) {
    throw new Error('Missing CONFIDENTIAL_ESCROW_ADDRESS');
  }
  if (!operatorAddress) {
    throw new Error('Missing CONFIDENTIAL_TRUSTED_OPERATOR or RELAYER_ADDRESS');
  }

  const [signer] = await hre.ethers.getSigners();
  const escrow = await hre.ethers.getContractAt('ConfidentialIntentEscrow', escrowAddress, signer);

  console.log(`\n🔐 Updating trusted operator on ${hre.network.name}`);
  console.log(`Escrow:   ${escrowAddress}`);
  console.log(`Owner:    ${signer.address}`);
  console.log(`Operator: ${operatorAddress}`);
  console.log(`Enabled:  ${enabled}\n`);

  const tx = await escrow.setTrustedOperator(operatorAddress, enabled);
  console.log(`📝 Tx submitted: ${tx.hash}`);
  await tx.wait();

  const status = await escrow.trustedOperators(operatorAddress);
  console.log(`✅ trustedOperators(${operatorAddress}) = ${status}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };
