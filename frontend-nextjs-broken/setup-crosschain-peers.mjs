/**
 * Setup Cross-Chain Peers and Fund Adapters
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
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';

const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';

const ADAPTERS = {
  amoy: {
    chainId: 80002,
    adapter: '0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    weth: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
    rpc: 'https://rpc-amoy.polygon.technology',
  },
  sepolia: {
    chainId: 11155111,
    adapter: '0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  }
};

const ADAPTER_ABI = [
  { name: 'setPeer', type: 'function', inputs: [{ name: '_chainId', type: 'uint256' }, { name: '_peer', type: 'address' }], outputs: [] },
  { name: 'peers', type: 'function', inputs: [{ name: '', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'fundAdapter', type: 'function', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'getBalance', type: 'function', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

async function setupChain(chainName, chain, config, peerChainId, peerAdapter) {
  console.log(`\n📍 Setting up ${chainName}...`);
  
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpc),
  });
  
  const walletClient = createWalletClient({
    account: deployer,
    chain,
    transport: http(config.rpc),
  });
  
  // Check current peer
  const currentPeer = await publicClient.readContract({
    address: config.adapter,
    abi: ADAPTER_ABI,
    functionName: 'peers',
    args: [BigInt(peerChainId)],
  });
  
  console.log(`   Current peer for chain ${peerChainId}:`, currentPeer);
  
  // Set peer if not set
  if (currentPeer === '0x0000000000000000000000000000000000000000') {
    console.log(`   Setting peer to ${peerAdapter}...`);
    
    const setPeerData = encodeFunctionData({
      abi: ADAPTER_ABI,
      functionName: 'setPeer',
      args: [BigInt(peerChainId), peerAdapter],
    });
    
    const tx = await walletClient.sendTransaction({
      to: config.adapter,
      data: setPeerData,
    });
    
    console.log(`   TX: ${tx}`);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`   ✅ Peer set!`);
  } else {
    console.log(`   ✅ Peer already set`);
  }
  
  // Check adapter balances
  console.log(`\n   Adapter balances:`);
  
  const usdcBalance = await publicClient.readContract({
    address: config.adapter,
    abi: ADAPTER_ABI,
    functionName: 'getBalance',
    args: [config.usdc],
  });
  console.log(`   USDC: ${formatUnits(usdcBalance, 6)}`);
  
  const wethBalance = await publicClient.readContract({
    address: config.adapter,
    abi: ADAPTER_ABI,
    functionName: 'getBalance',
    args: [config.weth],
  });
  console.log(`   WETH: ${formatEther(wethBalance)}`);
  
  // Fund with USDC if needed
  if (usdcBalance < parseUnits('5', 6)) {
    console.log(`\n   Funding adapter with USDC...`);
    
    const deployerUsdc = await publicClient.readContract({
      address: config.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [deployer.address],
    });
    
    if (deployerUsdc > parseUnits('10', 6)) {
      const fundAmount = parseUnits('10', 6);
      
      // Approve
      const approveTx = await walletClient.sendTransaction({
        to: config.usdc,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [config.adapter, fundAmount],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      
      // Fund
      const fundTx = await walletClient.sendTransaction({
        to: config.adapter,
        data: encodeFunctionData({
          abi: ADAPTER_ABI,
          functionName: 'fundAdapter',
          args: [config.usdc, fundAmount],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      console.log(`   ✅ Funded with 10 USDC`);
    } else {
      console.log(`   ⚠️ Deployer has insufficient USDC`);
    }
  }
  
  // Fund with WETH if needed
  if (wethBalance < parseEther('0.001')) {
    console.log(`\n   Funding adapter with WETH...`);
    
    const deployerWeth = await publicClient.readContract({
      address: config.weth,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [deployer.address],
    });
    
    if (deployerWeth > parseEther('0.005')) {
      const fundAmount = parseEther('0.005');
      
      // Approve
      const approveTx = await walletClient.sendTransaction({
        to: config.weth,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [config.adapter, fundAmount],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      
      // Fund
      const fundTx = await walletClient.sendTransaction({
        to: config.adapter,
        data: encodeFunctionData({
          abi: ADAPTER_ABI,
          functionName: 'fundAdapter',
          args: [config.weth, fundAmount],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      console.log(`   ✅ Funded with 0.005 WETH`);
    } else {
      console.log(`   ⚠️ Deployer has insufficient WETH`);
    }
  }
}

async function main() {
  console.log('🌉 Setting up Cross-Chain Adapters\n');
  console.log('=' .repeat(60));
  
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  console.log('📍 Deployer:', deployer.address);
  
  // Setup Amoy adapter (peer = Sepolia)
  await setupChain('Amoy', polygonAmoy, ADAPTERS.amoy, ADAPTERS.sepolia.chainId, ADAPTERS.sepolia.adapter);
  
  // Setup Sepolia adapter (peer = Amoy)
  await setupChain('Sepolia', sepolia, ADAPTERS.sepolia, ADAPTERS.amoy.chainId, ADAPTERS.amoy.adapter);
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Cross-chain setup complete!');
  console.log('\n📋 Adapter Addresses:');
  console.log(`   Amoy: ${ADAPTERS.amoy.adapter}`);
  console.log(`   Sepolia: ${ADAPTERS.sepolia.adapter}`);
}

main().catch(console.error);
