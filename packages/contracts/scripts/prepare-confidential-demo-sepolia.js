const hre = require("hardhat");

const ESCROW = "0xCeA4c47fdE94536A291860D67DF9999A102Db56e";
const ZERO_TOLL_ADAPTER = "0x4E6A591459F0724E19f9B06A584B26fFB724a2a3";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const ZUSDC = "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C";
const TARGET_MAX_PRICE_AGE = 60 * 60 * 24 * 7;
const MAX_UINT256 = hre.ethers.MaxUint256;

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const ZERO_TOLL_ADAPTER_ABI = [
  "function maxPriceAge() view returns (uint256)",
  "function setMaxPriceAge(uint256 _maxAge)",
];

async function ensureApproval(label, tokenAddress, owner, spender) {
  const token = new hre.ethers.Contract(tokenAddress, ERC20_ABI, owner);
  const before = await token.allowance(owner.address, spender);
  console.log(`${label} allowance before: ${before}`);

  if (before === MAX_UINT256) {
    console.log(`${label} already approved.`);
    return null;
  }

  const tx = await token.approve(spender, MAX_UINT256);
  console.log(`${label} approve tx: ${tx.hash}`);
  await tx.wait();

  const after = await token.allowance(owner.address, spender);
  console.log(`${label} allowance after: ${after}`);
  return tx.hash;
}

async function ensureAdapterPriceAge(owner) {
  const adapter = new hre.ethers.Contract(ZERO_TOLL_ADAPTER, ZERO_TOLL_ADAPTER_ABI, owner);
  const current = await adapter.maxPriceAge();
  console.log(`ZeroTollAdapter maxPriceAge before: ${current}`);

  if (current >= TARGET_MAX_PRICE_AGE) {
    console.log("ZeroTollAdapter maxPriceAge already relaxed for demo use.");
    return null;
  }

  const tx = await adapter.setMaxPriceAge(TARGET_MAX_PRICE_AGE);
  console.log(`ZeroTollAdapter setMaxPriceAge tx: ${tx.hash}`);
  await tx.wait();

  const updated = await adapter.maxPriceAge();
  console.log(`ZeroTollAdapter maxPriceAge after: ${updated}`);
  return tx.hash;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Preparing confidential Sepolia demo with ${deployer.address}`);
  console.log(`Escrow: ${ESCROW}`);

  const approvals = [];
  approvals.push(await ensureApproval("USDC", USDC, deployer, ESCROW));
  approvals.push(await ensureApproval("zUSDC", ZUSDC, deployer, ESCROW));
  const priceAgeTx = await ensureAdapterPriceAge(deployer);

  console.log("\nDone.");
  console.log(
    JSON.stringify(
      {
        deployer: deployer.address,
        escrow: ESCROW,
        zeroTollAdapter: ZERO_TOLL_ADAPTER,
        approvalTxs: approvals.filter(Boolean),
        adapterPriceAgeTx: priceAgeTx,
        targetMaxPriceAge: TARGET_MAX_PRICE_AGE,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
