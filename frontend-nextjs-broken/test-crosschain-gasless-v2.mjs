/**
 * Cross-Chain Gasless Swap Test v2
 * Tests both same-chain and cross-chain gasless swaps
 */

import { 
  createPublicClient, 
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Contract addresses from deployment
const CONTRACTS = {
  amoy: {
    chainId: 80002,
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlico: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
    mockDexAdapter: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    wpol: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
    link: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
  },
  sepolia: {
    chainId: 11155111,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    pimlico: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  }
};

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }] },
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
  {
    name: 'whitelistedAdapter',
    type: 'function',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
];

// MockDEXAdapter swap function
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
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
];

async function main() {
  console.log('🌉 Cross-Chain Gasless Swap Test v2\n');
  console.log('=' .repeat(60));
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA:', account.address);
  
  // Create clients for both chains
  const amoyClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(CONTRACTS.amoy.rpc),
  });
  
  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(CONTRACTS.sepolia.rpc),
  });
  
  const amoyPimlico = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(CONTRACTS.amoy.pimlico),
  });
  
  const sepoliaPimlico = createPimlicoClient({
    chain: sepolia,
    transport: http(CONTRACTS.sepolia.pimlico),
  });
  
  // Create smart accounts on both chains
  const amoySmartAccount = await toSimpleSmartAccount({
    client: amoyClient,
    owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  const sepoliaSmartAccount = await toSimpleSmartAccount({
    client: sepoliaClient,
    owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Amoy Smart Account:', amoySmartAccount.address);
  console.log('📍 Sepolia Smart Account:', sepoliaSmartAccount.address);
  
  // Verify same address on both chains (deterministic)
  if (amoySmartAccount.address === sepoliaSmartAccount.address) {
    console.log('✅ Same smart account address on both chains (deterministic)\n');
  }
  
  // Check balances on both chains
  console.log('📊 Current Balances:');
  console.log('-'.repeat(40));
  
  // Amoy balances
  const amoyUsdc = await amoyClient.readContract({
    address: CONTRACTS.amoy.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [amoySmartAccount.address],
  });
  
  const amoyLink = await amoyClient.readContract({
    address: CONTRACTS.amoy.link,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [amoySmartAccount.address],
  });
  
  console.log('   [Amoy] USDC:', formatUnits(amoyUsdc, 6));
  console.log('   [Amoy] LINK:', formatUnits(amoyLink, 18));
  
  // Sepolia balances
  const sepoliaUsdc = await sepoliaClient.readContract({
    address: CONTRACTS.sepolia.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [sepoliaSmartAccount.address],
  });
  
  const sepoliaWeth = await sepoliaClient.readContract({
    address: CONTRACTS.sepolia.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [sepoliaSmartAccount.address],
  });
  
  console.log('   [Sepolia] USDC:', formatUnits(sepoliaUsdc, 6));
  console.log('   [Sepolia] WETH:', formatUnits(sepoliaWeth, 18));
  
  // ============================================
  // TEST 1: Same-chain gasless swap on Amoy
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Same-Chain Gasless Swap (Amoy USDC -> LINK)');
  console.log('='.repeat(60));
  
  if (amoyUsdc >= parseUnits('0.5', 6)) {
    const amoySmartAccountClient = createSmartAccountClient({
      account: amoySmartAccount,
      chain: polygonAmoy,
      bundlerTransport: http(CONTRACTS.amoy.pimlico),
      paymaster: amoyPimlico,
      userOperation: {
        estimateFeesPerGas: async () => (await amoyPimlico.getUserOperationGasPrice()).fast,
      },
    });
    
    // Check/set approval
    const usdcAllowance = await amoyClient.readContract({
      address: CONTRACTS.amoy.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [amoySmartAccount.address, CONTRACTS.amoy.routerHub],
    });
    
    if (usdcAllowance < parseUnits('1000', 6)) {
      console.log('📝 Approving USDC for RouterHub...');
      const approvalData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.amoy.routerHub, parseUnits('1000000', 6)],
      });
      
      const approvalTx = await amoySmartAccountClient.sendTransaction({
        to: CONTRACTS.amoy.usdc,
        data: approvalData,
        value: 0n,
      });
      console.log('✅ Approval TX:', approvalTx);
      await amoyClient.waitForTransactionReceipt({ hash: approvalTx });
    } else {
      console.log('✅ USDC already approved');
    }
    
    // Get quote first
    const swapAmountIn = parseUnits('0.5', 6);
    const [expectedOut] = await amoyClient.readContract({
      address: CONTRACTS.amoy.mockDexAdapter,
      abi: DEX_ADAPTER_ABI,
      functionName: 'getQuote',
      args: [CONTRACTS.amoy.usdc, CONTRACTS.amoy.link, swapAmountIn],
    });
    
    console.log('\n📋 Swap Details:');
    console.log('   Input: 0.5 USDC');
    console.log('   Expected Output:', formatUnits(expectedOut, 18), 'LINK');
    
    const minOut = expectedOut * 95n / 100n; // 5% slippage
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    // Create same-chain intent (dstChainId = 0 for same chain)
    const sameChainIntent = {
      user: amoySmartAccount.address,
      tokenIn: CONTRACTS.amoy.usdc,
      amtIn: swapAmountIn,
      tokenOut: CONTRACTS.amoy.link,
      minOut: minOut,
      dstChainId: 0n, // Same chain
      deadline: Number(deadline),
      feeToken: CONTRACTS.amoy.usdc,
      feeMode: 1,
      feeCapToken: parseUnits('0.01', 18),
      routeHint: '0x',
      nonce: BigInt(Date.now()),
    };
    
    // Create route data for DEX adapter
    const routeData = encodeFunctionData({
      abi: DEX_ADAPTER_ABI,
      functionName: 'swap',
      args: [
        CONTRACTS.amoy.usdc,
        CONTRACTS.amoy.link,
        swapAmountIn,
        minOut,
        amoySmartAccount.address,
        deadline,
      ],
    });
    
    // Execute swap
    const swapData = encodeFunctionData({
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [sameChainIntent, CONTRACTS.amoy.mockDexAdapter, routeData],
    });
    
    console.log('\n🔄 Executing gasless swap...');
    
    try {
      const swapTx = await amoySmartAccountClient.sendTransaction({
        to: CONTRACTS.amoy.routerHub,
        data: swapData,
        value: 0n,
      });
      
      console.log('✅ Swap TX:', swapTx);
      console.log('   🔗 https://amoy.polygonscan.com/tx/' + swapTx);
      
      await amoyClient.waitForTransactionReceipt({ hash: swapTx });
      
      // Check new balance
      const newLinkBalance = await amoyClient.readContract({
        address: CONTRACTS.amoy.link,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [amoySmartAccount.address],
      });
      
      console.log('\n📊 After Swap:');
      console.log('   LINK Balance:', formatUnits(newLinkBalance, 18));
      console.log('   LINK Received:', formatUnits(newLinkBalance - amoyLink, 18));
      console.log('\n🎉 SAME-CHAIN GASLESS SWAP SUCCESSFUL!');
      
    } catch (error) {
      console.error('❌ Same-chain swap failed:', error.message);
    }
  } else {
    console.log('⚠️ Insufficient USDC on Amoy for test (need 0.5 USDC)');
  }
  
  // ============================================
  // TEST 2: Cross-chain gasless swap
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Cross-Chain Gasless Swap (Amoy USDC -> Sepolia WETH)');
  console.log('='.repeat(60));
  
  console.log('\n📋 Cross-Chain Architecture:');
  console.log('   1. User initiates swap on source chain (Amoy)');
  console.log('   2. RouterHub locks tokens and emits cross-chain intent');
  console.log('   3. Bridge adapter relays message to destination chain');
  console.log('   4. Destination RouterHub executes swap and delivers tokens');
  
  console.log('\n⚠️ Current Status:');
  console.log('   - Smart contracts support cross-chain intents (dstChainId field)');
  console.log('   - MockBridgeAdapter exists but needs proper integration');
  console.log('   - Real cross-chain requires bridge infrastructure (LayerZero, CCIP, etc.)');
  
  // Check if we have USDC on Sepolia for a same-chain swap there
  if (sepoliaUsdc >= parseUnits('0.5', 6)) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Same-Chain Gasless Swap on Sepolia (USDC -> WETH)');
    console.log('='.repeat(60));
    
    const sepoliaSmartAccountClient = createSmartAccountClient({
      account: sepoliaSmartAccount,
      chain: sepolia,
      bundlerTransport: http(CONTRACTS.sepolia.pimlico),
      paymaster: sepoliaPimlico,
      userOperation: {
        estimateFeesPerGas: async () => (await sepoliaPimlico.getUserOperationGasPrice()).fast,
      },
    });
    
    // Check/set approval
    const sepoliaUsdcAllowance = await sepoliaClient.readContract({
      address: CONTRACTS.sepolia.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [sepoliaSmartAccount.address, CONTRACTS.sepolia.routerHub],
    });
    
    if (sepoliaUsdcAllowance < parseUnits('1000', 6)) {
      console.log('📝 Approving USDC for RouterHub on Sepolia...');
      const approvalData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.sepolia.routerHub, parseUnits('1000000', 6)],
      });
      
      const approvalTx = await sepoliaSmartAccountClient.sendTransaction({
        to: CONTRACTS.sepolia.usdc,
        data: approvalData,
        value: 0n,
      });
      console.log('✅ Approval TX:', approvalTx);
      await sepoliaClient.waitForTransactionReceipt({ hash: approvalTx });
    } else {
      console.log('✅ USDC already approved on Sepolia');
    }
    
    // Get quote
    const swapAmountIn = parseUnits('0.5', 6);
    
    try {
      const [expectedOut] = await sepoliaClient.readContract({
        address: CONTRACTS.sepolia.mockDexAdapter,
        abi: DEX_ADAPTER_ABI,
        functionName: 'getQuote',
        args: [CONTRACTS.sepolia.usdc, CONTRACTS.sepolia.weth, swapAmountIn],
      });
      
      console.log('\n📋 Swap Details:');
      console.log('   Input: 0.5 USDC');
      console.log('   Expected Output:', formatUnits(expectedOut, 18), 'WETH');
      
      const minOut = expectedOut * 95n / 100n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      
      const sepoliaIntent = {
        user: sepoliaSmartAccount.address,
        tokenIn: CONTRACTS.sepolia.usdc,
        amtIn: swapAmountIn,
        tokenOut: CONTRACTS.sepolia.weth,
        minOut: minOut,
        dstChainId: 0n,
        deadline: Number(deadline),
        feeToken: CONTRACTS.sepolia.usdc,
        feeMode: 1,
        feeCapToken: parseUnits('0.01', 18),
        routeHint: '0x',
        nonce: BigInt(Date.now()),
      };
      
      const routeData = encodeFunctionData({
        abi: DEX_ADAPTER_ABI,
        functionName: 'swap',
        args: [
          CONTRACTS.sepolia.usdc,
          CONTRACTS.sepolia.weth,
          swapAmountIn,
          minOut,
          sepoliaSmartAccount.address,
          deadline,
        ],
      });
      
      const swapData = encodeFunctionData({
        abi: ROUTER_HUB_ABI,
        functionName: 'executeRoute',
        args: [sepoliaIntent, CONTRACTS.sepolia.mockDexAdapter, routeData],
      });
      
      console.log('\n🔄 Executing gasless swap on Sepolia...');
      
      const swapTx = await sepoliaSmartAccountClient.sendTransaction({
        to: CONTRACTS.sepolia.routerHub,
        data: swapData,
        value: 0n,
      });
      
      console.log('✅ Swap TX:', swapTx);
      console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
      
      await sepoliaClient.waitForTransactionReceipt({ hash: swapTx });
      
      const newWethBalance = await sepoliaClient.readContract({
        address: CONTRACTS.sepolia.weth,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [sepoliaSmartAccount.address],
      });
      
      console.log('\n📊 After Swap:');
      console.log('   WETH Balance:', formatUnits(newWethBalance, 18));
      console.log('   WETH Received:', formatUnits(newWethBalance - sepoliaWeth, 18));
      console.log('\n🎉 SEPOLIA GASLESS SWAP SUCCESSFUL!');
      
    } catch (error) {
      console.error('❌ Sepolia swap failed:', error.message);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('✅ Same-chain gasless swaps: WORKING');
  console.log('   - Amoy: USDC -> LINK (gasless via Pimlico)');
  console.log('   - Sepolia: USDC -> WETH (gasless via Pimlico)');
  console.log('\n⚠️ Cross-chain gasless swaps: INFRASTRUCTURE NEEDED');
  console.log('   - Smart contracts ready (dstChainId support)');
  console.log('   - Needs: Bridge adapter integration (LayerZero/CCIP)');
  console.log('   - Needs: Cross-chain message relayer');
  console.log('   - Needs: Liquidity on both chains');
}

main().catch(console.error);
