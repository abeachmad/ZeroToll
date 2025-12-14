/**
 * Test the exact flow that the Smart Account uses
 * This mimics what happens when a user submits a gasless swap
 */

import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';

config({ path: '../.env.credentials' });

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);

// We need a separate "user" account to simulate the real flow
// In production, this would be the user's wallet
const USER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY; // Using deployer as test user
const userAccount = privateKeyToAccount(`0x${USER_PRIVATE_KEY.replace('0x', '')}`);

// Contract addresses
const ZTA_TOKEN = '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C';
const ZTB_TOKEN = '0x8fb844251af76AF090B005643D966FC52852100a';
const ROUTER = '0x577560699EF88e99f15d04df57c9552056d2a10D';
const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const userWalletClient = createWalletClient({
  account: userAccount,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function faucet()'
]);

const ROUTER_ABI = parseAbi([
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function nonces(address user) view returns (uint256)',
  'function testMode() view returns (bool)'
]);

async function main() {
  console.log('Testing Smart Account flow for gasless swap...\n');
  console.log('User (signer):', userAccount.address);
  console.log('Relayer EOA:', relayerAccount.address);
  
  // Initialize Smart Account
  console.log('\n--- Initializing Smart Account ---');
  const pimlicoClient = createPimlicoClient({
    transport: http(PIMLICO_URL),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  const simpleAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: relayerAccount,
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  console.log('Smart Account address:', simpleAccount.address);

  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: sepolia,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      }
    }
  });

  // Check user's token balance
  let userBalance = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [userAccount.address]
  });
  console.log('\nUser ZTA balance:', userBalance.toString());

  // If no balance, get some from faucet
  if (userBalance === 0n) {
    console.log('Getting tokens from faucet for user...');
    const faucetHash = await userWalletClient.writeContract({
      address: ZTA_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'faucet'
    });
    await publicClient.waitForTransactionReceipt({ hash: faucetHash });
    
    userBalance = await publicClient.readContract({
      address: ZTA_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [userAccount.address]
    });
    console.log('New user balance:', userBalance.toString());
  }

  // Get nonces
  const permitNonce = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'nonces',
    args: [userAccount.address]
  });
  console.log('User permit nonce:', permitNonce.toString());

  const swapNonce = await publicClient.readContract({
    address: ROUTER,
    abi: ROUTER_ABI,
    functionName: 'nonces',
    args: [userAccount.address]
  });
  console.log('User swap nonce:', swapNonce.toString());

  // Get token name for permit domain
  const tokenName = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'name'
  });

  // Prepare swap parameters
  const amountIn = 1000000n; // 1 token (6 decimals)
  const minAmountOut = 900000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // USER signs permit (authorizing ROUTER to spend USER's tokens)
  console.log('\n--- User Signing Permit ---');
  const permitDomain = {
    name: tokenName,
    version: '1',
    chainId: 11155111,
    verifyingContract: ZTA_TOKEN
  };

  const permitTypes = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };

  const permitMessage = {
    owner: userAccount.address,
    spender: ROUTER,
    value: amountIn,
    nonce: permitNonce,
    deadline: deadline
  };

  console.log('Permit message:', permitMessage);

  const permitSig = await userWalletClient.signTypedData({
    domain: permitDomain,
    types: permitTypes,
    primaryType: 'Permit',
    message: permitMessage
  });

  const permitR = permitSig.slice(0, 66);
  const permitS = '0x' + permitSig.slice(66, 130);
  let permitV = parseInt(permitSig.slice(130, 132), 16);
  if (permitV < 27) permitV += 27;

  console.log('Permit v:', permitV);

  // USER signs swap intent
  console.log('\n--- User Signing Swap Intent ---');
  const swapDomain = {
    name: 'ZeroTollRouter',
    version: '1',
    chainId: 11155111,
    verifyingContract: ROUTER
  };

  const swapTypes = {
    SwapIntent: [
      { name: 'user', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'chainId', type: 'uint256' }
    ]
  };

  const intent = {
    user: userAccount.address,
    tokenIn: ZTA_TOKEN,
    tokenOut: ZTB_TOKEN,
    amountIn: amountIn,
    minAmountOut: minAmountOut,
    deadline: deadline,
    nonce: swapNonce,
    chainId: 11155111n
  };

  console.log('Swap intent:', intent);

  const swapSig = await userWalletClient.signTypedData({
    domain: swapDomain,
    types: swapTypes,
    primaryType: 'SwapIntent',
    message: intent
  });

  // Encode the calldata
  const callData = encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: 'executeSwapWithPermit',
    args: [intent, swapSig, deadline, permitV, permitR, permitS]
  });

  console.log('\n--- Submitting via Smart Account ---');
  console.log('Calldata length:', callData.length);

  try {
    const txHash = await smartAccountClient.sendTransaction({
      to: ROUTER,
      data: callData,
      value: 0n
    });

    console.log('✅ UserOp submitted, tx:', txHash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
    console.log('Status:', receipt.status);

    // Check new balance
    const newBalance = await publicClient.readContract({
      address: ZTB_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [userAccount.address]
    });
    console.log('User ZTB balance after swap:', newBalance.toString());

  } catch (error) {
    console.error('❌ UserOp failed:', error.message);
    if (error.cause) {
      console.error('Cause:', JSON.stringify(error.cause, null, 2));
    }
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

main().catch(console.error);
