/**
 * Check MockDEXAdapter token balances on Amoy and Sepolia
 * 
 * Run: node scripts/check-adapter-balances.js
 */

const { ethers } = require('ethers');

// RPC URLs
const AMOY_RPC = 'https://rpc-amoy.polygon.technology';
const SEPOLIA_RPC = 'https://rpc.sepolia.org';

// Contract addresses
const CONTRACTS = {
  amoy: {
    mockDex: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1',
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
    tokens: {
      WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
      USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      LINK: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904'
    }
  },
  sepolia: {
    mockDex: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    tokens: {
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
      LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789'  // Sepolia LINK
    }
  }
};

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function checkBalances(network, rpcUrl, contracts) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking ${network.toUpperCase()} MockDEXAdapter balances`);
  console.log(`${'='.repeat(60)}`);
  console.log(`MockDEXAdapter: ${contracts.mockDex}`);
  console.log(`RouterHub: ${contracts.routerHub}`);
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Check native balance
  const nativeBalance = await provider.getBalance(contracts.mockDex);
  console.log(`\nNative balance: ${ethers.formatEther(nativeBalance)} ${network === 'amoy' ? 'POL' : 'ETH'}`);
  
  // Check token balances
  console.log('\nToken balances:');
  for (const [symbol, address] of Object.entries(contracts.tokens)) {
    try {
      const token = new ethers.Contract(address, ERC20_ABI, provider);
      const balance = await token.balanceOf(contracts.mockDex);
      const decimals = await token.decimals();
      const formatted = ethers.formatUnits(balance, decimals);
      
      const status = parseFloat(formatted) > 0 ? '✅' : '❌';
      console.log(`  ${status} ${symbol}: ${formatted} (${address})`);
    } catch (err) {
      console.log(`  ⚠️ ${symbol}: Error - ${err.message}`);
    }
  }
  
  // Also check RouterHub balances (should be 0 normally)
  console.log('\nRouterHub balances (should be ~0):');
  const routerNative = await provider.getBalance(contracts.routerHub);
  console.log(`  Native: ${ethers.formatEther(routerNative)}`);
  
  for (const [symbol, address] of Object.entries(contracts.tokens)) {
    try {
      const token = new ethers.Contract(address, ERC20_ABI, provider);
      const balance = await token.balanceOf(contracts.routerHub);
      const decimals = await token.decimals();
      const formatted = ethers.formatUnits(balance, decimals);
      console.log(`  ${symbol}: ${formatted}`);
    } catch (err) {
      console.log(`  ${symbol}: Error - ${err.message}`);
    }
  }
}

async function main() {
  console.log('MockDEXAdapter Balance Checker');
  console.log('==============================\n');
  
  try {
    await checkBalances('amoy', AMOY_RPC, CONTRACTS.amoy);
  } catch (err) {
    console.error('Error checking Amoy:', err.message);
  }
  
  try {
    await checkBalances('sepolia', SEPOLIA_RPC, CONTRACTS.sepolia);
  } catch (err) {
    console.error('Error checking Sepolia:', err.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTANT: MockDEXAdapter needs tokens to fulfill swaps!');
  console.log('If balances are 0, swaps will fail with "transfer amount exceeds balance"');
  console.log('='.repeat(60));
}

main().catch(console.error);
