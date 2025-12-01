/**
 * Check Sepolia MockDexAdapter configuration and liquidity
 */

import { 
  createPublicClient, 
  http, 
  parseUnits,
  formatUnits,
} from 'viem';
import { sepolia } from 'viem/chains';

const CONTRACTS = {
  routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
  mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
};

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const ROUTER_HUB_ABI = [
  { name: 'whitelistedAdapter', type: 'function', inputs: [{ name: 'adapter', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
];

const DEX_ADAPTER_ABI = [
  { name: 'supportedTokens', type: 'function', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { name: 'getQuote', type: 'function', inputs: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }], outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'path', type: 'address[]' }], stateMutability: 'view' },
];

async function main() {
  console.log('🔍 Checking Sepolia MockDexAdapter Configuration\n');
  
  const client = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check if adapter is whitelisted
  console.log('📋 RouterHub Configuration:');
  const isWhitelisted = await client.readContract({
    address: CONTRACTS.routerHub,
    abi: ROUTER_HUB_ABI,
    functionName: 'whitelistedAdapter',
    args: [CONTRACTS.mockDexAdapter],
  });
  console.log('   MockDexAdapter whitelisted:', isWhitelisted);
  
  // Check adapter token support
  console.log('\n📋 MockDexAdapter Token Support:');
  try {
    const usdcSupported = await client.readContract({
      address: CONTRACTS.mockDexAdapter,
      abi: DEX_ADAPTER_ABI,
      functionName: 'supportedTokens',
      args: [CONTRACTS.usdc],
    });
    console.log('   USDC supported:', usdcSupported);
  } catch (e) {
    console.log('   USDC supported: Error -', e.message);
  }
  
  try {
    const wethSupported = await client.readContract({
      address: CONTRACTS.mockDexAdapter,
      abi: DEX_ADAPTER_ABI,
      functionName: 'supportedTokens',
      args: [CONTRACTS.weth],
    });
    console.log('   WETH supported:', wethSupported);
  } catch (e) {
    console.log('   WETH supported: Error -', e.message);
  }
  
  // Check adapter liquidity
  console.log('\n📋 MockDexAdapter Liquidity:');
  const adapterUsdc = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [CONTRACTS.mockDexAdapter],
  });
  console.log('   USDC balance:', formatUnits(adapterUsdc, 6));
  
  const adapterWeth = await client.readContract({
    address: CONTRACTS.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [CONTRACTS.mockDexAdapter],
  });
  console.log('   WETH balance:', formatUnits(adapterWeth, 18));
  
  // Try to get a quote
  console.log('\n📋 Quote Test:');
  try {
    const [quote] = await client.readContract({
      address: CONTRACTS.mockDexAdapter,
      abi: DEX_ADAPTER_ABI,
      functionName: 'getQuote',
      args: [CONTRACTS.usdc, CONTRACTS.weth, parseUnits('0.5', 6)],
    });
    console.log('   0.5 USDC -> WETH quote:', formatUnits(quote, 18), 'WETH');
    
    if (adapterWeth < quote) {
      console.log('\n⚠️ ISSUE: Adapter has insufficient WETH liquidity!');
      console.log('   Needed:', formatUnits(quote, 18), 'WETH');
      console.log('   Available:', formatUnits(adapterWeth, 18), 'WETH');
    }
  } catch (e) {
    console.log('   Quote error:', e.message);
  }
}

main().catch(console.error);
