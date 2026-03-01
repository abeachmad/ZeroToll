const hre = require("hardhat");
const { ethers } = hre;

/**
 * Script untuk memindahkan token dari Router dan Adapter
 * 
 * FUNCTIONS AVAILABLE:
 * - RouterHub.rescueTokens(token, amount) - onlyOwner
 * - MockDEXAdapter.withdrawFunds(token, amount) - onlyOwner
 * 
 * USAGE:
 * npx hardhat run scripts/withdraw-tokens.js --network sepolia
 * npx hardhat run scripts/withdraw-tokens.js --network amoy
 */

async function main() {
  console.log("\n🔧 ZeroToll Token Withdrawal Script");
  console.log("=" . repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📍 Using account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH/POL`);

  // Get network
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`🌐 Network: ${network.name} (Chain ID: ${chainId})`);

  // Contract addresses per chain
  let routerHub, adapter, usdc;
  
  if (chainId === 11155111) {
    // Sepolia
    routerHub = "0x1449279761a3e6642B02E82A7be9E5234be00159";
    adapter = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
    usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
  } else if (chainId === 80002) {
    // Amoy
    routerHub = "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b";
    adapter = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
    usdc = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // Amoy USDC
  } else {
    console.log("❌ Unsupported network");
    process.exit(1);
  }

  console.log(`\n📋 Contract Addresses:`);
  console.log(`  RouterHub:  ${routerHub}`);
  console.log(`  Adapter:    ${adapter}`);
  console.log(`  USDC:       ${usdc}`);

  // Load contracts
  const RouterHub = await ethers.getContractAt("RouterHub", routerHub);
  const Adapter = await ethers.getContractAt("MockDEXAdapter", adapter);
  const USDC = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdc);

  // Check owner
  const routerOwner = await RouterHub.owner();
  const adapterOwner = await Adapter.owner();
  
  console.log(`\n🔐 Contract Owners:`);
  console.log(`  RouterHub owner:  ${routerOwner}`);
  console.log(`  Adapter owner:    ${adapterOwner}`);
  console.log(`  Your address:     ${deployer.address}`);
  console.log(`  You are owner:    ${routerOwner.toLowerCase() === deployer.address.toLowerCase() ? '✅ YES' : '❌ NO'}`);

  if (routerOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("\n⚠️  WARNING: You are not the owner! Cannot withdraw tokens.");
    console.log("Only the contract owner can call rescueTokens() and withdrawFunds()");
    process.exit(1);
  }

  // Check balances
  const routerBalance = await USDC.balanceOf(routerHub);
  const adapterBalance = await USDC.balanceOf(adapter);

  console.log(`\n💰 Current Token Balances:`);
  console.log(`  RouterHub USDC:   ${ethers.formatUnits(routerBalance, 6)} USDC`);
  console.log(`  Adapter USDC:     ${ethers.formatUnits(adapterBalance, 6)} USDC`);

  // Prompt user
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => readline.question(query, resolve));

  console.log(`\n┌─────────────────────────────────────────────────────────────────┐`);
  console.log(`│                  WITHDRAWAL OPTIONS                             │`);
  console.log(`└─────────────────────────────────────────────────────────────────┘`);
  console.log(`1. Withdraw from RouterHub`);
  console.log(`2. Withdraw from Adapter`);
  console.log(`3. Withdraw from BOTH`);
  console.log(`4. Cancel`);

  const choice = await question('\nYour choice (1-4): ');

  if (choice === '4') {
    console.log("\n❌ Cancelled");
    readline.close();
    process.exit(0);
  }

  const recipient = await question(`Recipient address (press Enter for ${deployer.address}): `);
  const toAddress = recipient.trim() || deployer.address;

  console.log(`\n📤 Will send tokens to: ${toAddress}`);

  // Execute withdrawal
  const txs = [];

  if (choice === '1' || choice === '3') {
    if (routerBalance > 0) {
      console.log(`\n🔄 Withdrawing ${ethers.formatUnits(routerBalance, 6)} USDC from RouterHub...`);
      try {
        const tx = await RouterHub.rescueTokens(usdc, routerBalance);
        console.log(`  TX hash: ${tx.hash}`);
        await tx.wait();
        console.log(`  ✅ Success!`);
        txs.push(tx.hash);
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  RouterHub has no USDC to withdraw`);
    }
  }

  if (choice === '2' || choice === '3') {
    if (adapterBalance > 0) {
      console.log(`\n🔄 Withdrawing ${ethers.formatUnits(adapterBalance, 6)} USDC from Adapter...`);
      try {
        const tx = await Adapter.withdrawFunds(usdc, adapterBalance);
        console.log(`  TX hash: ${tx.hash}`);
        await tx.wait();
        console.log(`  ✅ Success!`);
        txs.push(tx.hash);
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  Adapter has no USDC to withdraw`);
    }
  }

  // Check final balances
  const finalRouterBalance = await USDC.balanceOf(routerHub);
  const finalAdapterBalance = await USDC.balanceOf(adapter);
  const deployerBalance = await USDC.balanceOf(deployer.address);

  console.log(`\n✅ WITHDRAWAL COMPLETE!`);
  console.log(`=" * 70`);
  console.log(`\n📊 Final Balances:`);
  console.log(`  RouterHub USDC:   ${ethers.formatUnits(finalRouterBalance, 6)} USDC`);
  console.log(`  Adapter USDC:     ${ethers.formatUnits(finalAdapterBalance, 6)} USDC`);
  console.log(`  Your USDC:        ${ethers.formatUnits(deployerBalance, 6)} USDC`);

  if (txs.length > 0) {
    console.log(`\n📋 Transaction Hashes:`);
    txs.forEach((hash, i) => console.log(`  ${i + 1}. ${hash}`));
  }

  readline.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
