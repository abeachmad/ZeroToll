// Test if @metamask/smart-accounts-kit works in Node.js
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

console.log('✅ Smart Accounts Kit loaded successfully');
console.log('Implementation:', Implementation);
console.log('toMetaMaskSmartAccount:', typeof toMetaMaskSmartAccount);

// Test creating a public client
const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

console.log('✅ Public client created');
console.log('Chain:', publicClient.chain.name);
