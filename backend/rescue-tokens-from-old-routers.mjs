/**
 * Rescue tokens from old/unused routers to current routers
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const deployerAccount = privateKeyToAccount(`0x${DEPLOYER_PRIVATE_KEY.replace('0x', '')}`);

// OLD routers to rescue FROM
const OLD_ROUTERS = {
  sepolia: [
    '0xd475255Ae38C92404f9740A19F93B8D2526A684b',
    '0x3f260E97be2528D7568dE495F908e04BC8722ec5',
    '0xd2Dd02987f256c2afbb6eb57667393460b7dcc34',
  ],
  amoy: [
    '0xa28aB456a0434335c6953fd3A32A15A5cB12FE1A',
    '0x8DABA829Fe6ACf7f3B9d98d52889beE5CcfEa3fD',
    '0x7065681d02601004e48C6e8Ac1F82B44cc6b36e6',
  ]
};

// CURRENT routers to rescue TO
const CURRENT_ROUTERS = {
  sepolia: '0x577560699EF88e99f15d04df57c9552056d2a10D',
  amoy: '0xc75df1943d6EFE04b422b9bB45509782609Fc67a'
};

// Tokens per network
const TOKENS = {
  sepolia: {
    zUSDC: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C',
    zETH: '0x8153FA09Be1689D44C343f119C829F6702A8720b',
    zPOL: '0x63c31C4247f6AA40B676478226d6FEB5707649D6',
    zLINK: '0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C'
  },
  amoy: {
    zUSDC: '0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD',
    zETH: '0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9',
    zPOL: '0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d',
    zLINK: '0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1'
  }
};

const TOKEN_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

const ROUTER_ABI = parseAbi([
  'function rescueTokens(address token, uint256 amount)',
  'function owner() view returns (address)'
]);

async function rescueFromNetwork(network, chain, rpcUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESCUING TOKENS ON ${network.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });

  const walletClient = createWalletClient({
    account: deployerAccount,
    chain,
    transport: http(rpcUrl)
  });

  const currentRouter = CURRENT_ROUTERS[network];
  const oldRouters = OLD_ROUTERS[network];
  const tokens = TOKENS[network];

  console.log(`\nCurrent Router: ${currentRouter}`);
  console.log(`Old Routers to rescue from: ${oldRouters.length}`);

  for (const oldRouter of oldRouters) {
    console.log(`\n--- Checking old router: ${oldRouter} ---`);
    
    // Check if deployer is owner
    let isOwner = false;
    try {
      const owner = await publicClient.readContract({
        address: oldRouter,
        abi: ROUTER_ABI,
        functionName: 'owner'
      });
      isOwner = owner.toLowerCase() === deployerAccount.address.toLowerCase();
      console.log(`Owner: ${owner} (${isOwner ? 'WE ARE OWNER' : 'NOT OWNER'})`);
    } catch (e) {
      console.log(`Cannot check owner: ${e.shortMessage || e.message}`);
      continue;
    }

    if (!isOwner) {
      console.log('Skipping - not owner');
      continue;
    }

    for (const [tokenName, tokenAddress] of Object.entries(tokens)) {
      try {
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: TOKEN_ABI,
          functionName: 'balanceOf',
          args: [oldRouter]
        });

        if (balance > 0n) {
          const decimals = await publicClient.readContract({
            address: tokenAddress,
            abi: TOKEN_ABI,
            functionName: 'decimals'
          });
          
          const formatted = (Number(balance) / 10**decimals).toFixed(2);
          console.log(`  ${tokenName}: ${formatted} tokens - RESCUING...`);

          try {
            const hash = await walletClient.writeContract({
              address: oldRouter,
              abi: ROUTER_ABI,
              functionName: 'rescueTokens',
              args: [tokenAddress, balance]
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`    ✅ Rescued to deployer: ${hash.slice(0, 10)}...`);

            // Now transfer to current router
            const transferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
            const transferHash = await walletClient.writeContract({
              address: tokenAddress,
              abi: transferAbi,
              functionName: 'transfer',
              args: [currentRouter, balance]
            });
            await publicClient.waitForTransactionReceipt({ hash: transferHash });
            console.log(`    ✅ Transferred to current router: ${transferHash.slice(0, 10)}...`);
          } catch (e) {
            console.log(`    ❌ Rescue failed: ${e.shortMessage || e.message}`);
          }
        } else {
          console.log(`  ${tokenName}: 0 tokens`);
        }
      } catch (e) {
        console.log(`  ${tokenName}: Error checking - ${e.shortMessage || e.message}`);
      }
    }
  }

  // Show final balances on current router
  console.log(`\n--- Current Router Final Balances ---`);
  for (const [tokenName, tokenAddress] of Object.entries(tokens)) {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: 'balanceOf',
        args: [currentRouter]
      });
      const decimals = await publicClient.readContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: 'decimals'
      });
      const formatted = (Number(balance) / 10**decimals).toFixed(2);
      console.log(`  ${tokenName}: ${formatted}`);
    } catch (e) {
      console.log(`  ${tokenName}: Error - ${e.message}`);
    }
  }
}

async function main() {
  console.log('Token Rescue Script');
  console.log('Deployer:', deployerAccount.address);

  // Sepolia
  await rescueFromNetwork('sepolia', sepolia, 'https://ethereum-sepolia-rpc.publicnode.com');

  // Amoy
  await rescueFromNetwork('amoy', polygonAmoy, 'https://rpc-amoy.polygon.technology');

  console.log('\n✅ Rescue complete!');
}

main().catch(console.error);
