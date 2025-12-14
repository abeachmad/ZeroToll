/**
 * ZeroToll - Pimlico Bundler + Our VerifyingPaymaster
 * 
 * This uses Pimlico's bundler for reliable UserOp submission
 * but sponsors gas with our own VerifyingPaymaster contract.
 */

import { config } from 'dotenv';
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  toHex,
  concat,
  pad,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

config({ path: '.env' });
config({ path: '.env.credentials' });

const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const SIMPLE_ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';
const PAYMASTER_V07 = '0xaf7e002447b790f212ea435f9387509cd1ef0054';
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

const relayerAccount = privateKeyToAccount(`0x${process.env.RELAYER_PRIVATE_KEY}`);
const policySignerAccount = relayerAccount; // Same key for now

console.log('Relayer:', relayerAccount.address);
console.log('Paymaster:', PAYMASTER_V07);
console.log('Pimlico URL:', PIMLICO_URL.replace(PIMLICO_API_KEY, '***'));

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const SIMPLE_ACCOUNT_FACTORY_ABI = parseAbi([
  'function getAddress(address owner, uint256 salt) view returns (address)',
  'function createAccount(address owner, uint256 salt) returns (address)'
]);

const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function execute(address dest, uint256 value, bytes calldata func) external'
]);

const ENTRYPOINT_ABI = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'
]);

const PAYMASTER_ABI = parseAbi([
  'function getHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'
]);

async function main() {
  console.log('\n=== PIMLICO BUNDLER + OUR PAYMASTER ===\n');

  // Get Smart Account address
  const smartAccountAddress = await publicClient.readContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: SIMPLE_ACCOUNT_FACTORY_ABI,
    functionName: 'getAddress',
    args: [relayerAccount.address, 0n]
  });
  console.log('Smart Account:', smartAccountAddress);

  // Check if account exists
  const code = await publicClient.getCode({ address: smartAccountAddress });
  const accountExists = code && code !== '0x';
  console.log('Account exists:', accountExists);

  // Get nonce
  let nonce = 0n;
  try {
    nonce = await publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: ENTRYPOINT_ABI,
      functionName: 'getNonce',
      args: [smartAccountAddress, 0n]
    });
  } catch (e) {
    console.log('Could not get nonce, using 0');
  }
  console.log('Nonce:', nonce.toString());

  // Simple callData
  const callData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_ABI,
    functionName: 'execute',
    args: [smartAccountAddress, 0n, '0x']
  });

  // initCode
  let initCode = '0x';
  if (!accountExists) {
    const factoryData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'createAccount',
      args: [relayerAccount.address, 0n]
    });
    initCode = concat([SIMPLE_ACCOUNT_FACTORY, factoryData]);
  }

  // Gas prices from Pimlico
  console.log('\nGetting gas prices from Pimlico...');
  const gasPriceResponse = await fetch(PIMLICO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pimlico_getUserOperationGasPrice',
      params: []
    })
  });
  const gasPriceResult = await gasPriceResponse.json();
  console.log('Gas prices:', JSON.stringify(gasPriceResult.result?.fast, null, 2));
  
  const maxFeePerGas = BigInt(gasPriceResult.result?.fast?.maxFeePerGas || '50000000000');
  const maxPriorityFeePerGas = BigInt(gasPriceResult.result?.fast?.maxPriorityFeePerGas || '2000000000');

  // Pack gas limits
  const verificationGasLimit = 500000n;
  const callGasLimit = 100000n;
  const accountGasLimits = pad(toHex((verificationGasLimit << 128n) | callGasLimit), { size: 32 });
  const gasFees = pad(toHex((maxPriorityFeePerGas << 128n) | maxFeePerGas), { size: 32 });

  // Paymaster gas limits
  const paymasterVerificationGasLimit = 100000n;
  const paymasterPostOpGasLimit = 50000n;

  // Build paymasterAndData
  function buildPaymasterAndData(signature) {
    const verificationGasBytes = pad(toHex(paymasterVerificationGasLimit), { size: 16 });
    const postOpGasBytes = pad(toHex(paymasterPostOpGasLimit), { size: 16 });
    return concat([PAYMASTER_V07, verificationGasBytes, postOpGasBytes, signature]);
  }

  // Build packed UserOp for hash calculation
  // The paymaster's getHash function expects paymasterAndData with at least 52 bytes (paymaster + gas limits)
  const paymasterAndDataForHash = buildPaymasterAndData('0x' + '00'.repeat(65)); // Dummy 65-byte signature
  
  const packedUserOpForHash = {
    sender: smartAccountAddress,
    nonce: nonce,
    initCode: initCode,
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: 100000n,
    gasFees: gasFees,
    paymasterAndData: paymasterAndDataForHash,
    signature: '0x'
  };

  // Get hash from paymaster's getHash function (excludes signature from paymasterAndData)
  console.log('\nGetting hash from paymaster...');
  const hashToSign = await publicClient.readContract({
    address: PAYMASTER_V07,
    abi: PAYMASTER_ABI,
    functionName: 'getHash',
    args: [packedUserOpForHash]
  });
  console.log('Hash to sign:', hashToSign);

  // Sign with policy signer for paymaster
  const paymasterSig = await policySignerAccount.signMessage({ message: { raw: hashToSign } });
  console.log('Paymaster signature:', paymasterSig.slice(0, 20) + '...');

  // Build final paymasterAndData with real signature
  const paymasterAndData = buildPaymasterAndData(paymasterSig);

  // Get final UserOp hash from EntryPoint (for account signature)
  const packedUserOpFinal = {
    sender: smartAccountAddress,
    nonce: nonce,
    initCode: initCode,
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: 100000n,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
    signature: '0x'
  };

  const finalUserOpHash = await publicClient.readContract({
    address: ENTRYPOINT_V07,
    abi: ENTRYPOINT_ABI,
    functionName: 'getUserOpHash',
    args: [packedUserOpFinal]
  });
  console.log('Final UserOp hash (for account):', finalUserOpHash);

  // Sign for account
  const accountSig = await relayerAccount.signMessage({ message: { raw: finalUserOpHash } });
  console.log('Account signature:', accountSig.slice(0, 20) + '...');

  // Build final UserOp for Pimlico (unpacked format)
  const userOp = {
    sender: smartAccountAddress,
    nonce: toHex(nonce),
    callData: callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(100000n),
    maxFeePerGas: toHex(maxFeePerGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    paymaster: PAYMASTER_V07,
    paymasterVerificationGasLimit: toHex(paymasterVerificationGasLimit),
    paymasterPostOpGasLimit: toHex(paymasterPostOpGasLimit),
    paymasterData: paymasterSig,
    signature: accountSig
  };

  console.log('\nUserOp:');
  console.log(JSON.stringify(userOp, null, 2));

  // Send to Pimlico
  console.log('\nSending to Pimlico...');
  try {
    const response = await fetch(PIMLICO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [userOp, ENTRYPOINT_V07]
      })
    });

    const result = await response.json();
    console.log('\nPimlico response:');
    console.log(JSON.stringify(result, null, 2));

    if (result.result) {
      console.log('\n✅ UserOp submitted successfully!');
      console.log('UserOp Hash:', result.result);
      
      // Wait for receipt
      console.log('\nWaiting for receipt...');
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const receiptResponse = await fetch(PIMLICO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getUserOperationReceipt',
            params: [result.result]
          })
        });
        const receiptResult = await receiptResponse.json();
        if (receiptResult.result) {
          console.log('\n✅ Transaction confirmed!');
          console.log('Tx Hash:', receiptResult.result.receipt?.transactionHash);
          console.log('Success:', receiptResult.result.success);
          break;
        }
        process.stdout.write('.');
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main().catch(console.error);
