import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

// Try multiple RPCs
const rpcs = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
  'https://sepolia.drpc.org'
];

for (const rpc of rpcs) {
  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpc)
    });
    
    const balance = await client.getBalance({ address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' });
    console.log(`${rpc}: ${formatEther(balance)} ETH`);
  } catch (e) {
    console.log(`${rpc}: Error - ${e.message}`);
  }
}
