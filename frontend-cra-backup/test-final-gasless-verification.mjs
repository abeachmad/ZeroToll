/**
 * FINAL GASLESS VERIFICATION TEST
 * 
 * This is the definitive test that proves TRUE gasless works.
 * Run this to verify the implementation.
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
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
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         FINAL EIP-7702 GASLESS VERIFICATION TEST                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 Wallet:', account.address);
  console.log('🔗 Chain: Polygon Amoy (80002)');
  
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
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Verify Smart Account
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 1: Verify Smart Account                                    │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  const code = await publicClient.getCode({ address: account.address });
  
  if (!code || !code.startsWith('0xef0100')) {
    console.log('❌ FAILED: Wallet is not a Smart Account');
    return;
  }
  
  const delegator = '0x' + code.substring(8, 48);
  console.log('✅ Smart Account ENABLED');
  console.log('   Delegator:', delegator);
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Record Initial Balances
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 2: Record Initial Balances                                 │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  const initialPol = await publicClient.getBalance({ address: account.address });
  const initialUsdc = await publicClient.readContract({
    address: AMOY_CONFIG.tokens.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address]
  });
  const initialWmatic = await publicClient.readContract({
    address: AMOY_CONFIG.tokens.WMATIC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address]
  });
  
  console.log('   POL:    ', formatUnits(initialPol, 18));
  console.log('   USDC:   ', formatUnits(initialUsdc, 6));
  console.log('   WMATIC: ', formatUnits(initialWmatic, 18));
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Create Gasless Infrastructure
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 3: Create Gasless Infrastructure                           │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: 'Stateless7702',
    address: account.address,
    signer: { walletClient }
  });
  console.log('✅ MetaMask Smart Account created');
  
  const pimlicoClient = createPimlicoClient({
    chain: AMOY_CONFIG.chain,
    transport: http(AMOY_CONFIG.pimlicoRpc),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });
  console.log('✅ Pimlico Paymaster client created');
  
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
  console.log('✅ Bundler client with paymaster created');
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Build Swap Transaction
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 4: Build Swap Transaction                                  │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  const swapAmount = parseUnits('0.1', 6); // 0.1 USDC
  const minOut = parseUnits('0.01', 18);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  console.log('   Swap: 0.1 USDC → WMATIC');
  console.log('   Min Output: 0.01 WMATIC');
  
  // Build routeData
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
  
  // Build calls
  const calls = [
    {
      to: AMOY_CONFIG.tokens.USDC,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [AMOY_CONFIG.routerHub, swapAmount]
      }),
      value: 0n
    },
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
  
  console.log('✅ Transaction calls built (approve + swap)');
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Execute GASLESS Transaction
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 5: Execute GASLESS Transaction                             │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  console.log('   Sending UserOperation...');
  
  const userOpHash = await bundlerClient.sendUserOperation({ calls });
  console.log('✅ UserOperation sent!');
  console.log('   Hash:', userOpHash);
  
  console.log('   Waiting for confirmation...');
  
  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 120000
  });
  
  console.log('✅ Transaction confirmed!');
  console.log('   TX Hash:', receipt.receipt.transactionHash);
  console.log('   Block:', receipt.receipt.blockNumber.toString());
  console.log('   Success:', receipt.success);
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: Verify Final Balances
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 6: Verify Final Balances                                   │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  const finalPol = await publicClient.getBalance({ address: account.address });
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
  
  console.log('   POL:    ', formatUnits(finalPol, 18));
  console.log('   USDC:   ', formatUnits(finalUsdc, 6));
  console.log('   WMATIC: ', formatUnits(finalWmatic, 18));
  
  // Calculate changes
  const polChange = initialPol - finalPol;
  const usdcChange = initialUsdc - finalUsdc;
  const wmaticChange = finalWmatic - initialWmatic;
  
  console.log('\n   Changes:');
  console.log('   POL:    ', polChange === 0n ? '0 (NO GAS PAID!)' : formatUnits(polChange, 18));
  console.log('   USDC:   ', '-' + formatUnits(usdcChange, 6));
  console.log('   WMATIC: ', '+' + formatUnits(wmaticChange, 18));
  
  // ═══════════════════════════════════════════════════════════════════
  // FINAL RESULT
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  
  if (polChange === 0n && receipt.success) {
    console.log('║                                                                  ║');
    console.log('║   🎉🎉🎉 TRUE GASLESS TRANSACTION SUCCESSFUL! 🎉🎉🎉            ║');
    console.log('║                                                                  ║');
    console.log('║   ✅ User paid $0 in gas fees                                   ║');
    console.log('║   ✅ Swap executed successfully                                 ║');
    console.log('║   ✅ EIP-7702 gasless is WORKING!                               ║');
    console.log('║                                                                  ║');
  } else if (receipt.success) {
    console.log('║   ⚠️ Swap succeeded but user paid gas                           ║');
    console.log('║   Gas paid:', formatUnits(polChange, 18), 'POL');
  } else {
    console.log('║   ❌ Transaction failed                                         ║');
  }
  
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch(console.error);
