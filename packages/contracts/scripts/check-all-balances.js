const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\n📊 Checking ALL Balances on ${network.toUpperCase()}\n`);

  // Addresses
  const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";
  const RELAYER = "0x41e0c44c1feeb1b3f9f972f6f45963bfda9bc1d0";

  let ROUTER, ADAPTER, NATIVE_TOKEN, USDC, WPOL_OR_WETH, TOKEN_NAME;

  if (network === "amoy") {
    ROUTER = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
    ADAPTER = "0xbe6F932465D5155c1564FF0AD7Cc9D2D2a4316d5";
    NATIVE_TOKEN = "POL";
    USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    WPOL_OR_WETH = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"; // WPOL
    TOKEN_NAME = "WPOL";
  } else if (network === "sepolia") {
    ROUTER = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
    ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";
    NATIVE_TOKEN = "ETH";
    USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    WPOL_OR_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH
    TOKEN_NAME = "WETH";
  } else {
    throw new Error("Unsupported network");
  }

  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const wrappedToken = await hre.ethers.getContractAt("IERC20", WPOL_OR_WETH);

  // Get balances
  async function getBalances(address, name) {
    const nativeBalance = await hre.ethers.provider.getBalance(address);
    const usdcBalance = await usdc.balanceOf(address);
    const wrappedBalance = await wrappedToken.balanceOf(address);

    console.log(`📍 ${name} (${address})`);
    console.log(`   ${NATIVE_TOKEN}: ${hre.ethers.formatEther(nativeBalance)}`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`   ${TOKEN_NAME}: ${hre.ethers.formatEther(wrappedBalance)}`);
    console.log();

    return {
      native: nativeBalance,
      usdc: usdcBalance,
      wrapped: wrappedBalance
    };
  }

  // Check all addresses
  console.log("=" .repeat(70));
  await getBalances(DEPLOYER, "DEPLOYER");
  await getBalances(RELAYER, "RELAYER");
  await getBalances(ROUTER, "ROUTER HUB");
  await getBalances(ADAPTER, "ADAPTER (MockDEX)");
  console.log("=" .repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
