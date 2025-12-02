/**
 * Check who owns the MockDEXAdapter
 */

import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

const MOCK_DEX_ADAPTER = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

const ADAPTER_ABI = [
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
];

async function main() {
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  console.log('🔍 Checking MockDEXAdapter Owner\n');
  console.log('Adapter:', MOCK_DEX_ADAPTER);
  
  try {
    const owner = await publicClient.readContract({
      address: MOCK_DEX_ADAPTER,
      abi: ADAPTER_ABI,
      functionName: 'owner',
    });
    
    console.log('Owner:', owner);
    console.log('\n🔗 View on Polygonscan:');
    console.log(`   Adapter: https://amoy.polygonscan.com/address/${MOCK_DEX_ADAPTER}`);
    console.log(`   Owner: https://amoy.polygonscan.com/address/${owner}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
