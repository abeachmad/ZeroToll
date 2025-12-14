/**
 * End-to-end test of the gasless swap API
 * Tests the full flow: user signs → relayer submits → swap executes
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const RELAYER_URL = 'http://localhost:3001';
const USER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const userAccount = privateKeyToAccount(`0x${USER_PRIVATE_KEY.replace('0x', '')}`);

// Use the zTokens from frontend config
const ZTA_TOKEN = '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C'; // zUSDC
const ZTB_TOKEN = '0x8fb844251af76AF090B005643D966FC52852100a'; // ZTB
const CHAIN_ID = 11155111;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const walletClient = createWalletClient({
  account: userAccount,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

async function main() {
  console.log('='.repeat(60));
  console.log('END-TO-END GASLESS SWAP API TEST');
  console.log('='.repeat(60));
  console.log('\nUser:', userAccount.address);

  // 1. Get config from relayer
  console.log('\n--- Step 1: Get Relayer Config ---');
  const configRes = await fetch(`${RELAYER_URL}/api/config/${CHAIN_ID}`);
  const relayerConfig = await configRes.json();
  console.log('Router:', relayerConfig.routerAddress);
  console.log('Smart Account:', relayerConfig.smartAccountAddress);

  // 2. Get user's swap nonce
  console.log('\n--- Step 2: Get Swap Nonce ---');
  const nonceRes = await fetch(`${RELAYER_URL}/api/nonce/${CHAIN_ID}/${userAccount.address}`);
  const { nonce: swapNonce } = await nonceRes.json();
  console.log('Swap nonce:', swapNonce);

  // 3. Get permit nonce from token
  console.log('\n--- Step 3: Get Permit Nonce ---');
  const permitNonceData = `0x7ecebe00000000000000000000000000${userAccount.address.slice(2)}`;
  const permitNonceResult = await walletClient.request({
    method: 'eth_call',
    params: [{ to: ZTA_TOKEN, data: permitNonceData }, 'latest']
  });
  const permitNonce = parseInt(permitNonceResult, 16);
  console.log('Permit nonce:', permitNonce);

  // 4. Check user balance
  console.log('\n--- Step 4: Check Balance ---');
  const balanceData = `0x70a08231000000000000000000000000${userAccount.address.slice(2)}`;
  const balanceResult = await walletClient.request({
    method: 'eth_call',
    params: [{ to: ZTA_TOKEN, data: balanceData }, 'latest']
  });
  const balance = BigInt(balanceResult);
  console.log('ZTA balance:', balance.toString());

  if (balance < 1000000n) {
    console.log('Insufficient balance, getting from faucet...');
    const faucetHash = await walletClient.sendTransaction({
      to: ZTA_TOKEN,
      data: '0xde5f72fd' // faucet()
    });
    console.log('Faucet tx:', faucetHash);
    await publicClient.waitForTransactionReceipt({ hash: faucetHash });
    console.log('Faucet confirmed');
  }

  // 5. Get token name for permit
  const nameData = await walletClient.request({
    method: 'eth_call',
    params: [{ to: ZTA_TOKEN, data: '0x06fdde03' }, 'latest']
  });
  const lengthHex = nameData.slice(66, 130);
  const length = parseInt(lengthHex, 16);
  const hex = nameData.slice(130, 130 + length * 2);
  const tokenName = hex.match(/.{2}/g).map(h => parseInt(h, 16)).filter(c => c > 0).map(c => String.fromCharCode(c)).join('');
  console.log('Token name:', tokenName);

  // 6. Sign permit
  console.log('\n--- Step 5: Sign Permit ---');
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const amountIn = 1000000n; // 1 token

  const permitTypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    primaryType: 'Permit',
    domain: {
      name: tokenName,
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: ZTA_TOKEN
    },
    message: {
      owner: userAccount.address,
      spender: relayerConfig.routerAddress,
      value: amountIn.toString(),
      nonce: permitNonce.toString(),
      deadline: deadline.toString()
    }
  };

  const permitSig = await walletClient.signTypedData({
    domain: permitTypedData.domain,
    types: { Permit: permitTypedData.types.Permit },
    primaryType: 'Permit',
    message: {
      owner: userAccount.address,
      spender: relayerConfig.routerAddress,
      value: amountIn,
      nonce: BigInt(permitNonce),
      deadline: BigInt(deadline)
    }
  });

  const permitR = permitSig.slice(0, 66);
  const permitS = '0x' + permitSig.slice(66, 130);
  let permitV = parseInt(permitSig.slice(130, 132), 16);
  if (permitV < 27) permitV += 27;

  console.log('Permit signed, v:', permitV);

  // 7. Sign swap intent
  console.log('\n--- Step 6: Sign Swap Intent ---');
  const intent = {
    user: userAccount.address,
    tokenIn: ZTA_TOKEN,
    tokenOut: ZTB_TOKEN,
    amountIn: amountIn.toString(),
    minAmountOut: '900000',
    deadline: deadline.toString(),
    nonce: swapNonce.toString(),
    chainId: CHAIN_ID.toString()
  };

  const swapTypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
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
    },
    primaryType: 'SwapIntent',
    domain: {
      name: 'ZeroTollRouter',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: relayerConfig.routerAddress
    },
    message: intent
  };

  const swapSig = await walletClient.signTypedData({
    domain: swapTypedData.domain,
    types: { SwapIntent: swapTypedData.types.SwapIntent },
    primaryType: 'SwapIntent',
    message: {
      user: userAccount.address,
      tokenIn: ZTA_TOKEN,
      tokenOut: ZTB_TOKEN,
      amountIn: amountIn,
      minAmountOut: 900000n,
      deadline: BigInt(deadline),
      nonce: BigInt(swapNonce),
      chainId: BigInt(CHAIN_ID)
    }
  });

  console.log('Swap intent signed');

  // 8. Submit to relayer
  console.log('\n--- Step 7: Submit to Relayer ---');
  const permit = {
    v: permitV,
    r: permitR,
    s: permitS,
    deadline: deadline
  };

  const submitRes = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainId: CHAIN_ID,
      intent,
      userSignature: swapSig,
      permit
    })
  });

  const result = await submitRes.json();
  
  if (!submitRes.ok) {
    console.error('❌ Submission failed:', result);
    return;
  }

  console.log('✅ Submitted successfully!');
  console.log('Request ID:', result.requestId);
  console.log('TX Hash:', result.txHash);
  console.log('Explorer:', result.explorerUrl);
  console.log('Sponsor:', result.sponsor);

  // 9. Wait for confirmation
  console.log('\n--- Step 8: Wait for Confirmation ---');
  let status = 'pending';
  let attempts = 0;
  while (status === 'pending' && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`${RELAYER_URL}/api/intents/${result.requestId}/status`);
    const statusData = await statusRes.json();
    status = statusData.status;
    attempts++;
    process.stdout.write('.');
  }
  console.log();

  if (status === 'confirmed') {
    console.log('✅ Transaction confirmed!');
    
    // Check new balance
    const newBalanceResult = await walletClient.request({
      method: 'eth_call',
      params: [{ to: ZTB_TOKEN, data: balanceData }, 'latest']
    });
    console.log('New ZTB balance:', BigInt(newBalanceResult).toString());
  } else {
    console.log('Status:', status);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
