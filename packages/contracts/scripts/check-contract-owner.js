const hre = require("hardhat");
const { ethers } = hre;

/**
 * Script untuk mengecek owner dari contracts dan balances
 * 
 * USAGE:
 * npx hardhat run scripts/check-contract-owner.js --network sepolia
 * npx hardhat run scripts/check-contract-owner.js --network amoy
 */

async function main() {
  console.log("\n🔍 Checking Contract Ownership & Balances");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📍 Your account: ${deployer.address}`);

  // Get network
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`🌐 Network: ${network.name} (Chain ID: ${chainId})`);

  // Contract addresses per chain
  let routerHub, adapter, usdc, weth;
  
  if (chainId === 11155111) {
    // Sepolia
    routerHub = "0x1449279761a3e6642B02E82A7be9E5234be00159";
    adapter = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
    usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    weth = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  } else if (chainId === 80002) {
    // Amoy
    routerHub = "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b";
    adapter = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
    usdc = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    weth = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"; // WPOL on Amoy
  } else {
    console.log("❌ Unsupported network");
    process.exit(1);
  }

  // Load contracts
  const RouterHub = await ethers.getContractAt("RouterHub", routerHub);
  const Adapter = await ethers.getContractAt("MockDEXAdapter", adapter);
  const USDC = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdc);
  const WETH = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", weth);

  // Check owners
  const routerOwner = await RouterHub.owner();
  const adapterOwner = await Adapter.owner();
  
  console.log(`\n🔐 CONTRACT OWNERSHIP`);
  console.log("=".repeat(70));
  console.log(`RouterHub (${routerHub}):`);
  console.log(`  Owner: ${routerOwner}`);
  console.log(`  Match: ${routerOwner.toLowerCase() === deployer.address.toLowerCase() ? '✅ YOU ARE OWNER' : '❌ NOT YOU'}`);
  console.log();
  console.log(`Adapter (${adapter}):`);
  console.log(`  Owner: ${adapterOwner}`);
  console.log(`  Match: ${adapterOwner.toLowerCase() === deployer.address.toLowerCase() ? '✅ YOU ARE OWNER' : '❌ NOT YOU'}`);

  // Check balances
  const routerUSDC = await USDC.balanceOf(routerHub);
  const routerWETH = await WETH.balanceOf(routerHub);
  const routerNative = await ethers.provider.getBalance(routerHub);
  
  const adapterUSDC = await USDC.balanceOf(adapter);
  const adapterWETH = await WETH.balanceOf(adapter);
  const adapterNative = await ethers.provider.getBalance(adapter);

  const deployerUSDC = await USDC.balanceOf(deployer.address);
  const deployerWETH = await WETH.balanceOf(deployer.address);
  const deployerNative = await ethers.provider.getBalance(deployer.address);

  console.log(`\n💰 TOKEN BALANCES`);
  console.log("=".repeat(70));
  
  console.log(`\nRouterHub:`);
  console.log(`  USDC:  ${ethers.formatUnits(routerUSDC, 6)} USDC`);
  console.log(`  WETH:  ${ethers.formatUnits(routerWETH, 18)} WETH`);
  console.log(`  Native: ${ethers.formatEther(routerNative)} ${chainId === 11155111 ? 'ETH' : 'POL'}`);
  
  console.log(`\nAdapter:`);
  console.log(`  USDC:  ${ethers.formatUnits(adapterUSDC, 6)} USDC`);
  console.log(`  WETH:  ${ethers.formatUnits(adapterWETH, 18)} WETH`);
  console.log(`  Native: ${ethers.formatEther(adapterNative)} ${chainId === 11155111 ? 'ETH' : 'POL'}`);
  
  console.log(`\nYour Wallet (${deployer.address}):`);
  console.log(`  USDC:  ${ethers.formatUnits(deployerUSDC, 6)} USDC`);
  console.log(`  WETH:  ${ethers.formatUnits(deployerWETH, 18)} WETH`);
  console.log(`  Native: ${ethers.formatEther(deployerNative)} ${chainId === 11155111 ? 'ETH' : 'POL'}`);

  // Summary
  const totalUSDC = routerUSDC + adapterUSDC;
  const totalWETH = routerWETH + adapterWETH;

  console.log(`\n📊 TOTAL IN CONTRACTS`);
  console.log("=".repeat(70));
  console.log(`  USDC:  ${ethers.formatUnits(totalUSDC, 6)} USDC`);
  console.log(`  WETH:  ${ethers.formatUnits(totalWETH, 18)} WETH`);

  // Can withdraw?
  const canWithdraw = routerOwner.toLowerCase() === deployer.address.toLowerCase();
  
  console.log(`\n✨ CAN YOU WITHDRAW TOKENS?`);
  console.log("=".repeat(70));
  if (canWithdraw) {
    console.log(`✅ YES! You are the owner of both contracts.`);
    console.log();
    console.log(`To withdraw, run:`);
    console.log(`  npx hardhat run scripts/withdraw-tokens.js --network ${network.name}`);
  } else {
    console.log(`❌ NO! You are not the owner.`);
    console.log(`Owner address: ${routerOwner}`);
    console.log(`You need to use the owner's private key to withdraw.`);
  }

  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
