/**
 * Test script for EIP-7702 gasless transactions
 * Uses a local account (private key) which supports signAuthorization
 * 
 * Run with: node scripts/test-gasless-7702.mjs
 */

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Configuration
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const CHAIN_ID = 80002;
const PIMLICO_URL = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`;

// Contract addresses on Amoy
const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX_ADAPTER = '0xc8a7e30e3ea68a2eaba3428acbf535f3320715d1';

// ERC20 ABI
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
];

async function main() {
  console.log('🚀 Starting EIP-7702 Gasless Transaction Test\n');
  
  // Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 Account address:', account.address);
  
  // Create public client
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  // Check account balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 POL Balance:', formatUnits(balance, 18), 'POL');
  
  // Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('💵 USDC Balance:', formatUnits(usdcBalance, 6), 'USDC');
  
  // Check if account has code (EIP-7702 delegation)
  const code = await publicClient.getCode({ address: account.address });
  console.log('📝 Account code:', code || '0x (fresh EOA)');
  
  const isDeployed = code && code !== '0x' && code.length > 2;
  console.log('🔍 Is deployed (has delegation):', isDeployed);
  
  // Create Pimlico client
  console.log('\n🔧 Creating Pimlico client...');
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(PIMLICO_URL),
  });
  
  // Check Pimlico availability
  try {
    const response = await fetch(PIMLICO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_supportedEntryPoints',
        params: [],
      }),
    });
    const data = await response.json();
    console.log('✅ Pimlico available, entry points:', data.result);
  } catch (error) {
    console.error('❌ Pimlico not available:', error.message);
    return;
  }
  
  // Test simple approval first
  console.log('\n📝 Test: Gasless USDC Approval');
  console.log('================================');
  
  try {
    // Create simple smart account (ERC-4337)
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: account,
      entryPoint: {
        address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        version: '0.7',
      },
    });
    
    console.log('✅ Smart account created:', smartAccount.address);
    
    // Create smart account client
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain: polygonAmoy,
      bundlerTransport: http(PIMLICO_URL),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrices = await pimlicoClient.getUserOperationGasPrice();
          return gasPrices.fast;
        },
      },
    });
    
    console.log('✅ Smart account client created');
    
    // Send approval
    const approvalAmount = parseUnits('1000000', 6);
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, approvalAmount],
    });
    
    console.log('🔄 Sending gasless approval...');
    
    const txHash = await smartAccountClient.sendTransaction({
      to: USDC_ADDRESS,
      data: approvalData,
      value: 0n,
    });
    
    console.log('✅ Transaction sent:', txHash);
    console.log('🔗 Explorer:', `https://amoy.polygonscan.com/tx/${txHash}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
  
  console.log('\n🏁 Test complete!');
}

main().catch(console.error);
