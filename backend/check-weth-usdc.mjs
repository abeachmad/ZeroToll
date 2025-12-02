import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const ADAPTER = '0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const UNISWAP_FACTORY = '0x0227628f3F023bb0B980b67D528571c95c6DaC1c';

const client = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });

// Check adapter liquidity
const adapterAbi = parseAbi([
  'function liquidity(address) view returns (uint256)',
  'function hasUniswapPool(address, address) view returns (bool, uint24)'
]);

const wethLiq = await client.readContract({ address: ADAPTER, abi: adapterAbi, functionName: 'liquidity', args: [WETH] });
const usdcLiq = await client.readContract({ address: ADAPTER, abi: adapterAbi, functionName: 'liquidity', args: [USDC] });

console.log('SmartDexAdapter:', ADAPTER);
console.log('WETH liquidity:', (Number(wethLiq) / 1e18).toFixed(4));
console.log('USDC liquidity:', (Number(usdcLiq) / 1e6).toFixed(2)); // USDC has 6 decimals

// Check Uniswap pool
try {
  const [hasPool, fee] = await client.readContract({ 
    address: ADAPTER, 
    abi: adapterAbi, 
    functionName: 'hasUniswapPool', 
    args: [WETH, USDC] 
  });
  console.log('Uniswap WETH/USDC pool:', hasPool ? `Yes (fee: ${fee})` : 'No');
} catch (e) {
  console.log('Uniswap pool check failed:', e.message);
}

// Check Uniswap factory directly
const factoryAbi = parseAbi(['function getPool(address, address, uint24) view returns (address)']);
const fees = [500, 3000, 10000];
for (const fee of fees) {
  const pool = await client.readContract({ 
    address: UNISWAP_FACTORY, 
    abi: factoryAbi, 
    functionName: 'getPool', 
    args: [WETH, USDC, fee] 
  });
  if (pool !== '0x0000000000000000000000000000000000000000') {
    console.log(`Uniswap pool (${fee/10000}% fee):`, pool);
  }
}
