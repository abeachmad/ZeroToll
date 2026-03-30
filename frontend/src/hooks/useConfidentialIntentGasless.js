import { useCallback, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { encryptUint128WithCofhe, getCofheSupportedChainIds } from '../lib/cofhe';
import contractsConfig from '../config/contracts.json';
import { getBackendUrl } from '../lib/runtimeUrls';

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api/confidential`;
const PERMIT2_ADDRESS = contractsConfig.permit2;

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

const parseStringResult = (hexValue, fallback = 'Token') => {
  try {
    const lengthHex = hexValue.slice(66, 130);
    const length = parseInt(lengthHex, 16);
    const hex = hexValue.slice(130, 130 + length * 2);
    return hex
      .match(/.{2}/g)
      .map((byte) => parseInt(byte, 16))
      .filter((code) => code > 0)
      .map((code) => String.fromCharCode(code))
      .join('');
  } catch {
    return fallback;
  }
};

const parsePermit2AllowanceResult = (result) => {
  if (!result || result === '0x') {
    return { amount: 0n, expiration: 0, nonce: 0 };
  }

  const hex = result.startsWith('0x') ? result.slice(2) : result;
  if (hex.length < 64 * 3) {
    return { amount: 0n, expiration: 0, nonce: 0 };
  }

  return {
    amount: BigInt(`0x${hex.slice(0, 64)}`),
    expiration: parseInt(`0x${hex.slice(64, 128)}`, 16),
    nonce: parseInt(`0x${hex.slice(128, 192)}`, 16),
  };
};

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

  const getPermit2Allowance = useCallback(async (tokenAddress, spender) => {
    if (!address || !walletClient) {
      return { amount: 0n, expiration: 0, nonce: 0 };
    }

    try {
      const userHex = address.slice(2).toLowerCase().padStart(64, '0');
      const tokenHex = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
      const spenderHex = spender.slice(2).toLowerCase().padStart(64, '0');
      const data = `0x927da105${userHex}${tokenHex}${spenderHex}`;
      const result = await walletClient.request({
        method: 'eth_call',
        params: [{ to: PERMIT2_ADDRESS, data }, 'latest'],
      });

      return parsePermit2AllowanceResult(result);
    } catch {
      return { amount: 0n, expiration: 0, nonce: 0 };
    }
  }, [address, walletClient]);

  const signPermit2 = useCallback(async ({ tokenAddress, spender, amount, deadline }) => {
    if (!address || !chainId || !walletClient) {
      throw new Error('Wallet connection is required for Permit2 signing.');
    }

    const { nonce } = await getPermit2Allowance(tokenAddress, spender);
    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        PermitSingle: [
          { name: 'details', type: 'PermitDetails' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
      },
      primaryType: 'PermitSingle',
      domain: {
        name: 'Permit2',
        chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      message: {
        details: {
          token: tokenAddress,
          amount: amount.toString(),
          expiration: deadline.toString(),
          nonce: nonce.toString(),
        },
        spender,
        sigDeadline: deadline.toString(),
      },
    };

    const signature = await walletClient.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)],
    });

    return {
      permitType: 'permit2',
      permitSingle: typedData.message,
      permit2Signature: signature,
    };
  }, [address, chainId, getPermit2Allowance, walletClient]);

  const signErc2612Permit = useCallback(async ({ tokenAddress, spender, amount, deadline }) => {
    if (!address || !chainId || !walletClient) {
      throw new Error('Wallet connection is required for permit signing.');
    }

    const nameResult = await walletClient.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: '0x06fdde03' }, 'latest'],
    });
    const tokenName = parseStringResult(nameResult, 'Token');

    const nonceCall = `0x7ecebe00000000000000000000000000${address.slice(2)}`;
    const nonceResult = await walletClient.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: nonceCall }, 'latest'],
    });
    const permitNonce = parseInt(nonceResult, 16);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      domain: {
        name: tokenName,
        version: '1',
        chainId,
        verifyingContract: tokenAddress,
      },
      message: {
        owner: address,
        spender,
        value: amount.toString(),
        nonce: permitNonce.toString(),
        deadline: deadline.toString(),
      },
    };

    const signature = await walletClient.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)],
    });

    const r = signature.slice(0, 66);
    const s = `0x${signature.slice(66, 130)}`;
    let v = parseInt(signature.slice(130, 132), 16);
    if (v < 27) v += 27;

    return {
      permitType: 'erc2612',
      permit: {
        deadline: deadline.toString(),
        v,
        r,
        s,
      },
    };
  }, [address, chainId, walletClient]);

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
    fundingMode = 'approval',
    fundingSpender,
  }) => {
    let commitment;
    let encryptedPayload;
    let clientEncryptionMode;
    let permitPayload = {};

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

    if ((fundingMode === 'permit2' || fundingMode === 'erc2612') && !fundingSpender) {
      throw new Error('Confidential escrow spender is not configured for signed funding.');
    }

    if (fundingMode === 'permit2') {
      permitPayload = await signPermit2({
        tokenAddress: tokenIn,
        spender: fundingSpender,
        amount: amountInUnits,
        deadline,
      });
    } else if (fundingMode === 'erc2612') {
      permitPayload = await signErc2612Permit({
        tokenAddress: tokenIn,
        spender: fundingSpender,
        amount: amountInUnits,
        deadline,
      });
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
        ...permitPayload,
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
  }, [address, publicClient, signErc2612Permit, signPermit2, walletClient]);

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
    fundingMode = 'approval',
    fundingSpender,
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
    setStatusMessage(
      fundingMode === 'permit2'
        ? 'Creating confidential minOut commitment and preparing Permit2 authorization...'
        : fundingMode === 'erc2612'
          ? 'Creating confidential minOut commitment and preparing ERC-2612 permit...'
          : 'Creating confidential minOut commitment in the browser...'
    );

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
        fundingMode,
        fundingSpender,
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
    signErc2612Permit,
    signPermit2,
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
