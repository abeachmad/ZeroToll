/**
 * usePimlico7702 Hook - EIP-7702 + ERC-4337 Gasless
 * 
 * Browser-compatible implementation that doesn't rely on @metamask/smart-accounts-kit
 * (which has CRA/webpack bundler issues).
 * 
 * Instead, we use:
 * - permissionless.js for Pimlico client
 * - viem for bundler client
 * - Direct UserOp construction compatible with MetaMask's StatelessDeleGator
 * 
 * Based on Research.md and working test scripts.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { 
  encodeFunctionData, 
  parseAbi, 
  http,
  createPublicClient,
  keccak256,
  encodeAbiParameters,
  concat,
  pad,
  toHex,
  hexToBigInt
} from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
]);

// Pimlico API Key
const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// EntryPoint v0.7 address (same on all chains)
const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// MetaMask's StatelessDeleGator contract
const METAMASK_DELEGATOR = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B';

// Chain configurations - Pimlico uses numeric chain IDs
const CHAIN_CONFIG = {
  80002: {
    name: 'Polygon Amoy',
    chain: polygonAmoy,
    explorer: 'https://amoy.polygonscan.com',
    pimlicoUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc-amoy.polygon.technology'
  },
  11155111: {
    name: 'Ethereum Sepolia',
    chain: sepolia,
    explorer: 'https://sepolia.etherscan.io',
    pimlicoUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc.sepolia.org'
  }
};

const STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  PREPARING: 'preparing',
  SIGNING: 'signing',
  SUBMITTING: 'submitting',
  CONFIRMING: 'confirming',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Make a JSON-RPC call
 */
async function rpcCall(url, method, params) {
  console.log(`📡 RPC: ${method}`, params);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    })
  });
  
  const data = await response.json();
  console.log(`📡 Response:`, data);
  
  if (data.error) {
    console.error('RPC error:', data.error);
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

/**
 * MetaMask's StatelessDeleGator execute function signature
 * Based on ERC-7579 execute interface
 */
const EXECUTE_ABI = parseAbi([
  'function execute(bytes32 mode, bytes calldata executionCalldata) external payable'
]);

/**
 * Encode a single call for ERC-7579 execute
 * Mode 0x00 = single call
 */
function encodeSingleCall(to, value, data) {
  // Mode for single execution: 0x00...00
  const mode = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  // Encode the execution data: abi.encodePacked(target, value, callData)
  const executionCalldata = concat([
    to,
    pad(toHex(value), { size: 32 }),
    data
  ]);
  
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [mode, executionCalldata]
  });
}

/**
 * Encode batch calls for ERC-7579 execute
 * Mode 0x01 = batch call
 */
function encodeBatchCalls(calls) {
  // Mode for batch execution: 0x01...00
  const mode = '0x0100000000000000000000000000000000000000000000000000000000000000';
  
  // Encode array of (target, value, callData) tuples
  const executionCalldata = encodeAbiParameters(
    [{ type: 'tuple[]', components: [
      { type: 'address', name: 'target' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'callData' }
    ]}],
    [calls.map(c => ({
      target: c.to,
      value: c.value || 0n,
      callData: c.data || '0x'
    }))]
  );
  
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [mode, executionCalldata]
  });
}

export function usePimlico7702() {
  const { address, chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [userOpHash, setUserOpHash] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSmartAccount, setIsSmartAccount] = useState(false);
  const [delegatorAddress, setDelegatorAddress] = useState(null);

  /**
   * Check if EOA is upgraded to 7702 smart account
   */
  const checkSmartAccountStatus = useCallback(async () => {
    if (!address || !publicClient) return false;

    try {
      const code = await publicClient.getCode({ address });
      
      // EIP-7702 code format: 0xef0100 + 20-byte delegator address
      if (code && code !== '0x' && code.startsWith('0xef0100')) {
        const delegator = '0x' + code.substring(8, 48);
        console.log('✅ EOA is 7702 upgraded');
        console.log('   Delegator:', delegator);
        setIsSmartAccount(true);
        setDelegatorAddress(delegator);
        return true;
      }

      console.log('❌ EOA is NOT 7702 upgraded');
      setIsSmartAccount(false);
      setDelegatorAddress(null);
      return false;
    } catch (err) {
      console.error('Error checking smart account:', err);
      return false;
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccountStatus();
    }
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  /**
   * Send a gasless UserOperation using Pimlico
   */
  const sendGaslessUserOp = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      throw new Error(`Chain ${chain.id} not supported`);
    }

    // Check if EOA is upgraded
    const upgraded = await checkSmartAccountStatus();
    if (!upgraded) {
      throw new Error(
        'EOA is not upgraded to 7702 Smart Account.\n' +
        'Please enable Smart Account in MetaMask settings first.'
      );
    }

    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setStatus(STATUS.PREPARING);
    setIsLoading(true);

    try {
      console.log('\n🎯 Sending Gasless UserOperation via Pimlico');
      console.log('   Chain:', config.name);
      console.log('   EOA:', address);
      console.log('   Delegator:', delegatorAddress);
      console.log('   Calls:', calls.length);

      setStatusMessage('Building UserOperation...');

      // Build callData for the smart account
      let callData;
      if (calls.length === 1) {
        callData = encodeSingleCall(calls[0].to, calls[0].value || 0n, calls[0].data || '0x');
      } else {
        callData = encodeBatchCalls(calls);
      }
      console.log('   CallData:', callData.substring(0, 66) + '...');

      // Get nonce from EntryPoint
      const nonceData = encodeFunctionData({
        abi: parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256)']),
        functionName: 'getNonce',
        args: [address, 0n]
      });
      
      const nonceResult = await rpcCall(config.rpcUrl, 'eth_call', [{
        to: ENTRYPOINT_V07,
        data: nonceData
      }, 'latest']);
      
      const nonce = toHex(hexToBigInt(nonceResult));
      console.log('   Nonce:', nonce);

      // Get gas prices from Pimlico
      const gasPrices = await rpcCall(config.pimlicoUrl, 'pimlico_getUserOperationGasPrice', []);
      console.log('   Gas prices:', gasPrices);

      // Build initial UserOp (EntryPoint v0.7 format)
      // Dummy signature for estimation (65 bytes ECDSA)
      const dummySignature = '0x' + 'ff'.repeat(65);
      
      const userOp = {
        sender: address,
        nonce: nonce,
        callData: callData,
        callGasLimit: toHex(500000n),
        verificationGasLimit: toHex(500000n),
        preVerificationGas: toHex(100000n),
        maxFeePerGas: gasPrices.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.fast.maxPriorityFeePerGas,
        signature: dummySignature
      };

      setStatusMessage('Getting gas sponsorship from Pimlico...');

      // Get paymaster stub data for estimation
      console.log('📡 Getting paymaster stub data...');
      const stubData = await rpcCall(
        config.pimlicoUrl,
        'pm_getPaymasterStubData',
        [userOp, ENTRYPOINT_V07, toHex(chain.id)]
      );
      console.log('✅ Stub data:', stubData);

      // Add paymaster data to userOp
      const userOpWithPaymaster = {
        ...userOp,
        paymaster: stubData.paymaster,
        paymasterData: stubData.paymasterData,
        paymasterVerificationGasLimit: stubData.paymasterVerificationGasLimit || toHex(100000n),
        paymasterPostOpGasLimit: stubData.paymasterPostOpGasLimit || toHex(50000n)
      };

      // Estimate gas
      console.log('📡 Estimating gas...');
      const gasEstimate = await rpcCall(
        config.pimlicoUrl,
        'eth_estimateUserOperationGas',
        [userOpWithPaymaster, ENTRYPOINT_V07]
      );
      console.log('✅ Gas estimate:', gasEstimate);

      // Update gas limits
      const userOpEstimated = {
        ...userOpWithPaymaster,
        callGasLimit: gasEstimate.callGasLimit,
        verificationGasLimit: gasEstimate.verificationGasLimit,
        preVerificationGas: gasEstimate.preVerificationGas,
        paymasterVerificationGasLimit: gasEstimate.paymasterVerificationGasLimit || userOpWithPaymaster.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: gasEstimate.paymasterPostOpGasLimit || userOpWithPaymaster.paymasterPostOpGasLimit
      };

      // Get final paymaster data
      console.log('📡 Getting final paymaster data...');
      const paymasterData = await rpcCall(
        config.pimlicoUrl,
        'pm_getPaymasterData',
        [userOpEstimated, ENTRYPOINT_V07, toHex(chain.id)]
      );
      console.log('✅ Paymaster data:', paymasterData);

      const finalUserOp = {
        ...userOpEstimated,
        paymaster: paymasterData.paymaster,
        paymasterData: paymasterData.paymasterData
      };

      setStatus(STATUS.SIGNING);
      setStatusMessage('Please sign in MetaMask (NO GAS!)...');

      // Get UserOp hash from bundler
      console.log('📡 Getting UserOp hash...');
      const userOpHashResult = await rpcCall(
        config.pimlicoUrl,
        'pimlico_getUserOperationHash',
        [finalUserOp, ENTRYPOINT_V07]
      );
      console.log('📝 UserOp hash to sign:', userOpHashResult);

      // Sign the hash with MetaMask
      const signature = await walletClient.signMessage({
        message: { raw: userOpHashResult }
      });
      console.log('✅ Signature:', signature.substring(0, 20) + '...');

      finalUserOp.signature = signature;

      setStatus(STATUS.SUBMITTING);
      setStatusMessage('Submitting to Pimlico bundler...');

      // Submit UserOp
      console.log('📤 Submitting UserOperation...');
      const hash = await rpcCall(
        config.pimlicoUrl,
        'eth_sendUserOperation',
        [finalUserOp, ENTRYPOINT_V07]
      );

      console.log('✅ UserOp submitted:', hash);
      setUserOpHash(hash);

      setStatus(STATUS.CONFIRMING);
      setStatusMessage('Waiting for confirmation...');

      // Poll for receipt
      let receipt = null;
      const startTime = Date.now();
      const timeout = 120000;

      while (!receipt && Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 3000));
        
        try {
          receipt = await rpcCall(
            config.pimlicoUrl,
            'eth_getUserOperationReceipt',
            [hash]
          );
          
          if (receipt) {
            console.log('📊 Receipt:', receipt);
          }
        } catch (err) {
          console.log('Waiting for receipt...');
        }
      }

      if (receipt?.receipt?.transactionHash) {
        setTxHash(receipt.receipt.transactionHash);
        setStatus(STATUS.SUCCESS);
        setStatusMessage('🎉 GASLESS transaction successful! You paid $0 in gas!');

        return {
          success: true,
          txHash: receipt.receipt.transactionHash,
          userOpHash: hash,
          explorerUrl: `${config.explorer}/tx/${receipt.receipt.transactionHash}`
        };
      } else {
        setStatus(STATUS.SUCCESS);
        setStatusMessage('Transaction submitted. Check explorer for confirmation.');
        
        return {
          success: true,
          userOpHash: hash,
          note: 'Transaction submitted, confirmation pending'
        };
      }

    } catch (err) {
      console.error('❌ Gasless UserOp error:', err);

      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('AA')) {
        errorMessage = `Account Abstraction error: ${err.message}`;
      } else if (err.message?.includes('insufficient')) {
        errorMessage = 'Paymaster rejected: insufficient sponsorship balance';
      }

      setError(errorMessage);
      setStatus(STATUS.ERROR);
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, walletClient, delegatorAddress, checkSmartAccountStatus]);

  /**
   * Execute gasless approval
   */
  const executeGaslessApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return sendGaslessUserOp({
      calls: [{ to: tokenAddress, data: approveData, value: 0n }]
    });
  }, [sendGaslessUserOp]);

  /**
   * Execute gasless batch (approve + swap)
   */
  const executeGaslessBatch = useCallback(async ({
    tokenAddress,
    spender,
    amount,
    routerHub,
    swapCallData
  }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return sendGaslessUserOp({
      calls: [
        { to: tokenAddress, data: approveData, value: 0n },
        { to: routerHub, data: swapCallData, value: 0n }
      ]
    });
  }, [sendGaslessUserOp]);

  /**
   * Check availability
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id) {
      return { available: false, reason: 'No chain connected' };
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      return { available: false, reason: `Chain ${chain.id} not supported` };
    }

    if (!isConnected || !address) {
      return { available: false, reason: 'Wallet not connected' };
    }

    const upgraded = await checkSmartAccountStatus();

    return {
      available: upgraded,
      chain: config.name,
      chainId: chain.id,
      explorer: config.explorer,
      isSmartAccount: upgraded,
      delegatorAddress: upgraded ? delegatorAddress : null,
      note: upgraded 
        ? '✅ EOA is 7702 upgraded - TRUE GASLESS available!'
        : '❌ EOA not upgraded - enable Smart Account in MetaMask first'
    };
  }, [chain?.id, isConnected, address, checkSmartAccountStatus, delegatorAddress]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setIsLoading(false);
  }, []);

  return {
    // Actions
    sendGaslessUserOp,
    executeGaslessApproval,
    executeGaslessBatch,
    checkAvailability,
    checkSmartAccountStatus,
    reset,

    // State
    status,
    statusMessage,
    error,
    txHash,
    userOpHash,
    isLoading,
    isSmartAccount,
    delegatorAddress,

    // Convenience
    isPreparing: status === STATUS.PREPARING,
    isSigning: status === STATUS.SIGNING,
    isSubmitting: status === STATUS.SUBMITTING,
    isConfirming: status === STATUS.CONFIRMING,
    isSuccess: status === STATUS.SUCCESS,
    isError: status === STATUS.ERROR,

    // Chain info
    chainId: chain?.id,
    supportedChains: CHAIN_CONFIG,
    STATUS,
    ENTRYPOINT_V07,
    METAMASK_DELEGATOR
  };
}

export { STATUS, CHAIN_CONFIG };
