/**
 * Transfer USDC from EOA to Safe account
 * Usage: node transfer-to-safe.mjs [chain] [amount]
 */

import { 
  http, 
  createPublicClient,
  createWalletClient,
  parseAbi,
  formatUnits,
  parseUnits,
} from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const SAFE_ADDRESS = '0x9D6009202Ee72d98d51C1bFe9914eCd7e50bF2e3';

const CHAINS = {
  amoy: { chain: polygonAmoy, usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' },
  sepolia: { chain: sepolia, usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
]);

async function main() {
  const chainName = process.argv[2] || 'amoy';
  const amount = process.argv[3] || '5';
  const config = CHAINS[chainName];
  
  if (!config) {
    console.error('Use: amoy | sepolia');
    process.exit(1);
  }
  
  console.log(`💸 Transfer ${amount} USDC to Safe on ${chainName}\n`);
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('From:', account.address);
  console.log('To:', SAFE_ADDRESS);
  
  const publicClient = createPublicClient({ chain: config.chain, transport: http() });
  const walletClient = createWalletClient({ account, chain: config.chain, transport: http() });
  
  const balance = await publicClient.readContract({
    address: config.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  });
  console.log('\nEOA USDC:', formatUnits(balance, 6));
  
  const transferAmount = parseUnits(amount, 6);
  if (balance < transferAmount) {
    console.log('❌ Not enough USDC!');
    return;
  }
  
  console.log('\n📤 Transferring...');
  const hash = await walletClient.writeContract({
    address: config.usdc, abi: ERC20_ABI, functionName: 'transfer', args: [SAFE_ADDRESS, transferAmount],
  });
  
  console.log('TX:', hash);
  console.log('⏳ Waiting...');
  await publicClient.waitForTransactionReceipt({ hash });
  
  const newBalance = await publicClient.readContract({
    address: config.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [SAFE_ADDRESS],
  });
  console.log('✅ Safe USDC:', formatUnits(newBalance, 6));
}

main().catch(console.error);
