/**
 * Check Smart Account details
 */

import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

const SMART_ACCOUNT = '0x2caF80daf45581E017aaC929812b92Ad954Be2E8';
const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const RELAYER = '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

async function main() {
  console.log('\n=== SMART ACCOUNT CHECK ===\n');
  console.log('Smart Account:', SMART_ACCOUNT);
  
  // Check code
  const code = await publicClient.getCode({ address: SMART_ACCOUNT });
  console.log('Code length:', code?.length || 0, 'bytes');
  
  // Check balance
  const balance = await publicClient.getBalance({ address: SMART_ACCOUNT });
  console.log('Balance:', formatEther(balance), 'ETH');
  
  // Try to read owner
  try {
    const owner = await publicClient.readContract({
      address: SMART_ACCOUNT,
      abi: parseAbi(['function owner() view returns (address)']),
      functionName: 'owner'
    });
    console.log('Owner:', owner);
    console.log('Expected owner (relayer):', RELAYER);
    console.log('Owner matches:', owner.toLowerCase() === RELAYER.toLowerCase());
  } catch (e) {
    console.log('Could not read owner:', e.message);
  }
  
  // Try to read entryPoint
  try {
    const ep = await publicClient.readContract({
      address: SMART_ACCOUNT,
      abi: parseAbi(['function entryPoint() view returns (address)']),
      functionName: 'entryPoint'
    });
    console.log('EntryPoint:', ep);
    console.log('Expected EntryPoint:', ENTRYPOINT);
    console.log('EntryPoint matches:', ep.toLowerCase() === ENTRYPOINT.toLowerCase());
  } catch (e) {
    console.log('Could not read entryPoint:', e.message);
  }
  
  // Check nonce
  try {
    const nonce = await publicClient.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256)']),
      functionName: 'getNonce',
      args: [SMART_ACCOUNT, 0n]
    });
    console.log('Nonce:', nonce.toString());
  } catch (e) {
    console.log('Could not read nonce:', e.message);
  }
}

main().catch(console.error);
