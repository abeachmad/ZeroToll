/**
 * Account Abstraction Utilities for ZeroToll
 * 
 * Handles UserOp construction, paymaster interaction, and bundler submission
 * for gasless swaps using ERC-4337.
 */

import { ethers } from 'ethers';

// Configuration
const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"; // EntryPoint v0.7

const PAYMASTER_ADDRESSES = {
  80002: "0xC721582d25895956491436459df34cd817C6AB74",    // Amoy
  11155111: "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9"  // Sepolia
};

const BUNDLER_RPC = process.env.REACT_APP_BUNDLER_RPC || "http://localhost:3000/rpc";
const POLICY_SERVER_URL = process.env.REACT_APP_POLICY_SERVER_URL || "http://localhost:3002";

// EntryPoint ABI (minimal)
const ENTRYPOINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)"
];

// Simple Account interface (for execute calls)
const ACCOUNT_INTERFACE = new ethers.Interface([
  "function execute(address dest, uint256 value, bytes calldata func) external"
]);

/**
 * Build a UserOp for a swap transaction
 * 
 * @param {Object} params
 * @param {string} params.smartAccount - Smart account address
 * @param {string} params.routerHub - RouterHub contract address
 * @param {string} params.swapCallData - Encoded executeRoute call
 * @param {number} params.chainId - Chain ID (80002 for Amoy, 11155111 for Sepolia)
 * @param {ethers.Provider} params.provider - Ethers provider
 * @returns {Promise<Object>} UserOp object
 */
export async function buildSwapUserOp({ smartAccount, routerHub, swapCallData, chainId, provider }) {
  // Get nonce from EntryPoint
  const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
  const nonce = await entryPoint.getNonce(smartAccount, 0);

  // Encode as smart account execute call
  const executeCallData = ACCOUNT_INTERFACE.encodeFunctionData("execute", [
    routerHub,
    0, // value
    swapCallData
  ]);

  // Get gas price
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits("100", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits("30", "gwei");

  // Build UserOp
  const userOp = {
    sender: smartAccount,
    nonce: "0x" + nonce.toString(16),
    initCode: "0x",
    callData: executeCallData,
    callGasLimit: "0x7a120",        // 500000 (high for swap execution)
    verificationGasLimit: "0x493e0", // 300000
    preVerificationGas: "0x30d40",   // 200000
    maxFeePerGas: "0x" + maxFeePerGas.toString(16),
    maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
    paymasterAndData: PAYMASTER_ADDRESSES[chainId] + "0".repeat(130), // Placeholder
    signature: "0x" + "0".repeat(130) // Placeholder
  };

  return userOp;
}

/**
 * Request paymaster sponsorship from policy server
 * 
 * @param {Object} userOp - UserOp object
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} { paymasterSignature, userOpHash, remaining }
 */
export async function requestPaymasterSponsorship(userOp, chainId) {
  try {
    const response = await fetch(`${POLICY_SERVER_URL}/api/paymaster/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userOp, chainId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sponsorship denied');
    }

    const data = await response.json();
    return {
      paymasterSignature: data.paymasterSignature,
      userOpHash: data.userOpHash,
      remaining: data.remaining
    };
  } catch (error) {
    console.error('Policy server error:', error);
    throw new Error(`Failed to get sponsorship: ${error.message}`);
  }
}

/**
 * Sign UserOp with account owner's wallet
 * 
 * @param {string} userOpHash - Hash of the UserOp
 * @param {ethers.Signer} signer - Wallet signer (account owner)
 * @returns {Promise<string>} Signature
 */
export async function signUserOp(userOpHash, signer) {
  try {
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));
    return signature;
  } catch (error) {
    console.error('Signing error:', error);
    throw new Error(`Failed to sign UserOp: ${error.message}`);
  }
}

/**
 * Submit UserOp to bundler
 * 
 * @param {Object} userOp - Complete UserOp with signatures
 * @returns {Promise<string>} UserOp hash
 */
export async function submitUserOpToBundler(userOp) {
  try {
    const response = await fetch(BUNDLER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, ENTRYPOINT_ADDRESS]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Bundler rejected UserOp');
    }

    return data.result; // UserOp hash
  } catch (error) {
    console.error('Bundler error:', error);
    throw new Error(`Failed to submit UserOp: ${error.message}`);
  }
}

/**
 * Check UserOp status (poll bundler)
 * 
 * @param {string} userOpHash - UserOp hash from submission
 * @returns {Promise<Object|null>} Receipt or null if not mined yet
 */
export async function getUserOpReceipt(userOpHash) {
  try {
    const response = await fetch(BUNDLER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getUserOperationReceipt",
        params: [userOpHash]
      })
    });

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error('Receipt check error:', error);
    return null;
  }
}

/**
 * Complete gasless swap flow
 * 
 * @param {Object} params
 * @param {string} params.smartAccount - Smart account address
 * @param {string} params.routerHub - RouterHub address
 * @param {string} params.swapCallData - Encoded swap data
 * @param {number} params.chainId - Chain ID
 * @param {ethers.Provider} params.provider - Provider
 * @param {ethers.Signer} params.signer - Account owner signer
 * @param {Function} params.onStatusUpdate - Callback(status, message)
 * @returns {Promise<string>} Transaction hash
 */
export async function executeGaslessSwap({
  smartAccount,
  routerHub,
  swapCallData,
  chainId,
  provider,
  signer,
  onStatusUpdate
}) {
  try {
    // Step 1: Build UserOp
    onStatusUpdate?.('building', 'Building UserOp...');
    const userOp = await buildSwapUserOp({
      smartAccount,
      routerHub,
      swapCallData,
      chainId,
      provider
    });

    // Step 2: Request paymaster sponsorship
    onStatusUpdate?.('sponsoring', 'Requesting gas sponsorship...');
    const { paymasterSignature, userOpHash, remaining } = await requestPaymasterSponsorship(userOp, chainId);
    
    onStatusUpdate?.('sponsoring', `Sponsorship approved! (${remaining.daily} swaps left today)`);

    // Step 3: Sign UserOp
    onStatusUpdate?.('signing', 'Please sign the transaction...');
    const accountSignature = await signUserOp(userOpHash, signer);

    // Step 4: Finalize UserOp
    const finalUserOp = {
      ...userOp,
      paymasterAndData: PAYMASTER_ADDRESSES[chainId] + paymasterSignature.slice(2),
      signature: accountSignature
    };

    // Step 5: Submit to bundler
    onStatusUpdate?.('submitting', 'Submitting to bundler...');
    const submittedUserOpHash = await submitUserOpToBundler(finalUserOp);

    onStatusUpdate?.('pending', 'Waiting for bundler to process...');

    // Step 6: Poll for receipt
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    while (!receipt && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      receipt = await getUserOpReceipt(submittedUserOpHash);
      attempts++;
    }

    if (!receipt) {
      throw new Error('UserOp not processed within 30 seconds');
    }

    // Check if successful
    if (!receipt.success) {
      throw new Error('UserOp execution failed');
    }

    onStatusUpdate?.('success', 'Gasless swap complete!');
    return receipt.receipt.transactionHash;

  } catch (error) {
    onStatusUpdate?.('error', error.message);
    throw error;
  }
}

/**
 * Check if user has a smart account deployed
 * 
 * @param {string} address - EOA address
 * @param {ethers.Provider} provider - Provider
 * @returns {Promise<boolean>} True if smart account exists
 */
export async function hasSmartAccount(address, provider) {
  // For now, assume smart account = EOA (Simple Account)
  // In production, you'd check factory records or deterministic address
  const code = await provider.getCode(address);
  return code !== '0x';
}

/**
 * Get smart account address for an EOA
 * 
 * @param {string} eoaAddress - EOA address
 * @returns {string} Smart account address (for now, same as EOA)
 */
export function getSmartAccountAddress(eoaAddress) {
  // For testing with pre-deployed account
  const TEST_ACCOUNT = "0x5a87a3c738cf99db95787d51b627217b6de12f62";
  
  // In production, calculate deterministic address from factory
  // For now, return test account if it matches the test owner
  if (eoaAddress.toLowerCase() === "0x5a87A3c738cf99DB95787D51B627217B6dE12F62".toLowerCase()) {
    return TEST_ACCOUNT;
  }
  
  // Otherwise, assume EOA = smart account (needs proper factory integration)
  return eoaAddress;
}

/**
 * Execute gasless token approval using UserOp
 * 
 * @param {Object} params
 * @param {string} params.smartAccount - Smart account address
 * @param {string} params.tokenAddress - ERC20 token address to approve
 * @param {string} params.spenderAddress - Spender address (RouterHub)
 * @param {string} params.amount - Amount to approve (in wei/smallest unit)
 * @param {number} params.chainId - Chain ID
 * @param {ethers.Provider} params.provider - Ethers provider
 * @param {ethers.Signer} params.signer - Ethers signer (wallet)
 * @param {Function} params.onStatusUpdate - Status update callback
 * @returns {Promise<string>} Transaction hash
 */
export async function executeGaslessApproval({
  smartAccount,
  tokenAddress,
  spenderAddress,
  amount,
  chainId,
  provider,
  signer,
  onStatusUpdate
}) {
  try {
    onStatusUpdate?.('building', 'Building approval UserOp...');

    // ERC20 approve ABI
    const ERC20_INTERFACE = new ethers.Interface([
      "function approve(address spender, uint256 amount) returns (bool)"
    ]);

    // Encode approve call
    const approveCallData = ERC20_INTERFACE.encodeFunctionData("approve", [
      spenderAddress,
      amount
    ]);

    // Get nonce from EntryPoint
    const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);
    const nonce = await entryPoint.getNonce(smartAccount, 0);

    // Encode as smart account execute call
    const executeCallData = ACCOUNT_INTERFACE.encodeFunctionData("execute", [
      tokenAddress,  // dest = token contract
      0,             // value = 0
      approveCallData
    ]);

    // Build UserOp
    const userOp = {
      sender: smartAccount,
      nonce: ethers.toBeHex(nonce),
      callData: executeCallData,
      initCode: "0x",
      callGasLimit: ethers.toBeHex(200000),
      verificationGasLimit: ethers.toBeHex(300000),
      preVerificationGas: ethers.toBeHex(50000),
      maxFeePerGas: ethers.toBeHex(ethers.parseUnits("50", "gwei")),
      maxPriorityFeePerGas: ethers.toBeHex(ethers.parseUnits("30", "gwei")),
      signature: "0x",
      paymasterAndData: "0x"
    };

    onStatusUpdate?.('requesting', 'Requesting paymaster sponsorship...');

    // Get paymaster signature
    const paymasterData = await requestPaymasterSponsorship({
      userOp,
      entryPoint: ENTRYPOINT_ADDRESS,
      chainId
    });

    userOp.paymasterAndData = paymasterData;

    onStatusUpdate?.('signing', 'Signing approval (no gas fee)...');

    // Sign UserOp
    const userOpHash = getUserOpHash(userOp, ENTRYPOINT_ADDRESS, chainId);
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    onStatusUpdate?.('submitting', 'Submitting to bundler...');

    // Submit to bundler
    const txHash = await submitUserOpToBundler(userOp);

    onStatusUpdate?.('submitted', `Approval submitted! Hash: ${txHash}`);

    return txHash;
  } catch (error) {
    onStatusUpdate?.('error', `Approval failed: ${error.message}`);
    throw error;
  }
}

/**
 * Check policy server health
 * 
 * @returns {Promise<boolean>} True if policy server is running
 */
export async function checkPolicyServerHealth() {
  try {
    const response = await fetch(`${POLICY_SERVER_URL}/health`, {
      method: 'GET'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check bundler health
 * 
 * @returns {Promise<boolean>} True if bundler is running
 */
export async function checkBundlerHealth() {
  try {
    const response = await fetch(BUNDLER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_supportedEntryPoints",
        params: []
      })
    });
    const data = await response.json();
    return data.result?.includes(ENTRYPOINT_ADDRESS);
  } catch (error) {
    return false;
  }
}
