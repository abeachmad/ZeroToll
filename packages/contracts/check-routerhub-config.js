/**
 * Check RouterHub configuration on Amoy
 */

const { ethers } = require('ethers');

const AMOY_RPC = 'https://rpc-amoy.polygon.technology';

const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

const ROUTER_HUB_ABI = [
  'function whitelistedAdapter(address) view returns (bool)',
  'function nativeToWrapped(address) view returns (address)',
  'function feeSink() view returns (address)',
  'function gaslessFeeRecipient() view returns (address)',
  'function gaslessFeeBps() view returns (uint16)',
  'function owner() view returns (address)'
];

const MOCK_DEX_ABI = [
  'function supportedTokens(address) view returns (bool)',
  'function priceOracle() view returns (address)',
  'function owner() view returns (address)'
];

const TOKENS = {
  WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
  USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  LINK: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904'
};

async function main() {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  
  console.log('RouterHub Configuration Check (Amoy)');
  console.log('=====================================\n');
  
  // Check RouterHub
  const routerHub = new ethers.Contract(ROUTER_HUB, ROUTER_HUB_ABI, provider);
  
  console.log('RouterHub:', ROUTER_HUB);
  console.log('  Owner:', await routerHub.owner());
  console.log('  FeeSink:', await routerHub.feeSink());
  console.log('  GaslessFeeRecipient:', await routerHub.gaslessFeeRecipient());
  console.log('  GaslessFeeBps:', (await routerHub.gaslessFeeBps()).toString());
  
  // Check if MockDEX is whitelisted
  const isWhitelisted = await routerHub.whitelistedAdapter(MOCK_DEX);
  console.log(`\n  MockDEX Whitelisted: ${isWhitelisted ? '✅ YES' : '❌ NO'}`);
  
  // Check native to wrapped mapping
  const NATIVE_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const wrappedToken = await routerHub.nativeToWrapped(NATIVE_MARKER);
  console.log(`  Native->Wrapped: ${wrappedToken}`);
  
  // Check MockDEX
  console.log('\nMockDEXAdapter:', MOCK_DEX);
  const mockDex = new ethers.Contract(MOCK_DEX, MOCK_DEX_ABI, provider);
  
  console.log('  Owner:', await mockDex.owner());
  console.log('  PriceOracle:', await mockDex.priceOracle());
  
  // Check supported tokens
  console.log('\n  Supported Tokens:');
  for (const [symbol, address] of Object.entries(TOKENS)) {
    const supported = await mockDex.supportedTokens(address);
    console.log(`    ${symbol}: ${supported ? '✅ YES' : '❌ NO'} (${address})`);
  }
  
  console.log('\n=====================================');
  console.log('If MockDEX is not whitelisted or tokens not supported,');
  console.log('swaps will fail!');
}

main().catch(console.error);
