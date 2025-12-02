/**
 * Cross-Chain Gasless Swap Test using MockLayerZeroAdapter
 * 
 * Flow:
 * 1. User initiates cross-chain swap on Amoy (gasless via smart account)
 * 2. MockLayerZeroAdapter locks tokens and emits CrossChainSwapInitiated event
 * 3. Relayer (simulated) picks up event and calls receiveMessage on Sepolia
 * 4. Sepolia adapter executes swap and delivers tokens to user
 * 
 * This demonstrates the SushiXSwap-style cross-chain architecture
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseUnits,
  parseEther,
  encodeFunctionData,
  formatUnits,
  formatEther,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const USER_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

const ADAPTERS = {
  amoy: {
    chainId: 80002,
    adapter: '0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50',
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    weth: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlico: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
  },
  sepolia: {
    chainId: 11155111,
    adapter: '0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C',
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    pimlico: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
  }
};

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const BRIDGE_ADAPTER_ABI = [
  {
    name: 'bridgeAndSwap',
    type: 'function',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'dstChainId', type: 'uint256' },
      { name: 'dstToken', type: 'address' },
      { name: 'minDstAmount', type: 'uint256' },
      { name: 'user', type: 'address' },
      { name: 'deadline', type: 'uint64' },
    ],
    outputs: [{ name: 'messageHash', type: 'bytes32' }],
  },
  {
    name: 'receiveMessage',
    type: 'function',
    inputs: [
      {
        name: 'message',
        type: 'tuple',
        components: [
          { name: 'srcChainId', type: 'uint256' },
          { name: 'dstChainId', type: 'uint256' },
          { name: 'user', type: 'address' },
          { name: 'srcToken', type: 'address' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstToken', type: 'address' },
          { name: 'minDstAmount', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  { name: 'getBalance', type: 'function', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

const CROSS_CHAIN_SWAP_INITIATED_EVENT = {
  type: 'event',
  name: 'CrossChainSwapInitiated',
  inputs: [
    { name: 'messageHash', type: 'bytes32', indexed: true },
    { name: 'srcChainId', type: 'uint256', indexed: true },
    { name: 'dstChainId', type: 'uint256', indexed: true },
    { name: 'user', type: 'address', indexed: false },
    { name: 'srcToken', type: 'address', indexed: false },
    { name: 'srcAmount', type: 'uint256', indexed: false },
    { name: 'dstToken', type: 'address', indexed: false },
    { name: 'minDstAmount', type: 'uint256', indexed: false },
    { name: 'deadline', type: 'uint64', indexed: false },
    { name: 'nonce', type: 'uint256', indexed: false },
  ],
};

async function main() {
  console.log('🌉 CROSS-CHAIN GASLESS SWAP TEST\n');
  console.log('Architecture: SushiXSwap-style with MockLayerZeroAdapter\n');
  console.log('=' .repeat(70));
  
  const userAccount = privateKeyToAccount(USER_KEY);
  const relayerAccount = privateKeyToAccount(DEPLOYER_KEY);
  
  console.log('📍 User EOA:', userAccount.address);
  console.log('📍 Relayer:', relayerAccount.address);
  
  // Create clients
  const amoyClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(ADAPTERS.amoy.rpc),
  });
  
  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(ADAPTERS.sepolia.rpc),
  });
  
  const amoyPimlico = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(ADAPTERS.amoy.pimlico),
  });
  
  // Create smart account on Amoy
  const amoySmartAccount = await toSimpleSmartAccount({
    client: amoyClient,
    owner: userAccount,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 User Smart Account:', amoySmartAccount.address);
  
  // Check initial balances
  console.log('\n📊 INITIAL BALANCES:');
  console.log('-'.repeat(50));
  
  const amoyUsdcBefore = await amoyClient.readContract({
    address: ADAPTERS.amoy.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [amoySmartAccount.address],
  });
  console.log('   [Amoy] User USDC:', formatUnits(amoyUsdcBefore, 6));
  
  const sepoliaUsdcBefore = await sepoliaClient.readContract({
    address: ADAPTERS.sepolia.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [amoySmartAccount.address], // Same address on both chains
  });
  console.log('   [Sepolia] User USDC:', formatUnits(sepoliaUsdcBefore, 6));
  
  // Check adapter liquidity
  const sepoliaAdapterUsdc = await sepoliaClient.readContract({
    address: ADAPTERS.sepolia.adapter,
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'getBalance',
    args: [ADAPTERS.sepolia.usdc],
  });
  console.log('   [Sepolia] Adapter USDC:', formatUnits(sepoliaAdapterUsdc, 6));
  
  if (amoyUsdcBefore < parseUnits('0.01', 6)) {
    console.log('\n⚠️ Insufficient USDC on Amoy for cross-chain test');
    return;
  }
  
  // ============================================
  // STEP 1: Initiate cross-chain swap on Amoy (GASLESS)
  // ============================================
  console.log('\n' + '=' .repeat(70));
  console.log('STEP 1: INITIATE CROSS-CHAIN SWAP (Amoy -> Sepolia)');
  console.log('=' .repeat(70));
  
  const smartAccountClient = createSmartAccountClient({
    account: amoySmartAccount,
    chain: polygonAmoy,
    bundlerTransport: http(ADAPTERS.amoy.pimlico),
    paymaster: amoyPimlico,
    userOperation: {
      estimateFeesPerGas: async () => (await amoyPimlico.getUserOperationGasPrice()).fast,
    },
  });
  
  // Approve adapter to spend USDC
  const allowance = await amoyClient.readContract({
    address: ADAPTERS.amoy.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [amoySmartAccount.address, ADAPTERS.amoy.adapter],
  });
  
  if (allowance < parseUnits('100', 6)) {
    console.log('📝 Approving USDC for bridge adapter...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ADAPTERS.amoy.adapter, parseUnits('1000000', 6)],
    });
    
    const approvalTx = await smartAccountClient.sendTransaction({
      to: ADAPTERS.amoy.usdc,
      data: approvalData,
      value: 0n,
    });
    console.log('✅ Approval TX:', approvalTx);
    await amoyClient.waitForTransactionReceipt({ hash: approvalTx });
  }
  
  // Initiate cross-chain swap
  const swapAmount = parseUnits('0.01', 6); // 0.01 USDC
  const minDstAmount = parseUnits('0.009', 6); // 10% slippage
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  console.log('\n📋 Cross-Chain Swap Details:');
  console.log('   Source: Amoy (Chain ID:', ADAPTERS.amoy.chainId, ')');
  console.log('   Destination: Sepolia (Chain ID:', ADAPTERS.sepolia.chainId, ')');
  console.log('   Token In: USDC (Amoy)');
  console.log('   Token Out: USDC (Sepolia)');
  console.log('   Amount:', formatUnits(swapAmount, 6), 'USDC');
  console.log('   Min Output:', formatUnits(minDstAmount, 6), 'USDC');
  
  const bridgeData = encodeFunctionData({
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'bridgeAndSwap',
    args: [
      ADAPTERS.amoy.usdc,
      swapAmount,
      BigInt(ADAPTERS.sepolia.chainId),
      ADAPTERS.sepolia.usdc,
      minDstAmount,
      amoySmartAccount.address,
      deadline,
    ],
  });
  
  console.log('\n🔄 Initiating cross-chain swap (gasless)...');
  
  let messageHash;
  let nonce;
  
  try {
    const bridgeTx = await smartAccountClient.sendTransaction({
      to: ADAPTERS.amoy.adapter,
      data: bridgeData,
      value: 0n,
    });
    
    console.log('✅ Bridge TX:', bridgeTx);
    console.log('   🔗 https://amoy.polygonscan.com/tx/' + bridgeTx);
    
    const receipt = await amoyClient.waitForTransactionReceipt({ hash: bridgeTx });
    console.log('✅ Transaction confirmed on Amoy!');
    
    // Parse event to get message details
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [CROSS_CHAIN_SWAP_INITIATED_EVENT],
          data: log.data,
          topics: log.topics,
        });
        
        if (decoded.eventName === 'CrossChainSwapInitiated') {
          messageHash = decoded.args.messageHash;
          nonce = decoded.args.nonce;
          console.log('\n📋 Cross-Chain Message:');
          console.log('   Message Hash:', messageHash);
          console.log('   Nonce:', nonce.toString());
        }
      } catch (e) {
        // Not our event
      }
    }
    
  } catch (error) {
    console.error('❌ Bridge initiation failed:', error.message);
    return;
  }
  
  // ============================================
  // STEP 2: Relayer executes on destination (Sepolia)
  // ============================================
  console.log('\n' + '=' .repeat(70));
  console.log('STEP 2: RELAYER EXECUTES ON DESTINATION (Sepolia)');
  console.log('=' .repeat(70));
  console.log('(In production, this is done by off-chain relayer monitoring events)');
  
  const sepoliaWalletClient = createWalletClient({
    account: relayerAccount,
    chain: sepolia,
    transport: http(ADAPTERS.sepolia.rpc),
  });
  
  // Construct message for destination
  const crossChainMessage = {
    srcChainId: BigInt(ADAPTERS.amoy.chainId),
    dstChainId: BigInt(ADAPTERS.sepolia.chainId),
    user: amoySmartAccount.address,
    srcToken: ADAPTERS.amoy.usdc,
    srcAmount: swapAmount,
    dstToken: ADAPTERS.sepolia.usdc,
    minDstAmount: minDstAmount,
    deadline: deadline,
    nonce: nonce || BigInt(Date.now()),
  };
  
  console.log('\n📋 Relaying message to Sepolia...');
  
  const receiveData = encodeFunctionData({
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'receiveMessage',
    args: [crossChainMessage, '0x'], // Empty signature for testnet
  });
  
  try {
    const receiveTx = await sepoliaWalletClient.sendTransaction({
      to: ADAPTERS.sepolia.adapter,
      data: receiveData,
    });
    
    console.log('✅ Receive TX:', receiveTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + receiveTx);
    
    await sepoliaClient.waitForTransactionReceipt({ hash: receiveTx });
    console.log('✅ Cross-chain swap executed on Sepolia!');
    
  } catch (error) {
    console.error('❌ Destination execution failed:', error.message);
  }
  
  // ============================================
  // FINAL BALANCES
  // ============================================
  console.log('\n' + '=' .repeat(70));
  console.log('📊 FINAL BALANCES');
  console.log('=' .repeat(70));
  
  const amoyUsdcAfter = await amoyClient.readContract({
    address: ADAPTERS.amoy.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [amoySmartAccount.address],
  });
  
  const sepoliaUsdcAfter = await sepoliaClient.readContract({
    address: ADAPTERS.sepolia.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [amoySmartAccount.address],
  });
  
  console.log('\n[Amoy]');
  console.log('   USDC:', formatUnits(amoyUsdcBefore, 6), '->', formatUnits(amoyUsdcAfter, 6));
  console.log('   Change:', formatUnits(amoyUsdcAfter - amoyUsdcBefore, 6));
  
  console.log('\n[Sepolia]');
  console.log('   USDC:', formatUnits(sepoliaUsdcBefore, 6), '->', formatUnits(sepoliaUsdcAfter, 6));
  console.log('   Change:', formatUnits(sepoliaUsdcAfter - sepoliaUsdcBefore, 6));
  
  if (sepoliaUsdcAfter > sepoliaUsdcBefore) {
    console.log('\n🎉 CROSS-CHAIN GASLESS SWAP SUCCESSFUL!');
    console.log('   User received', formatUnits(sepoliaUsdcAfter - sepoliaUsdcBefore, 6), 'USDC on Sepolia');
    console.log('   User paid 0 gas on source chain (gasless via smart account)');
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('📋 ARCHITECTURE SUMMARY');
  console.log('=' .repeat(70));
  console.log('✅ Source chain: Gasless swap initiation via ERC-4337 smart account');
  console.log('✅ Bridge: MockLayerZeroAdapter (SushiXSwap-style)');
  console.log('✅ Destination chain: Relayer executes swap');
  console.log('✅ User receives tokens on destination chain');
  console.log('\n📝 For production:');
  console.log('   - Replace MockLayerZeroAdapter with real LayerZero OApp');
  console.log('   - Deploy automated relayer service');
  console.log('   - Add signature verification for security');
}

main().catch(console.error);
