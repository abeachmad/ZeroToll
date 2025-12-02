/**
 * usePimlico7702 Hook - EIP-7702 + ERC-4337 Gasless (Vite version)
 * 
 * Per Research.md:
 * - MetaMask blocks external dapps from signing 7702 authorizations directly
 * - Must use wallet_sendCalls (EIP-5792) which MetaMask handles internally
 * - For gasless, need to pass paymasterService capability (only works on some networks)
 * 
 * Workaround per Research.md:
 * "Use an external approach... by directly invoking the bundler via a library"
 * "libraries like Wagmi and thirdweb allow passing a paymasterService URL"
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseAbi } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const PIMLICO_API_KEY = import.meta.env.VITE_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const METAMASK_DELEGATOR = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B';

const CHAIN_CONFIG = {
  80002: {
    name: 'Polygon Amoy',
    chain: polygonAmoy,
    explorer: 'https://amoy.polygonscan.com',
    pimlicoUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://polygon-amoy.drpc.org'
  },
  11155111: {
    name: 'Ethereum Sepolia',
    chain: sepolia,
    explorer: 'https://sepolia.etherscan.io',
    pimlicoUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com'
  }
};

const STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  SIGNING: 'signing',
  CONFIRMING: 'confirming',
  SUCCESS: 'success',
  ERROR: 'error'
};

export function usePimlico7702() {
  const { address, chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [userOpHash, setUserOpHash] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSmartAccount, setIsSmartAccount] = useState(false);
  const [delegatorAddress, setDelegatorAddress] = useState(null);

  const checkSmartAccountStatus = useCallback(async () => {
    if (!address || !chain?.id) return false;
    const config = CHAIN_CONFIG[chain.id];
    if (!config) return false;

    try {
      const response = await fetch(config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'eth_getCode',
          params: [address, 'latest']
        })
      });
      const data = await response.json();
      const code = data.result;
      
      if (code && code !== '0x' && code.startsWith('0xef0100')) {
        const delegator = '0x' + code.substring(8, 48);
        console.log('✅ EOA is 7702 upgraded, Delegator:', delegator);
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
  }, [address, chain?.id]);

  useEffect(() => {
    if (address && chain?.id) {
      checkSmartAccountStatus();
    }
  }, [address, chain?.id, checkSmartAccountStatus]);

  /**
   * Send transaction using wallet_sendCalls (EIP-5792)
   * This is the MetaMask-native way that works with 7702 accounts
   * 
   * Per Research.md: "MetaMask will prompt the user... to 'Use smart account'"
   * and handles the batching internally
   */
  const sendGaslessUserOp = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      throw new Error(`Chain ${chain.id} not supported`);
    }

    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setStatus(STATUS.PREPARING);
    setIsLoading(true);

    try {
      console.log('🎯 Sending via wallet_sendCalls (EIP-5792)');
      console.log('   Chain:', config.name, '| EOA:', address);
      console.log('   Calls:', calls.length);

      setStatusMessage('Preparing transaction...');

      // Format calls for wallet_sendCalls
      const formattedCalls = calls.map(c => ({
        to: c.to,
        value: c.value ? `0x${c.value.toString(16)}` : '0x0',
        data: c.data || '0x'
      }));

      setStatus(STATUS.SIGNING);
      setStatusMessage('Please approve in MetaMask...');

      // Use wallet_sendCalls (EIP-5792)
      // MetaMask handles the smart account internally
      // Per Research.md: "if your dapp tries to batch multiple token transfers... 
      // MetaMask detects it and shows a 'Use smart account' prompt"
      const result = await walletClient.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0.0',
          chainId: `0x${chain.id.toString(16)}`,
          from: address,
          calls: formattedCalls,
          // Try to use paymaster (may not be supported on testnets)
          capabilities: {
            paymasterService: {
              url: config.pimlicoUrl
            }
          }
        }]
      });

      console.log('✅ wallet_sendCalls result:', result);
      
      // Result is a bundle ID
      setUserOpHash(result);
      setStatus(STATUS.CONFIRMING);
      setStatusMessage('Waiting for confirmation...');

      // Poll for status using wallet_getCallsStatus
      let receipt = null;
      const startTime = Date.now();
      const timeout = 120000;

      while (!receipt && Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 3000));
        
        try {
          const statusResult = await walletClient.request({
            method: 'wallet_getCallsStatus',
            params: [result]
          });
          
          console.log('📊 Status:', statusResult);
          
          if (statusResult.status === 'CONFIRMED') {
            receipt = statusResult;
            if (statusResult.receipts?.[0]?.transactionHash) {
              setTxHash(statusResult.receipts[0].transactionHash);
            }
          }
        } catch (err) {
          console.log('Waiting for confirmation...');
        }
      }

      setStatus(STATUS.SUCCESS);
      setStatusMessage('🎉 Transaction successful!');

      return {
        success: true,
        txHash: receipt?.receipts?.[0]?.transactionHash,
        bundleId: result,
        explorerUrl: receipt?.receipts?.[0]?.transactionHash 
          ? `${config.explorer}/tx/${receipt.receipts[0].transactionHash}`
          : null
      };

    } catch (err) {
      console.error('❌ Error:', err);
      
      let errorMessage = err.message;
      
      // Check if paymaster not supported
      if (err.message?.includes('paymasterService') || err.code === 5710) {
        errorMessage = 
          'Paymaster not supported on this network by MetaMask.\n' +
          'Per Research.md: MetaMask only advertises paymasterService support on certain networks.\n' +
          'You will need to pay gas for this transaction.';
      } else if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction cancelled by user';
      }

      setError(errorMessage);
      setStatus(STATUS.ERROR);
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, walletClient]);

  const executeGaslessApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });
    return sendGaslessUserOp({ calls: [{ to: tokenAddress, data: approveData, value: 0n }] });
  }, [sendGaslessUserOp]);

  const checkAvailability = useCallback(async () => {
    if (!chain?.id) return { available: false, reason: 'No chain connected' };
    const config = CHAIN_CONFIG[chain.id];
    if (!config) return { available: false, reason: `Chain ${chain.id} not supported` };
    if (!isConnected || !address) return { available: false, reason: 'Wallet not connected' };

    const upgraded = await checkSmartAccountStatus();
    return {
      available: upgraded,
      chain: config.name,
      chainId: chain.id,
      isSmartAccount: upgraded,
      delegatorAddress: upgraded ? delegatorAddress : null,
      note: upgraded 
        ? '✅ Smart Account ready! (Note: Gasless may require gas on testnets per Research.md)'
        : '❌ Enable Smart Account in MetaMask first'
    };
  }, [chain?.id, isConnected, address, checkSmartAccountStatus, delegatorAddress]);

  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setIsLoading(false);
  }, []);

  return {
    sendGaslessUserOp,
    executeGaslessApproval,
    checkAvailability,
    checkSmartAccountStatus,
    reset,
    status, statusMessage, error, txHash, userOpHash, isLoading,
    isSmartAccount, delegatorAddress,
    isPreparing: status === STATUS.PREPARING,
    isSigning: status === STATUS.SIGNING,
    isSuccess: status === STATUS.SUCCESS,
    isError: status === STATUS.ERROR,
    chainId: chain?.id,
    CHAIN_CONFIG, STATUS, METAMASK_DELEGATOR
  };
}

export { STATUS, CHAIN_CONFIG };
