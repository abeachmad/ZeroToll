/**
 * Test EIP-7702 using MetaMask Delegation Toolkit
 * 
 * This script tests gasless transactions using the proper EIP-7702 flow:
 * 1. Sign authorization to upgrade EOA to smart account
 * 2. Submit authorization on-chain
 * 3. Create smart account instance (same address as EOA!)
 * 4. Send user operations via bundler
 * 
 * Run with: node test-eip7702-delegation-toolkit.mjs
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  encodeFunctionData,
  parseAbi,
  formatUnits,
  formatEther,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { 
  toMetaMaskSmartAccount,
  getDeleGatorEnvironment,
  Implementation,
} from '@metamask/delegation-toolkit';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createBundlerClient } from 'viem/account-abstraction';

// Configuration
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Test on Sepolia
const CHAIN_ID = 11155111;
const chain = sepolia;

// USDC on Sepolia
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ROUTER_HUB = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';

// ERC20 ABI
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

async function main() {
  console.log('🚀 Testing EIP-7702 with MetaMask Delegation Toolkit\n');
  console.log('='.repeat(60));
  
  // 1. Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('👤 EOA Address:', account.address);
  
  // 2. Create clients
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });
  
  // Check balances
  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log('💰 ETH Balance:', formatEther(ethBalance));
  
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('💵 USDC Balance:', formatUnits(usdcBalance, 6));
  
  // 3. Check if already upgraded to smart account
  console.log('\n🔍 Checking account status...');
  const code = await publicClient.getCode({ address: account.address });
  
  let isUpgraded = false;
  if (code && code !== '0x' && code.startsWith('0xef0100')) {
    console.log('✅ Already upgraded to EIP-7702 smart account!');
    const delegatorAddress = `0x${code.substring(8, 48)}`;
    console.log('   Delegator:', delegatorAddress);
    isUpgraded = true;
  } else {
    console.log('📭 Fresh EOA - needs upgrade');
  }
  
  // 4. Get the delegator environment
  console.log('\n🔧 Getting delegator environment...');
  
  let delegatorAddress;
  try {
    const env = getDeleGatorEnvironment(CHAIN_ID);
    delegatorAddress = env?.implementations?.EIP7702StatelessDeleGatorImpl;
    console.log('   Delegator address:', delegatorAddress);
    console.log('   EntryPoint:', env?.EntryPoint);
  } catch (envError) {
    console.log('⚠️ Could not get delegator environment:', envError.message);
    delegatorAddress = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B';
    console.log('   Using fallback delegator:', delegatorAddress);
  }
  
  // 5. If not upgraded, sign and submit authorization
  if (!isUpgraded) {
    console.log('\n📝 Signing EIP-7702 authorization...');
    
    try {
      // Use walletClient to sign authorization (viem 2.x experimental)
      const authorization = await walletClient.signAuthorization({
        contractAddress: delegatorAddress,
      });
      
      console.log('✅ Authorization signed!');
      console.log('   Contract:', authorization.contractAddress);
      console.log('   Chain ID:', authorization.chainId);
      console.log('   Nonce:', authorization.nonce);
      console.log('   R:', authorization.r?.substring(0, 20) + '...');
      console.log('   S:', authorization.s?.substring(0, 20) + '...');
      console.log('   V:', authorization.v);
      
      // 6. Submit authorization on-chain
      console.log('\n📤 Submitting authorization on-chain...');
      
      const txHash = await walletClient.sendTransaction({
        to: account.address, // Send to self
        value: 0n,
        authorizationList: [authorization],
      });
      
      console.log('✅ Authorization TX:', txHash);
      console.log(`   View: https://sepolia.etherscan.io/tx/${txHash}`);
      
      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('✅ Authorization confirmed! Block:', receipt.blockNumber);
      
      isUpgraded = true;
      
    } catch (authError) {
      console.error('❌ Authorization failed:', authError.message);
      
      // Check if it's a viem version issue
      if (authError.message?.includes('signAuthorization is not a function')) {
        console.log('\n💡 signAuthorization requires viem 2.x with experimental EIP-7702 support');
        console.log('   The browser implementation uses useSendCalls which handles this automatically');
      }
    }
  }
  
  // 7. Create smart account instance
  console.log('\n🔧 Creating smart account instance...');
  
  try {
    // toMetaMaskSmartAccount expects a specific structure
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Stateless7702,
      deployParams: [account.address, [], [], []], // owner, signers, threshold, etc.
      deploySalt: '0x',
      signatory: { account, walletClient },
    });
    
    console.log('✅ Smart Account created:', smartAccount.address);
    
    // 8. Create Pimlico bundler client
    const pimlicoUrl = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`;
    
    const pimlicoClient = createPimlicoClient({
      chain,
      transport: http(pimlicoUrl),
    });
    
    // Check Pimlico availability
    console.log('\n🔍 Checking Pimlico...');
    const gasPrices = await pimlicoClient.getUserOperationGasPrice();
    console.log('✅ Pimlico available! Gas prices:', gasPrices);
    
    // 9. Create bundler client
    const bundlerClient = createBundlerClient({
      chain,
      transport: http(pimlicoUrl),
      account: smartAccount,
      paymaster: pimlicoClient,
    });
    
    console.log('✅ Bundler client ready');
    
    // 10. Send a test approval
    console.log('\n📝 Sending gasless approval...');
    
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, 1000000n], // 1 USDC
    });
    
    const userOpHash = await bundlerClient.sendUserOperation({
      calls: [{
        to: USDC_ADDRESS,
        value: 0n,
        data: approveData,
      }],
    });
    
    console.log('📤 UserOp Hash:', userOpHash);
    
    // Wait for receipt
    console.log('⏳ Waiting for receipt...');
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    
    console.log('\n✅✅✅ GASLESS TRANSACTION SUCCESS! ✅✅✅');
    console.log('TX:', receipt.receipt.transactionHash);
    console.log(`View: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);
    
  } catch (smartAccountError) {
    console.error('❌ Smart account error:', smartAccountError.message);
    
    // Provide helpful debugging info
    console.log('\n📋 Debug Info:');
    console.log('   - Implementation:', Implementation.Stateless7702);
    console.log('   - Delegator:', delegatorAddress);
    console.log('   - Account upgraded:', isUpgraded);
    
    if (smartAccountError.stack) {
      console.log('\n📜 Stack trace:');
      console.log(smartAccountError.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Complete');
  console.log('\n💡 Note: For browser users, the useSendCalls hook handles all of this automatically!');
}

main().catch(console.error);
