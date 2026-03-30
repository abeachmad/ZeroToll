import { useCallback, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { encryptUint128WithCofhe, getCofheSupportedChainIds } from '../lib/cofhe';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api/confidential`;

const SUPPORTED_CHAINS = new Set(getCofheSupportedChainIds());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toHex = (buffer) =>
  `0x${Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;

const buildCommitmentMessage = ({
  user,
  chainId,
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
  deadline,
  nonce,
}) =>
  JSON.stringify({
    protocol: 'ZeroToll Confidential Gasless Intent',
    version: 'scaffold-v1',
    user: user?.toLowerCase(),
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    deadline,
    nonce,
  });

async function hashCommitment(payload) {
  const message = buildCommitmentMessage(payload);
  if (!window?.crypto?.subtle) {
    throw new Error('Browser crypto is unavailable for commitment hashing.');
  }
  const encoded = new TextEncoder().encode(message);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

export function useConfidentialIntentGasless() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [intentId, setIntentId] = useState(null);
  const [quote, setQuote] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);

  const isSupported = useMemo(
    () => Boolean(chainId && SUPPORTED_CHAINS.has(chainId)),
    [chainId]
  );

  const getQuote = useCallback(async ({
    user,
    tokenIn,
    tokenOut,
    amountIn,
    srcChainId,
    dstChainId,
    feeMode,
    feeCap,
  }) => {
    const response = await fetch(`${API}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user,
        tokenIn,
        tokenOut,
        amountIn,
        srcChainId,
        dstChainId,
        feeMode,
        feeCap,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to get confidential quote.');
    }

    setQuote(data);
    return data;
  }, []);

  const fetchStatus = useCallback(async (currentIntentId) => {
    if (!currentIntentId) {
      return null;
    }

    const response = await fetch(`${API}/status/${currentIntentId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to fetch confidential status.');
    }

    setLastStatus(data);
    setStatus(data.stage);
    setStatusMessage(data.statusMessage || '');
    return data;
  }, []);

  const submitIntent = useCallback(async ({
    tokenIn,
    tokenOut,
    amountIn,
    amountInUnits,
    quotedAmountOut,
    quotedAmountOutUnits,
    estimatedFeeToken,
    estimatedFeeTokenUnits,
    minAmountOut,
    minAmountOutUnits,
    srcChainId,
    dstChainId,
    feeMode,
    feeCap,
    deadline,
    nonce,
  }) => {
    let commitment;
    let encryptedPayload;
    let clientEncryptionMode;

    if (SUPPORTED_CHAINS.has(srcChainId)) {
      const encrypted = await encryptUint128WithCofhe({
        chainId: srcChainId,
        account: address,
        publicClient,
        walletClient,
        value: minAmountOutUnits,
      });

      commitment = encrypted.commitment;
      encryptedPayload = {
        kind: 'cofhe_sdk_v0_4',
        sdkVersion: '0.4.0',
        encryptedInput: encrypted.input,
        note: 'Real CoFHE browser encryption for confidential minOut.',
      };
      clientEncryptionMode = encrypted.mode;
    } else {
      commitment = await hashCommitment({
        user: address,
        chainId: srcChainId,
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        deadline,
        nonce,
      });

      encryptedPayload = {
        kind: 'commitment_only_scaffold',
        commitment,
        algorithm: 'SHA-256',
        note: 'Client-side commitment scaffold. Full Fhenix ciphertext wiring is the next step.',
      };
      clientEncryptionMode = 'commitment_only_scaffold';
    }

    const response = await fetch(`${API}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: address,
        tokenIn,
        tokenOut,
        amountIn,
        amountInUnits,
        quotedAmountOut,
        quotedAmountOutUnits,
        estimatedFeeToken,
        estimatedFeeTokenUnits,
        srcChainId,
        dstChainId,
        feeMode,
        feeCap,
        deadline,
        nonce,
        encryptedMinOutCommitment: commitment,
        encryptedPayload,
        clientEncryptionMode,
        clientGuardrailBps: 9500,
        plaintextMinOutForTesting: String(minAmountOutUnits),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to submit confidential intent.');
    }

    setIntentId(data.intentId);
    setStatus(data.stage);
    setStatusMessage(data.statusMessage || '');
    return data;
  }, [address, publicClient, walletClient]);

  const executeIntent = useCallback(async (currentIntentId) => {
    const response = await fetch(`${API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intentId: currentIntentId }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to execute confidential intent.');
    }

    setStatus(data.stage);
    setStatusMessage(data.statusMessage || '');
    setLastStatus(data);
    return data;
  }, []);

  const finalizeIntent = useCallback(async (currentIntentId) => {
    const response = await fetch(`${API}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intentId: currentIntentId }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to finalize confidential intent.');
    }

    setStatus(data.stage);
    setStatusMessage(data.statusMessage || '');
    setLastStatus(data);
    return data;
  }, []);

  const executeConfidentialSwap = useCallback(async ({
    tokenIn,
    tokenOut,
    amountIn,
    amountInUnits,
    quotedAmountOut,
    quotedAmountOutUnits,
    estimatedFeeToken,
    estimatedFeeTokenUnits,
    minAmountOut,
    minAmountOutUnits,
    srcChainId,
    dstChainId,
    feeMode = 'OUTPUT',
    feeCap = '3',
  }) => {
    if (!isConnected || !address) {
      throw new Error('Please connect your wallet first.');
    }

    if (!SUPPORTED_CHAINS.has(srcChainId)) {
      throw new Error('Confidential Gasless Intent currently uses Fhenix on Sepolia only.');
    }

    setIsLoading(true);
    setError(null);
    setStatus('encrypting');
    setStatusMessage('Creating confidential minOut commitment in the browser...');

    try {
      const deadline = Math.floor(Date.now() / 1000) + 30 * 60;
      const nonce = Date.now();

      const submitResult = await submitIntent({
        tokenIn,
        tokenOut,
        amountIn,
        amountInUnits,
        quotedAmountOut,
        quotedAmountOutUnits,
        estimatedFeeToken,
        estimatedFeeTokenUnits,
        minAmountOut,
        minAmountOutUnits,
        srcChainId,
        dstChainId,
        feeMode,
        feeCap,
        deadline,
        nonce,
      });

      setStatusMessage('Intent committed. Requesting sponsored execution...');
      await executeIntent(submitResult.intentId);

      for (let attempt = 0; attempt < 12; attempt += 1) {
        await sleep(1500);
        const currentStatus = await fetchStatus(submitResult.intentId);

        if (currentStatus?.stage === 'ready_to_finalize' || currentStatus?.decryptionReady) {
          setStatusMessage('Decryption ready. Finalizing confidential settlement...');
          const finalizeResult = await finalizeIntent(submitResult.intentId);
          return {
            intentId: submitResult.intentId,
            ...finalizeResult,
          };
        }

        if (currentStatus?.stage === 'finalized_success' || currentStatus?.stage === 'refunded') {
          return {
            intentId: submitResult.intentId,
            ...currentStatus,
          };
        }
      }

      const finalStatus = await fetchStatus(submitResult.intentId);
      return {
        intentId: submitResult.intentId,
        ...finalStatus,
      };
    } catch (executionError) {
      setError(executionError);
      setStatus('failed');
      setStatusMessage(executionError.message || 'Confidential execution failed.');
      throw executionError;
    } finally {
      setIsLoading(false);
    }
  }, [
    address,
    executeIntent,
    fetchStatus,
    finalizeIntent,
    isConnected,
    publicClient,
    submitIntent,
    walletClient,
  ]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setStatus(null);
    setStatusMessage('');
    setIntentId(null);
    setQuote(null);
    setLastStatus(null);
  }, []);

  return {
    isSupported,
    isLoading,
    error,
    status,
    statusMessage,
    intentId,
    quote,
    lastStatus,
    getQuote,
    fetchStatus,
    executeConfidentialSwap,
    finalizeIntent,
    reset,
  };
}
