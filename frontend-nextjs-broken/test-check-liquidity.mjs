/**
 * Check adapter liquidity
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';

const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const WPOL_ADDRESS = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
const MOCK_DEX_ADAPTER = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  console.log('📊 MockDEXAdapter Liquidity Check\n');
  console.log('Adapter:', MOCK_DEX_ADAPTER);
  
  const adapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('\n💵 USDC:', formatUnits(adapterUsdc, 6));
  
  const adapterWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('💰 WPOL:', formatUnits(adapterWpol, 18));
  
  // Check if liquidity is sufficient
  if (parseFloat(formatUnits(adapterWpol, 18)) < 5) {
    console.log('\n⚠️ WPOL liquidity is LOW! Need to fund the adapter.');
  } else {
    console.log('\n✅ Liquidity looks good!');
  }
}

main().catch(console.error);
