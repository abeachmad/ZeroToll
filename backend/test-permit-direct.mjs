/**
 * Test permit signature directly on the token contract
 * This bypasses the router to verify the permit signature is valid
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);

// Token and router addresses
const ZTA_TOKEN = '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C';
const ROUTER = '0x577560699EF88e99f15d04df57c9552056d2a10D';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const walletClient = createWalletClient({
  account: relayerAccount,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function balanceOf(address) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)'
]);

async function main() {
  console.log('Testing permit signature directly on token contract...\n');
  
  // Get token info
  const tokenName = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'name'
  });
  console.log('Token name:', tokenName);
  
  const domainSeparator = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'DOMAIN_SEPARATOR'
  });
  console.log('Domain separator:', domainSeparator);
  
  // Get relayer's nonce and balance
  const nonce = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'nonces',
    args: [relayerAccount.address]
  });
  console.log('Relayer permit nonce:', nonce.toString());
  
  const balance = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [relayerAccount.address]
  });
  console.log('Relayer balance:', balance.toString());
  
  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'allowance',
    args: [relayerAccount.address, ROUTER]
  });
  console.log('Current allowance to router:', currentAllowance.toString());
  
  // Sign a permit
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const value = 1000000n; // 1 token (6 decimals)
  
  const domain = {
    name: tokenName,
    version: '1',
    chainId: 11155111,
    verifyingContract: ZTA_TOKEN
  };
  
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };
  
  const message = {
    owner: relayerAccount.address,
    spender: ROUTER,
    value: value,
    nonce: nonce,
    deadline: BigInt(deadline)
  };
  
  console.log('\nSigning permit with:');
  console.log('  owner:', message.owner);
  console.log('  spender:', message.spender);
  console.log('  value:', message.value.toString());
  console.log('  nonce:', message.nonce.toString());
  console.log('  deadline:', message.deadline.toString());
  
  const signature = await walletClient.signTypedData({
    domain,
    types,
    primaryType: 'Permit',
    message
  });
  
  console.log('\nSignature:', signature);
  
  // Parse signature
  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;
  
  console.log('  v:', v);
  console.log('  r:', r);
  console.log('  s:', s);
  
  // Try to call permit directly on the token
  console.log('\nCalling permit on token contract...');
  
  try {
    const hash = await walletClient.writeContract({
      address: ZTA_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'permit',
      args: [
        relayerAccount.address,
        ROUTER,
        value,
        BigInt(deadline),
        v,
        r,
        s
      ]
    });
    
    console.log('✅ Permit transaction sent:', hash);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Permit confirmed in block:', receipt.blockNumber);
    
    // Check new allowance
    const newAllowance = await publicClient.readContract({
      address: ZTA_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'allowance',
      args: [relayerAccount.address, ROUTER]
    });
    console.log('New allowance to router:', newAllowance.toString());
    
  } catch (error) {
    console.error('❌ Permit failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

main().catch(console.error);
