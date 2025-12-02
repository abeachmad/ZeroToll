/**
 * Fund ZeroTollRouterV2 with test liquidity
 * This allows the mock swap to work in test mode
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '.env.credentials' });

const ROUTER_V2 = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';

// Sepolia test tokens
const TOKENS = {
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574'
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
]);

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Missing DEPLOYER_PRIVATE_KEY');
    process.exit(1);
  }

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);
  console.log('Deployer:', account.address);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com')
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com')
  });

  console.log('\nChecking deployer token balances...');
  
  for (const [name, address] of Object.entries(TOKENS)) {
    const balance = await publicClient.readContract({
      address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    console.log(`${name}: ${balance.toString()}`);
    
    // If we have tokens, send some to router
    if (balance > BigInt(0)) {
      const amountToSend = balance / BigInt(2); // Send half
      console.log(`  Sending ${amountToSend} to router...`);
      
      try {
        const hash = await walletClient.writeContract({
          address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [ROUTER_V2, amountToSend]
        });
        console.log(`  Tx: ${hash}`);
      } catch (e) {
        console.log(`  Failed: ${e.message}`);
      }
    }
  }

  console.log('\nRouter liquidity after funding:');
  for (const [name, address] of Object.entries(TOKENS)) {
    const balance = await publicClient.readContract({
      address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [ROUTER_V2]
    });
    console.log(`${name}: ${balance.toString()}`);
  }
}

main().catch(console.error);
