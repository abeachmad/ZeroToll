/**
 * FULL GASLESS SWAP TEST
 * 
 * This tests a complete gasless swap:
 * 1. Approve USDC
 * 2. Execute swap via RouterHub
 * 
 * All in one UserOperation, sponsored by Pimlico paymaster!
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

// Configuration
const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

const AMOY_CONFIG = {
  chain: polygonAmoy,
  chainId: 80002,
  rpc: 'https://rpc-amoy.polygon.technology',
  pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
  tokens: {
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9'
  },
  routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
  mockDexAdapter: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1'
};

// ABIs
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }]
  }
];

const ROUTER_HUB_ABI = [
  {
    name: 'executeRoute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'tokenIn', type: 'address' },
          { name: 'amtIn', type: 'uint256' },
          { name: 'tokenOut', type: 'address' },
          { name: 'minOut', type: 'uint256' },
          { name: 'dstChainId', type: 'uint64' },
          { name: 'deadline', type: 'uint64' },
          { name: 'feeToken', type: 'address' },
          { name: 'feeMode', type: 'uint8' },
          { name: 'feeCapToken', type: 'uint256' },
          { name: 'routeHint', type: 'bytes' },
          { name: 'nonce', type: 'uint256' }
        ]
      },
      { name: 'adapter', type: 'address' },
      { name: 'routeData', type: 'bytes' }
    ],
    outputs: [{ type: 'uint256' }]
  }
];

const MOCK_DEX_ABI = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [{ type: 'uint256' }]
  }
];

async function main() {
  console.log('='.repeat(70));
  console.log('FULL GASLESS SWAP TEST - EIP-7702');
  console.log('='.repeat(70));
  
  // Create account
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('\n📍 Wallet Address:', account.address);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: AMOY_CONFIG.chain,
    transport: http(AMOY_CONFIG.rpc)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: AMOY_CONFIG.chain,
    transport: http(AMOY_CONFIG.rpc)
  });
  
  // Step 1: Check Smart Account
  console.log('\n📋 Step 1: Checking Smart Account...');
  const code = await publicClient.getCode({ address: account.address });
  
  if (!code || !code.startsWith('0xef0100')) {
    console.log('❌ Not a Smart Account');
    return;
  }
  console.log('✅ Smart Account ENABLED');
  
  // Step 2: Check balances
  console.log('\n📋 Step 2: Checking Balances...');
  
  const nativeBalance = await publicClient.getBalance({ address: account.address });
  const usdcBalance = await publicClient.readContract({
    address: AMOY_CONFIG.tokens.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address]
  });
  const wmaticBalance = await publicClient.readContract({
    address: AMOY_CONFIG.tokens.WMATIC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address]
  });
  
  console.log('   POL:', formatUnits(nativeBalance, 18));
  console.log('   USDC:', formatUnits(usdcBalance, 6));
  console.log('   WMATIC:', formatUnits(wmaticBalance, 18));
  
  // Step 3: Create Smart Account
  console.log('\n📋 Step 3: Creating Smart Account Instance...');
  
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: 'Stateless7702',
    address: account.address,
    signer: { walletClient }
  });
  
  console.log('✅ Smart Account ready');
  
  // Step 4: Create Pimlico client
  console.log('\n📋 Step 4: Creating Pimlico Client...');
  
  const pimlicoClient = createPimlicoClient({
    chain: AMOY_CONFIG.chain,
    transport: http(AMOY_CONFIG.pimlicoRpc),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });
  
  // Step 5: Create Bundler Client
  console.log('\n📋 Step 5: Creating Bundler Client...');
  
  const bundlerClient = createBundlerClient({
    chain: AMOY_CONFIG.chain,
    transport: http(AMOY_CONFIG.pimlicoRpc),
    account: smartAccount,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      }
    }
  });
  
  console.log('✅ Bundler client ready');
  
  // Step 6: Build swap calls
  console.log('\n📋 Step 6: Building Swap Calls...');
  
  const swapAmount = parseUnits('0.05', 6); // 0.05 USDC
  const minOut = parseUnits('0.01', 18); // Very low minOut
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  // Build routeData for MockDEXAdapter
  const routeData = encodeFunctionData({
    abi: MOCK_DEX_ABI,
    functionName: 'swap',
    args: [
      AMOY_CONFIG.tokens.USDC,
      AMOY_CONFIG.tokens.WMATIC,
      swapAmount,
      minOut,
      AMOY_CONFIG.routerHub,
      deadline
    ]
  });
  
  // Build intent
  const intent = {
    user: account.address,
    tokenIn: AMOY_CONFIG.tokens.USDC,
    amtIn: swapAmount,
    tokenOut: AMOY_CONFIG.tokens.WMATIC,
    minOut: minOut,
    dstChainId: 80002n,
    deadline: deadline,
    feeToken: AMOY_CONFIG.tokens.USDC,
    feeMode: 1,
    feeCapToken: parseUnits('1', 18),
    routeHint: '0x',
    nonce: BigInt(Date.now())
  };
  
  // Build calls array
  const calls = [
    // Call 1: Approve USDC
    {
      to: AMOY_CONFIG.tokens.USDC,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [AMOY_CONFIG.routerHub, swapAmount]
      }),
      value: 0n
    },
    // Call 2: Execute swap
    {
      to: AMOY_CONFIG.routerHub,
      data: encodeFunctionData({
        abi: ROUTER_HUB_ABI,
        functionName: 'executeRoute',
        args: [intent, AMOY_CONFIG.mockDexAdapter, routeData]
      }),
      value: 0n
    }
  ];
  
  console.log('   Call 1: Approve', formatUnits(swapAmount, 6), 'USDC');
  console.log('   Call 2: Swap USDC → WMATIC');
  
  // Step 7: Send UserOperation
  console.log('\n📋 Step 7: Sending GASLESS UserOperation...');
  
  try {
    const userOpHash = await bundlerClient.sendUserOperation({ calls });
    
    console.log('✅ UserOperation sent!');
    console.log('   Hash:', userOpHash);
    
    // Step 8: Wait for confirmation
    console.log('\n📋 Step 8: Waiting for confirmation...');
    
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });
    
    console.log('✅ Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);
    console.log('   Block:', receipt.receipt.blockNumber);
    console.log('   Success:', receipt.success);
    
    // Step 9: Check final balances
    console.log('\n📋 Step 9: Checking Final Balances...');
    
    const finalNative = await publicClient.getBalance({ address: account.address });
    const finalUsdc = await publicClient.readContract({
      address: AMOY_CONFIG.tokens.USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    const finalWmatic = await publicClient.readContract({
      address: AMOY_CONFIG.tokens.WMATIC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    console.log('   POL:', formatUnits(finalNative, 18));
    console.log('   USDC:', formatUnits(finalUsdc, 6));
    console.log('   WMATIC:', formatUnits(finalWmatic, 18));
    
    // Calculate changes
    const nativeChange = nativeBalance - finalNative;
    const usdcChange = usdcBalance - finalUsdc;
    const wmaticChange = finalWmatic - wmaticBalance;
    
    console.log('\n📊 Changes:');
    console.log('   POL:', formatUnits(nativeChange, 18), '(gas paid by user)');
    console.log('   USDC:', '-' + formatUnits(usdcChange, 6));
    console.log('   WMATIC:', '+' + formatUnits(wmaticChange, 18));
    
    if (nativeChange === 0n) {
      console.log('\n🎉🎉🎉 GASLESS SWAP SUCCESSFUL! 🎉🎉🎉');
      console.log('   User paid $0 in gas fees!');
      console.log('   Swapped', formatUnits(usdcChange, 6), 'USDC for', formatUnits(wmaticChange, 18), 'WMATIC');
    } else {
      console.log('\n⚠️ Swap succeeded but user paid gas');
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    if (error.details) {
      console.log('   Details:', error.details);
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
