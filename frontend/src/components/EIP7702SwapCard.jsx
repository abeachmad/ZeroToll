/**
 * EIP-7702 Swap Card Component
 * 
 * Provides UI for EIP-7702 gasless swaps with 50% gas savings
 */

import React, { useState, useEffect } from 'react';
import { useEIP7702Swap } from '../hooks/useEIP7702Swap';
import { parseUnits, formatUnits } from 'viem';
import { useAccount } from 'wagmi';

// Token addresses by chain
const TOKENS = {
  80002: { // Amoy
    USDC: { address: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582', decimals: 6, symbol: 'USDC' },
    WPOL: { address: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9', decimals: 18, symbol: 'WPOL' }
  },
  11155111: { // Sepolia
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, symbol: 'USDC' },
    WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18, symbol: 'WETH' }
  }
};

export function EIP7702SwapCard() {
  const { address, chainId } = useAccount();
  const { 
    executeSwap, 
    getQuote, 
    loading, 
    error, 
    txHash, 
    isSupported,
    delegateAddress,
    gasSavings 
  } = useEIP7702Swap();

  const [amountIn, setAmountIn] = useState('1');
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Get tokens for current chain
  const tokens = TOKENS[chainId] || {};
  const tokenIn = Object.values(tokens)[0]; // First token (USDC)
  const tokenOut = Object.values(tokens)[1]; // Second token (WPOL/WETH)

  // Fetch quote when amount changes
  useEffect(() => {
    if (!amountIn || !tokenIn || !tokenOut || !isSupported) return;

    const fetchQuote = async () => {
      setLoadingQuote(true);
      try {
        const amount = parseUnits(amountIn, tokenIn.decimals);
        const quoteData = await getQuote({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: amount
        });
        setQuote(quoteData);
      } catch (err) {
        console.error('Quote error:', err);
      } finally {
        setLoadingQuote(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [amountIn, tokenIn, tokenOut, isSupported, getQuote]);

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut) return;

    try {
      const amount = parseUnits(amountIn, tokenIn.decimals);
      const minOut = quote ? BigInt(quote.amountOut) : 0n;

      await executeSwap({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amount,
        minAmountOut: minOut
      });
    } catch (err) {
      console.error('Swap failed:', err);
    }
  };

  if (!address) {
    return (
      <div className="eip7702-card">
        <h3>🚀 EIP-7702 Gasless Swap</h3>
        <p>Please connect your wallet</p>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="eip7702-card">
        <h3>🚀 EIP-7702 Gasless Swap</h3>
        <p>⚠️ EIP-7702 not supported on this network</p>
        <p>Switch to Polygon Amoy or Ethereum Sepolia</p>
      </div>
    );
  }

  return (
    <div className="eip7702-card" style={styles.card}>
      <div style={styles.header}>
        <h3>🚀 EIP-7702 Gasless Swap</h3>
        <span style={styles.badge}>50% Gas Savings</span>
      </div>

      <div style={styles.info}>
        <p><strong>Network:</strong> {chainId === 80002 ? 'Polygon Amoy' : 'Ethereum Sepolia'}</p>
        <p><strong>Delegate:</strong> {delegateAddress?.slice(0, 10)}...{delegateAddress?.slice(-8)}</p>
        <p><strong>Method:</strong> EIP-7702 (vs ERC-4337: {gasSavings} cheaper)</p>
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>From</label>
        <div style={styles.inputRow}>
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.0"
            style={styles.input}
            disabled={loading}
          />
          <span style={styles.token}>{tokenIn?.symbol}</span>
        </div>
      </div>

      <div style={styles.arrow}>↓</div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>To (estimated)</label>
        <div style={styles.inputRow}>
          <input
            type="text"
            value={
              loadingQuote 
                ? 'Loading...' 
                : quote 
                  ? formatUnits(BigInt(quote.amountOut), tokenOut?.decimals || 18)
                  : '0.0'
            }
            readOnly
            style={styles.input}
          />
          <span style={styles.token}>{tokenOut?.symbol}</span>
        </div>
      </div>

      {quote && (
        <div style={styles.quoteDetails}>
          <div style={styles.quoteRow}>
            <span>Fee (1% max):</span>
            <span>{formatUnits(BigInt(quote.fee), tokenIn?.decimals || 6)} {tokenIn?.symbol}</span>
          </div>
          <div style={styles.quoteRow}>
            <span>Gas Estimate:</span>
            <span>{quote.gasEstimate.toLocaleString()} gas</span>
          </div>
          <div style={styles.quoteRow}>
            <span>Gas Savings:</span>
            <span style={styles.savings}>{quote.gasSavings} vs ERC-4337 🎉</span>
          </div>
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={loading || loadingQuote || !quote}
        style={{
          ...styles.button,
          ...(loading || loadingQuote || !quote ? styles.buttonDisabled : {})
        }}
      >
        {loading ? 'Swapping...' : 'Execute Gasless Swap'}
      </button>

      {error && (
        <div style={styles.error}>
          ❌ Error: {error}
        </div>
      )}

      {txHash && (
        <div style={styles.success}>
          ✅ Swap successful!
          <br />
          <a 
            href={`${chainId === 80002 ? 'https://amoy.polygonscan.com' : 'https://sepolia.etherscan.io'}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            View on Explorer →
          </a>
        </div>
      )}

      <div style={styles.features}>
        <h4>✨ Features:</h4>
        <ul style={styles.featureList}>
          <li>✅ 50% gas savings vs ERC-4337</li>
          <li>✅ Truly gasless (no native token needed)</li>
          <li>✅ Trustless fee calculation on-chain</li>
          <li>✅ Native token output (unwraps automatically)</li>
          <li>✅ Works with any EOA wallet</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  card: {
    border: '2px solid #4CAF50',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    margin: '20px auto',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  badge: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  info: {
    backgroundColor: '#e8f5e9',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  inputGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    padding: '12px',
    fontSize: '18px',
    border: '1px solid #ddd',
    borderRadius: '8px'
  },
  token: {
    fontWeight: 'bold',
    fontSize: '16px',
    minWidth: '60px'
  },
  arrow: {
    textAlign: 'center',
    fontSize: '24px',
    margin: '12px 0'
  },
  quoteDetails: {
    backgroundColor: '#fff3e0',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  quoteRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  savings: {
    color: '#4CAF50',
    fontWeight: 'bold'
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: 'bold',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  },
  error: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '8px',
    fontSize: '14px'
  },
  success: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    borderRadius: '8px',
    fontSize: '14px'
  },
  link: {
    color: '#1976d2',
    textDecoration: 'underline'
  },
  features: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #ddd'
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '8px 0',
    fontSize: '14px'
  }
};
