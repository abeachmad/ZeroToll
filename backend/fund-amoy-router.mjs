/**
 * Fund the new Amoy router with test liquidity
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const deployerAccount = privateKeyToAccount(`0x${DEPLOYER_PRIVATE_KEY.replace('0x', '')}`);

// New router address on Amoy
const NEW_ROUTER = '0xc75df1943d6EFE04b422b9bB45509782609Fc67a';

// zTokens on Amoy
const TOKENS = {
  zUSDC: '0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD',
  zETH: '0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9',
  zPOL: '0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d',
  zLINK: '0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1'
};

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

const walletClient = createWalletClient({
  account: deployerAccount,
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

const TOKEN_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function faucet()',
  'function mint(address to, uint256 amount)',
  'function decimals() view returns (uint8)'
]);

async function main() {
  console.log('Funding new Amoy router with test liquidity...\n');
  console.log('Router:', NEW_ROUTER);
  console.log('Deployer:', deployerAccount.address);
  console.log('');

  for (const [name, address] of Object.entries(TOKENS)) {
    console.log(`\n--- ${name} (${address}) ---`);
    
    // Get decimals
    let decimals;
    try {
      decimals = await publicClient.readContract({
        address,
        abi: TOKEN_ABI,
        functionName: 'decimals'
      });
    } catch (e) {
      decimals = name === 'zUSDC' ? 6 : 18;
      console.log(`Using default decimals: ${decimals}`);
    }
    
    // Check router balance
    const routerBalance = await publicClient.readContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [NEW_ROUTER]
    });
    console.log(`Router balance: ${(Number(routerBalance) / 10**decimals).toFixed(2)} ${name}`);
    
    // Mint tokens directly to router (deployer is owner)
    const minBalance = BigInt(10000) * BigInt(10 ** decimals);
    if (routerBalance < minBalance) {
      console.log('Minting tokens directly to router...');
      try {
        const mintHash = await walletClient.writeContract({
          address,
          abi: TOKEN_ABI,
          functionName: 'mint',
          args: [NEW_ROUTER, minBalance * 2n]
        });
        await publicClient.waitForTransactionReceipt({ hash: mintHash });
        console.log('✅ Minted tokens to router');
        
        const newBalance = await publicClient.readContract({
          address,
          abi: TOKEN_ABI,
          functionName: 'balanceOf',
          args: [NEW_ROUTER]
        });
        console.log(`New router balance: ${(Number(newBalance) / 10**decimals).toFixed(2)} ${name}`);
      } catch (e) {
        console.log('Mint failed:', e.shortMessage || e.message);
      }
    } else {
      console.log('✅ Router already has sufficient balance');
    }
  }
  
  console.log('\n✅ Amoy router funding complete!');
}

main().catch(console.error);
