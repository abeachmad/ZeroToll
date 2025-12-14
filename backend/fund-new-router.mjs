/**
 * Fund the new router with test liquidity
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const deployerAccount = privateKeyToAccount(`0x${DEPLOYER_PRIVATE_KEY.replace('0x', '')}`);

// New router address
const NEW_ROUTER = '0x577560699EF88e99f15d04df57c9552056d2a10D';

// zTokens on Sepolia
const TOKENS = {
  zUSDC: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C',
  zETH: '0x8153FA09Be1689D44C343f119C829F6702A8720b',
  zPOL: '0x63c31C4247f6AA40B676478226d6FEB5707649D6',
  zLINK: '0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C'
};

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const walletClient = createWalletClient({
  account: deployerAccount,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const TOKEN_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function faucet()',
  'function mint(address to, uint256 amount)',
  'function decimals() view returns (uint8)'
]);

async function main() {
  console.log('Funding new router with test liquidity...\n');
  console.log('Router:', NEW_ROUTER);
  console.log('Deployer:', deployerAccount.address);
  console.log('');

  for (const [name, address] of Object.entries(TOKENS)) {
    console.log(`\n--- ${name} (${address}) ---`);
    
    // Get decimals
    const decimals = await publicClient.readContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'decimals'
    });
    
    // Check router balance
    const routerBalance = await publicClient.readContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [NEW_ROUTER]
    });
    console.log(`Router balance: ${(Number(routerBalance) / 10**decimals).toFixed(2)} ${name}`);
    
    // Check deployer balance
    let deployerBalance = await publicClient.readContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [deployerAccount.address]
    });
    console.log(`Deployer balance: ${(Number(deployerBalance) / 10**decimals).toFixed(2)} ${name}`);
    
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
        continue;
      } catch (e) {
        console.log('Mint failed:', e.shortMessage || e.message);
      }
    }
    
    // Transfer to router if router has low balance
    const routerMinBalance = BigInt(5000) * BigInt(10 ** decimals);
    if (routerBalance < routerMinBalance && deployerBalance > routerMinBalance) {
      const transferAmount = BigInt(10000) * BigInt(10 ** decimals);
      console.log(`Transferring ${Number(transferAmount) / 10**decimals} ${name} to router...`);
      
      const transferHash = await walletClient.writeContract({
        address,
        abi: TOKEN_ABI,
        functionName: 'transfer',
        args: [NEW_ROUTER, transferAmount]
      });
      await publicClient.waitForTransactionReceipt({ hash: transferHash });
      console.log('✅ Transfer complete');
      
      // Verify
      const newRouterBalance = await publicClient.readContract({
        address,
        abi: TOKEN_ABI,
        functionName: 'balanceOf',
        args: [NEW_ROUTER]
      });
      console.log(`New router balance: ${(Number(newRouterBalance) / 10**decimals).toFixed(2)} ${name}`);
    } else if (routerBalance >= routerMinBalance) {
      console.log('✅ Router already has sufficient balance');
    } else {
      console.log('⚠️ Cannot fund router - deployer has insufficient balance');
    }
  }
  
  console.log('\n✅ Router funding complete!');
}

main().catch(console.error);
