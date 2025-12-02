/**
 * ZeroToll Pimlico V2 Relayer
 * 
 * Uses Pimlico's verifying paymaster for gas sponsorship
 * Simpler approach - direct bundler API calls
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  verifyTypedData,
  encodeFunctionData,
  parseAbi,
  getAddress,
  concat,
  toHex,
  pad,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters
} from 'viem';
import { privateKeyToAccount, signMessage } from 'viem/accounts';
import { sepolia } from 'viem/chains';

config();

const app = express();
app.use(cors());
app.use(express.json());

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

if (!RELAYER_PRIVATE_KEY || !PIMLICO_API_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY or PIMLICO_API_KEY');
  process.exit(1);
}

const ZEROTOLL_ROUTER = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';
const PIMLICO_BUNDLER_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

// EIP-712 Types
const SWAP_INTENT_TYPES = {
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

const getDomain = (chainId, routerAddress) => ({
  name: 'ZeroTollRouter',
  version: '1',
  chainId,
  verifyingContract: routerAddress
});

const ROUTER_ABI = parseAbi([
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

const intents = new Map();
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
console.log('Relayer:', relayerAccount.address);

const publicClient = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
const walletClient = createWalletClient({ account: relayerAccount, chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });

// Helper to call Pimlico bundler
async function callPimlico(method, params) {
  const response = await fetch(PIMLICO_BUNDLER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

