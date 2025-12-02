/**
 * Complete Gasless Swap Test Suite
 * Tests both same-chain and cross-chain gasless swaps
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
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

const CONTRACTS = {
  amoy: {
    chainId: 80002,
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
    mockDexAdapter: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1',
    bridgeAdapter: '0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    link: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlico: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
  },
  sepolia: {
    chainId: 11155111,
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
    bridgeAdapter: '0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C',
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

const ROUTER_HUB_ABI = [
  {
    name: 'executeRoute',
    type: 'function',
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
          { name: 'nonce', type: 'uint256' },
        ],
      },
      { name: 'adapter', type: 'address' },
      { name: 'routeData', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
];

const DEX_ADAPTER_ABI = [
  {
    name: 'swap',
    type: 'function',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getQuote',
    type: 'function',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'path', type: 'address[]' }],
    stateMutability: 'view',
  },
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

const CROSS_CHAIN_EVENT = {
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

// ============================================
// TEST 1: Same-Chain Gasless Swap (Sepolia)
// ============================================
async function testSameChainSepolia() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: SAME-CHAIN GASLESS SWAP (Sepolia USDC -> WETH)');
  console.log('='.repeat(70));
  
  const account = privateKeyToAccount(USER_KEY);
  const client = createPublicClient({ chain: sepolia, transport: http(CONTRACTS.sepolia.rpc) });
  const pimlicoClient = createPimlicoClient({ chain: sepolia, transport: http(CONTRACTS.sepolia.pimlico) });
  
  const smartAccount = await toSimpleSmartAccount({
    client, owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Smart Account:', smartAccount.address);
  
  const usdcBefore = await client.readContract({ address: CONTRACTS.sepolia.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
  const wethBefore = await client.readContract({ address: CONTRACTS.sepolia.weth, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
  
  console.log('📊 Before: USDC:', formatUnits(usdcBefore, 6), '| WETH:', formatUnits(wethBefore, 18));
  
  if (usdcBefore < parseUnits('0.05', 6)) {
    console.log('⚠️ Insufficient USDC for test');
    return { success: false, reason: 'Insufficient USDC' };
  }
  
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount, chain: sepolia,
    bundlerTransport: http(CONTRACTS.sepolia.pimlico),
    paymaster: pimlicoClient,
    userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
  });
  
  // Check/set approval
  const allowance = await client.readContract({ address: CONTRACTS.sepolia.usdc, abi: ERC20_ABI, functionName: 'allowance', args: [smartAccount.address, CONTRACTS.sepolia.routerHub] });
  if (allowance < parseUnits('100', 6)) {
    console.log('📝 Approving USDC...');
    const tx = await smartAccountClient.sendTransaction({ to: CONTRACTS.sepolia.usdc, data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.sepolia.routerHub, parseUnits('1000000', 6)] }), value: 0n });
    await client.waitForTransactionReceipt({ hash: tx });
  }
  
  const swapAmount = parseUnits('0.05', 6);
  const [expectedOut] = await client.readContract({ address: CONTRACTS.sepolia.mockDexAdapter, abi: DEX_ADAPTER_ABI, functionName: 'getQuote', args: [CONTRACTS.sepolia.usdc, CONTRACTS.sepolia.weth, swapAmount] });
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  console.log('📋 Swap: 0.05 USDC -> ~', formatUnits(expectedOut, 18), 'WETH');

  const intent = {
    user: smartAccount.address, tokenIn: CONTRACTS.sepolia.usdc, amtIn: swapAmount,
    tokenOut: CONTRACTS.sepolia.weth, minOut, dstChainId: 0n, deadline: Number(deadline),
    feeToken: CONTRACTS.sepolia.usdc, feeMode: 0, feeCapToken: 0n, routeHint: '0x', nonce: BigInt(Date.now()),
  };
  
  const routeData = encodeFunctionData({ abi: DEX_ADAPTER_ABI, functionName: 'swap', args: [CONTRACTS.sepolia.usdc, CONTRACTS.sepolia.weth, swapAmount, minOut, CONTRACTS.sepolia.routerHub, deadline] });
  const swapData = encodeFunctionData({ abi: ROUTER_HUB_ABI, functionName: 'executeRoute', args: [intent, CONTRACTS.sepolia.mockDexAdapter, routeData] });
  
  console.log('🔄 Executing gasless swap...');
  try {
    const tx = await smartAccountClient.sendTransaction({ to: CONTRACTS.sepolia.routerHub, data: swapData, value: 0n });
    console.log('✅ TX:', tx);
    await client.waitForTransactionReceipt({ hash: tx });
    
    const wethAfter = await client.readContract({ address: CONTRACTS.sepolia.weth, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
    console.log('📊 After: WETH:', formatUnits(wethAfter, 18), '| Received:', formatUnits(wethAfter - wethBefore, 18));
    console.log('🎉 SAME-CHAIN SEPOLIA: SUCCESS');
    return { success: true, wethReceived: wethAfter - wethBefore };
  } catch (e) {
    console.error('❌ Failed:', e.message);
    return { success: false, reason: e.message };
  }
}

// ============================================
// TEST 2: Same-Chain Gasless Swap (Amoy)
// ============================================
async function testSameChainAmoy() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: SAME-CHAIN GASLESS SWAP (Amoy USDC -> LINK)');
  console.log('='.repeat(70));
  
  const account = privateKeyToAccount(USER_KEY);
  const client = createPublicClient({ chain: polygonAmoy, transport: http(CONTRACTS.amoy.rpc) });
  const pimlicoClient = createPimlicoClient({ chain: polygonAmoy, transport: http(CONTRACTS.amoy.pimlico) });
  
  const smartAccount = await toSimpleSmartAccount({
    client, owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Smart Account:', smartAccount.address);
  
  const usdcBefore = await client.readContract({ address: CONTRACTS.amoy.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
  const linkBefore = await client.readContract({ address: CONTRACTS.amoy.link, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
  
  console.log('📊 Before: USDC:', formatUnits(usdcBefore, 6), '| LINK:', formatUnits(linkBefore, 18));
  
  if (usdcBefore < parseUnits('0.005', 6)) {
    console.log('⚠️ Insufficient USDC for test');
    return { success: false, reason: 'Insufficient USDC' };
  }

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount, chain: polygonAmoy,
    bundlerTransport: http(CONTRACTS.amoy.pimlico),
    paymaster: pimlicoClient,
    userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
  });
  
  // Check/set approval
  const allowance = await client.readContract({ address: CONTRACTS.amoy.usdc, abi: ERC20_ABI, functionName: 'allowance', args: [smartAccount.address, CONTRACTS.amoy.routerHub] });
  if (allowance < parseUnits('100', 6)) {
    console.log('📝 Approving USDC...');
    const tx = await smartAccountClient.sendTransaction({ to: CONTRACTS.amoy.usdc, data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.amoy.routerHub, parseUnits('1000000', 6)] }), value: 0n });
    await client.waitForTransactionReceipt({ hash: tx });
  }
  
  const swapAmount = parseUnits('0.005', 6);
  const [expectedOut] = await client.readContract({ address: CONTRACTS.amoy.mockDexAdapter, abi: DEX_ADAPTER_ABI, functionName: 'getQuote', args: [CONTRACTS.amoy.usdc, CONTRACTS.amoy.link, swapAmount] });
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  console.log('📋 Swap: 0.005 USDC -> ~', formatUnits(expectedOut, 18), 'LINK');
  
  const intent = {
    user: smartAccount.address, tokenIn: CONTRACTS.amoy.usdc, amtIn: swapAmount,
    tokenOut: CONTRACTS.amoy.link, minOut, dstChainId: 0n, deadline: Number(deadline),
    feeToken: CONTRACTS.amoy.usdc, feeMode: 0, feeCapToken: 0n, routeHint: '0x', nonce: BigInt(Date.now()),
  };
  
  const routeData = encodeFunctionData({ abi: DEX_ADAPTER_ABI, functionName: 'swap', args: [CONTRACTS.amoy.usdc, CONTRACTS.amoy.link, swapAmount, minOut, CONTRACTS.amoy.routerHub, deadline] });
  const swapData = encodeFunctionData({ abi: ROUTER_HUB_ABI, functionName: 'executeRoute', args: [intent, CONTRACTS.amoy.mockDexAdapter, routeData] });
  
  console.log('🔄 Executing gasless swap...');
  try {
    const tx = await smartAccountClient.sendTransaction({ to: CONTRACTS.amoy.routerHub, data: swapData, value: 0n });
    console.log('✅ TX:', tx);
    await client.waitForTransactionReceipt({ hash: tx });
    
    const linkAfter = await client.readContract({ address: CONTRACTS.amoy.link, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
    console.log('📊 After: LINK:', formatUnits(linkAfter, 18), '| Received:', formatUnits(linkAfter - linkBefore, 18));
    console.log('🎉 SAME-CHAIN AMOY: SUCCESS');
    return { success: true, linkReceived: linkAfter - linkBefore };
  } catch (e) {
    console.error('❌ Failed:', e.message);
    return { success: false, reason: e.message };
  }
}

// ============================================
// TEST 3: Cross-Chain Gasless Swap (Amoy -> Sepolia)
// ============================================
async function testCrossChain() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 3: CROSS-CHAIN GASLESS SWAP (Amoy USDC -> Sepolia USDC)');
  console.log('='.repeat(70));
  
  const userAccount = privateKeyToAccount(USER_KEY);
  const relayerAccount = privateKeyToAccount(DEPLOYER_KEY);
  
  const amoyClient = createPublicClient({ chain: polygonAmoy, transport: http(CONTRACTS.amoy.rpc) });
  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(CONTRACTS.sepolia.rpc) });
  const amoyPimlico = createPimlicoClient({ chain: polygonAmoy, transport: http(CONTRACTS.amoy.pimlico) });
  
  const smartAccount = await toSimpleSmartAccount({
    client: amoyClient, owner: userAccount,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Smart Account:', smartAccount.address);
  
  const amoyUsdcBefore = await amoyClient.readContract({ address: CONTRACTS.amoy.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
  const sepoliaUsdcBefore = await sepoliaClient.readContract({ address: CONTRACTS.sepolia.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
  const adapterBalance = await sepoliaClient.readContract({ address: CONTRACTS.sepolia.bridgeAdapter, abi: BRIDGE_ADAPTER_ABI, functionName: 'getBalance', args: [CONTRACTS.sepolia.usdc] });
  
  console.log('📊 Before: [Amoy] USDC:', formatUnits(amoyUsdcBefore, 6), '| [Sepolia] USDC:', formatUnits(sepoliaUsdcBefore, 6));
  console.log('📊 Sepolia Adapter USDC:', formatUnits(adapterBalance, 6));
  
  if (amoyUsdcBefore < parseUnits('0.005', 6)) {
    console.log('⚠️ Insufficient USDC on Amoy');
    return { success: false, reason: 'Insufficient USDC' };
  }
  
  if (adapterBalance < parseUnits('0.005', 6)) {
    console.log('⚠️ Insufficient liquidity in Sepolia adapter');
    return { success: false, reason: 'Insufficient adapter liquidity' };
  }
  
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount, chain: polygonAmoy,
    bundlerTransport: http(CONTRACTS.amoy.pimlico),
    paymaster: amoyPimlico,
    userOperation: { estimateFeesPerGas: async () => (await amoyPimlico.getUserOperationGasPrice()).fast },
  });

  // Check/set approval for bridge adapter
  const allowance = await amoyClient.readContract({ address: CONTRACTS.amoy.usdc, abi: ERC20_ABI, functionName: 'allowance', args: [smartAccount.address, CONTRACTS.amoy.bridgeAdapter] });
  if (allowance < parseUnits('100', 6)) {
    console.log('📝 Approving USDC for bridge adapter...');
    const tx = await smartAccountClient.sendTransaction({ to: CONTRACTS.amoy.usdc, data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.amoy.bridgeAdapter, parseUnits('1000000', 6)] }), value: 0n });
    await amoyClient.waitForTransactionReceipt({ hash: tx });
  }
  
  const swapAmount = parseUnits('0.005', 6);
  const minDstAmount = parseUnits('0.0045', 6);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  console.log('📋 Cross-Chain: 0.005 USDC (Amoy) -> USDC (Sepolia)');
  
  // STEP 1: Initiate on source chain (gasless)
  console.log('\n🔄 Step 1: Initiating cross-chain swap on Amoy (gasless)...');
  
  const bridgeData = encodeFunctionData({
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'bridgeAndSwap',
    args: [CONTRACTS.amoy.usdc, swapAmount, BigInt(CONTRACTS.sepolia.chainId), CONTRACTS.sepolia.usdc, minDstAmount, smartAccount.address, deadline],
  });
  
  let nonce;
  try {
    const bridgeTx = await smartAccountClient.sendTransaction({ to: CONTRACTS.amoy.bridgeAdapter, data: bridgeData, value: 0n });
    console.log('✅ Bridge TX:', bridgeTx);
    const receipt = await amoyClient.waitForTransactionReceipt({ hash: bridgeTx });
    
    // Parse event
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: [CROSS_CHAIN_EVENT], data: log.data, topics: log.topics });
        if (decoded.eventName === 'CrossChainSwapInitiated') {
          nonce = decoded.args.nonce;
          console.log('📋 Message nonce:', nonce.toString().slice(0, 20) + '...');
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('❌ Bridge initiation failed:', e.message);
    return { success: false, reason: e.message };
  }

  // STEP 2: Relayer executes on destination
  console.log('\n🔄 Step 2: Relayer executing on Sepolia...');
  
  const sepoliaWallet = createWalletClient({ account: relayerAccount, chain: sepolia, transport: http(CONTRACTS.sepolia.rpc) });
  
  const message = {
    srcChainId: BigInt(CONTRACTS.amoy.chainId),
    dstChainId: BigInt(CONTRACTS.sepolia.chainId),
    user: smartAccount.address,
    srcToken: CONTRACTS.amoy.usdc,
    srcAmount: swapAmount,
    dstToken: CONTRACTS.sepolia.usdc,
    minDstAmount: minDstAmount,
    deadline: deadline,
    nonce: nonce || BigInt(Date.now()),
  };
  
  const receiveData = encodeFunctionData({ abi: BRIDGE_ADAPTER_ABI, functionName: 'receiveMessage', args: [message, '0x'] });
  
  try {
    const receiveTx = await sepoliaWallet.sendTransaction({ to: CONTRACTS.sepolia.bridgeAdapter, data: receiveData });
    console.log('✅ Receive TX:', receiveTx);
    await sepoliaClient.waitForTransactionReceipt({ hash: receiveTx });
    
    const sepoliaUsdcAfter = await sepoliaClient.readContract({ address: CONTRACTS.sepolia.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [smartAccount.address] });
    console.log('📊 After: [Sepolia] USDC:', formatUnits(sepoliaUsdcAfter, 6), '| Received:', formatUnits(sepoliaUsdcAfter - sepoliaUsdcBefore, 6));
    console.log('🎉 CROSS-CHAIN: SUCCESS');
    return { success: true, usdcReceived: sepoliaUsdcAfter - sepoliaUsdcBefore };
  } catch (e) {
    console.error('❌ Destination execution failed:', e.message);
    return { success: false, reason: e.message };
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('🌉 COMPLETE GASLESS SWAP TEST SUITE\n');
  console.log('Testing: Same-chain (Sepolia, Amoy) + Cross-chain (Amoy -> Sepolia)\n');
  console.log('='.repeat(70));
  
  const results = {};
  
  // Test 1: Same-chain Sepolia
  results.sameChainSepolia = await testSameChainSepolia();
  
  // Test 2: Same-chain Amoy
  results.sameChainAmoy = await testSameChainAmoy();
  
  // Test 3: Cross-chain
  results.crossChain = await testCrossChain();
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log('Same-Chain Sepolia (USDC->WETH):', results.sameChainSepolia.success ? '✅ PASS' : '❌ FAIL');
  console.log('Same-Chain Amoy (USDC->LINK):', results.sameChainAmoy.success ? '✅ PASS' : '❌ FAIL');
  console.log('Cross-Chain (Amoy->Sepolia):', results.crossChain.success ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = results.sameChainSepolia.success && results.sameChainAmoy.success && results.crossChain.success;
  console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ Some tests failed'));
}

main().catch(console.error);
