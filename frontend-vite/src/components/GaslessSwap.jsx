/**
 * GaslessSwap - Component for gasless token swaps
 * 
 * User approves tokens (one-time, pays gas), then signs EIP-712 intent (no gas).
 * Backend relayer submits swap tx and pays gas.
 */
import { useState, useEffect } from 'react';
import { useGaslessSwap } from '../hooks/useGaslessSwap';

// Tokens on Sepolia with routing info
const SEPOLIA_TOKENS = {
  'ZTA (Gasless)': '0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf',  // ERC-2612 Permit - fully gasless
  'ZTB (Gasless)': '0x8fb844251af76AF090B005643D966FC52852100a',  // ERC-2612 Permit - fully gasless
  'pWETH (Gasless)': '0x3af00011Da61751bc58DFfDD0F9F85F69301E180', // Permit-wrapped WETH
  'pUSDC (Gasless)': '0xD6a7294445F34d0F7244b2072696106904ea807B', // Permit-wrapped USDC
  'WETH': '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',           // Native WETH (needs Permit2)
  'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'            // Native USDC (needs Permit2)
};

const AMOY_TOKENS = {
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
};

const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

// ZeroToll test tokens (support ERC-2612 Permit - fully gasless!)
const ZTA_ADDRESS = '0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf';
const ZTB_ADDRESS = '0x8fb844251af76AF090B005643D966FC52852100a';

export function GaslessSwap() {
  const {
    account, chainId, isConnected, isConnecting, error, config, isSupportedChain,
    connect, disconnect, submitSwap, submitSwapWithPermit, submitSwapWithPermit2, checkStatus, 
    checkAllowance, approveToken, checkPermit2Allowance, approveToPermit2,
    claimFaucet, getTokenBalance
  } = useGaslessSwap();

  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amountIn, setAmountIn] = useState('1000000000000000000');
  const [minAmountOut, setMinAmountOut] = useState('900000000000000000');
  const [status, setStatus] = useState('');
  const [txResult, setTxResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allowance, setAllowance] = useState(BigInt(0));
  const [permit2Allowance, setPermit2Allowance] = useState(BigInt(0));
  const [isApproving, setIsApproving] = useState(false);
  const [ztaBalance, setZtaBalance] = useState(BigInt(0));
  const [ztbBalance, setZtbBalance] = useState(BigInt(0));
  const [isClaiming, setIsClaiming] = useState(false);

  const tokens = chainId === 11155111 ? SEPOLIA_TOKENS : AMOY_TOKENS;
  
  // Permit2 address
  const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

  // Check ZTA/ZTB balances
  useEffect(() => {
    if (isConnected && chainId === 11155111) {
      getTokenBalance(ZTA_ADDRESS).then(setZtaBalance);
      getTokenBalance(ZTB_ADDRESS).then(setZtbBalance);
    }
  }, [isConnected, chainId, getTokenBalance, account]);

  // Permit-enabled tokens (fully gasless)
  const PERMIT_TOKENS = [
    ZTA_ADDRESS,
    ZTB_ADDRESS,
    '0x3af00011Da61751bc58DFfDD0F9F85F69301E180', // pWETH
    '0xD6a7294445F34d0F7244b2072696106904ea807B'  // pUSDC
  ];
  
  // Check if selected token supports ERC-2612 Permit
  const isPermitToken = PERMIT_TOKENS.includes(tokenIn);
  
  // Check if token uses Uniswap routing (native WETH/USDC)
  const isUniswapToken = tokenIn === '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' || 
                         tokenIn === '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

  // Check allowances when tokenIn changes
  useEffect(() => {
    if (tokenIn && isConnected && config) {
      checkAllowance(tokenIn).then(setAllowance);
      // Check if token is approved to Permit2
      const checkP2 = async () => {
        const ownerHex = account.slice(2).toLowerCase().padStart(64, '0');
        const spenderHex = PERMIT2.slice(2).toLowerCase().padStart(64, '0');
        const data = `0xdd62ed3e${ownerHex}${spenderHex}`;
        try {
          const result = await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: tokenIn, data }, 'latest']
          });
          setPermit2Allowance(BigInt(result));
        } catch (e) {
          setPermit2Allowance(BigInt(0));
        }
      };
      checkP2();
    }
  }, [tokenIn, isConnected, config, checkAllowance, account]);

  const needsApproval = tokenIn && allowance < BigInt(amountIn || 0);
  const needsPermit2Approval = tokenIn && permit2Allowance < BigInt(amountIn || 0);

  const handleApprove = async () => {
    if (!tokenIn) return;
    setIsApproving(true);
    setStatus('Approving token... (this requires gas)');
    
    try {
      const txHash = await approveToken(tokenIn, MAX_UINT256);
      setStatus(`Approval submitted: ${txHash.slice(0, 10)}... Waiting for confirmation...`);
      
      // Wait for confirmation
      await new Promise(r => setTimeout(r, 15000));
      const newAllowance = await checkAllowance(tokenIn);
      setAllowance(newAllowance);
      setStatus('✓ Token approved! Now you can swap gaslessly.');
    } catch (err) {
      setStatus(`Approval failed: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleClaimFaucet = async (tokenAddr, tokenName) => {
    setIsClaiming(true);
    setStatus(`Claiming ${tokenName} from faucet... (requires gas)`);
    
    try {
      const txHash = await claimFaucet(tokenAddr);
      setStatus(`Faucet tx: ${txHash.slice(0, 10)}... Waiting...`);
      await new Promise(r => setTimeout(r, 15000));
      
      // Refresh balances
      getTokenBalance(ZTA_ADDRESS).then(setZtaBalance);
      getTokenBalance(ZTB_ADDRESS).then(setZtbBalance);
      setStatus(`✓ Got 1000 ${tokenName}! Now try a gasless swap.`);
    } catch (err) {
      setStatus(`Faucet failed: ${err.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const handlePermitSwap = async () => {
    if (!tokenIn || !tokenOut) {
      setStatus('Please select tokens');
      return;
    }

    // Check balance first
    const balance = await getTokenBalance(tokenIn);
    if (balance < BigInt(amountIn)) {
      setStatus(`❌ Insufficient balance! You have ${(Number(balance) / 1e18).toFixed(4)} tokens but trying to swap ${(Number(amountIn) / 1e18).toFixed(4)}`);
      return;
    }

    setIsProcessing(true);
    setStatus('Sign Permit + Swap Intent in MetaMask (NO GAS!)...');
    setTxResult(null);

    try {
      const result = await submitSwapWithPermit({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes: 30 });
      setTxResult(result);
      setStatus('✓ Gasless swap submitted! Waiting for confirmation...');

      // Poll for status
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusResult = await checkStatus(result.requestId);
        if (statusResult.status === 'confirmed') {
          setStatus('✓ Swap confirmed! You paid ZERO gas!');
          setTxResult(prev => ({ ...prev, ...statusResult }));
          // Refresh balances
          getTokenBalance(ZTA_ADDRESS).then(setZtaBalance);
          getTokenBalance(ZTB_ADDRESS).then(setZtbBalance);
          return;
        } else if (statusResult.status === 'failed') {
          setStatus('✗ Swap failed on-chain');
          return;
        }
      }
      setStatus('Timeout - check explorer');
    } catch (err) {
      console.error('Permit swap error:', err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprovePermit2 = async () => {
    if (!tokenIn) return;
    setIsApproving(true);
    setStatus('Approving token to Permit2... (one-time gas payment)');
    
    try {
      const txHash = await approveToPermit2(tokenIn);
      setStatus(`Approval submitted: ${txHash.slice(0, 10)}... Waiting for confirmation...`);
      
      await new Promise(r => setTimeout(r, 15000));
      // Refresh Permit2 allowance
      const ownerHex = account.slice(2).toLowerCase().padStart(64, '0');
      const spenderHex = PERMIT2.slice(2).toLowerCase().padStart(64, '0');
      const data = `0xdd62ed3e${ownerHex}${spenderHex}`;
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: tokenIn, data }, 'latest']
      });
      setPermit2Allowance(BigInt(result));
      setStatus('✓ Token approved to Permit2! Now you can swap fully gasless.');
    } catch (err) {
      setStatus(`Approval failed: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handlePermit2Swap = async () => {
    if (!tokenIn || !tokenOut) {
      setStatus('Please select tokens');
      return;
    }

    // Check balance first
    const balance = await getTokenBalance(tokenIn);
    if (balance < BigInt(amountIn)) {
      setStatus(`❌ Insufficient balance! You have ${(Number(balance) / 1e18).toFixed(4)} tokens. Get WETH by wrapping Sepolia ETH.`);
      return;
    }

    setIsProcessing(true);
    setStatus('Step 1/2: Sign Permit2 in MetaMask (no gas)...');
    setTxResult(null);

    try {
      const result = await submitSwapWithPermit2({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes: 30 });
      setTxResult(result);
      setStatus('✓ Fully gasless swap submitted via Permit2! Waiting for confirmation...');

      // Poll for status
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusResult = await checkStatus(result.requestId);
        if (statusResult.status === 'confirmed') {
          setStatus('✓ Swap confirmed! You paid ZERO gas!');
          setTxResult(prev => ({ ...prev, ...statusResult }));
          return;
        } else if (statusResult.status === 'failed') {
          setStatus('✗ Swap failed on-chain');
          return;
        }
      }
      setStatus('Timeout - check explorer for status');
    } catch (err) {
      console.error('Permit2 swap error:', err);
      if (err.message.includes('User rejected') || err.message.includes('denied')) {
        setStatus('Cancelled by user');
      } else {
        setStatus(`Error: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFullyGasless = async () => {
    if (!tokenIn || !tokenOut) {
      setStatus('Please select tokens');
      return;
    }

    setIsProcessing(true);
    setStatus('Step 1/2: Sign PERMIT in MetaMask (no gas)...');
    setTxResult(null);

    try {
      const result = await submitSwapWithPermit({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes: 30 });
      setTxResult(result);
      setStatus('✓ Fully gasless swap submitted! Waiting for confirmation...');

      // Poll for status
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusResult = await checkStatus(result.requestId);
        if (statusResult.status === 'confirmed') {
          setStatus('✓ Fully gasless swap confirmed! You paid ZERO gas!');
          setTxResult(prev => ({ ...prev, ...statusResult }));
          // Refresh allowance
          const newAllowance = await checkAllowance(tokenIn);
          setAllowance(newAllowance);
          return;
        } else if (statusResult.status === 'failed') {
          setStatus('✗ Swap failed on-chain (token may not support ERC-2612 Permit)');
          return;
        }
      }
      setStatus('Timeout - check explorer for status');
    } catch (err) {
      console.error('Fully gasless error:', err);
      if (err.message.includes('User rejected') || err.message.includes('denied')) {
        setStatus('Cancelled by user');
      } else {
        setStatus(`Error: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut) {
      setStatus('Please select tokens');
      return;
    }

    if (needsApproval) {
      setStatus('Please approve the token first');
      return;
    }

    setIsProcessing(true);
    setStatus('Please sign the swap intent in MetaMask (NO GAS!)...');
    setTxResult(null);

    try {
      const result = await submitSwap({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes: 30 });
      setTxResult(result);
      setStatus('✓ Swap submitted! Waiting for confirmation...');

      // Poll for status
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusResult = await checkStatus(result.requestId);
        if (statusResult.status === 'confirmed') {
          setStatus('✓ Swap confirmed!');
          setTxResult(prev => ({ ...prev, ...statusResult }));
          return;
        } else if (statusResult.status === 'failed') {
          setStatus('✗ Swap failed on-chain');
          return;
        }
      }
      setStatus('Timeout - check explorer for status');
    } catch (err) {
      console.error('Swap error:', err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
  const getChainName = () => chainId === 11155111 ? 'Sepolia' : chainId === 80002 ? 'Polygon Amoy' : 'Unknown';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🚀 ZeroToll Gasless Swap</h1>
      <p style={styles.subtitle}>Approve once to Permit2 → Sign intents forever (no gas)</p>

      <div style={styles.infoBox}>
        <strong>🚀 Gasless Swap Options</strong>
        <ul style={{...styles.list, listStyle: 'none', paddingLeft: '0', margin: '8px 0'}}>
          <li>⚡ <b>ZTA/ZTB</b>: 100% gasless (use faucet below)</li>
          <li>⚡ <b>pWETH/pUSDC</b>: Permit-wrapped tokens (wrap once, gasless forever)</li>
          <li>🦄 <b>WETH/USDC</b>: Native tokens (need Permit2 approval once)</li>
        </ul>
        <p style={{margin: '5px 0 0 0', fontSize: '11px', color: '#2e7d32', fontWeight: 'bold'}}>
          💡 Best: Use ZTA/ZTB or pWETH/pUSDC for fully gasless swaps!
        </p>
      </div>

      <hr style={styles.divider} />

      {!isConnected ? (
        <button onClick={connect} disabled={isConnecting} style={styles.button}>
          {isConnecting ? 'Connecting...' : '🦊 Connect MetaMask'}
        </button>
      ) : (
        <div>
          <table style={styles.table}>
            <tbody>
              <tr><td style={styles.labelCell}>Account</td><td style={styles.valueCell}>{formatAddress(account)}</td></tr>
              <tr><td style={styles.labelCell}>Chain</td><td style={styles.valueCell}>{chainId} - {getChainName()}</td></tr>
              <tr><td style={styles.labelCell}>ZTA Balance</td><td style={styles.valueCell}>{(Number(ztaBalance) / 1e18).toFixed(2)}</td></tr>
              <tr><td style={styles.labelCell}>ZTB Balance</td><td style={styles.valueCell}>{(Number(ztbBalance) / 1e18).toFixed(2)}</td></tr>
            </tbody>
          </table>

          {chainId === 11155111 && (ztaBalance === BigInt(0) || ztbBalance === BigInt(0)) && (
            <div style={styles.faucetBox}>
              <strong>🚰 Get Free Test Tokens:</strong>
              <div style={styles.faucetButtons}>
                <button onClick={() => handleClaimFaucet(ZTA_ADDRESS, 'ZTA')} disabled={isClaiming} style={styles.faucetButton}>
                  {isClaiming ? '...' : 'Get ZTA'}
                </button>
                <button onClick={() => handleClaimFaucet(ZTB_ADDRESS, 'ZTB')} disabled={isClaiming} style={styles.faucetButton}>
                  {isClaiming ? '...' : 'Get ZTB'}
                </button>
              </div>
              <p style={{fontSize: '11px', color: '#666', margin: '5px 0 0 0'}}>Faucet requires gas, but swaps are FREE!</p>
            </div>
          )}

          <hr style={styles.divider} />

          {!isSupportedChain ? (
            <div style={styles.warning}>Switch to Sepolia or Polygon Amoy testnet.</div>
          ) : (
            <div>
              <h3>Swap Tokens</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Token In:</label>
                <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value)} style={styles.select}>
                  <option value="">Select token</option>
                  {Object.entries(tokens).map(([name, addr]) => (
                    <option key={addr} value={addr}>{name}</option>
                  ))}
                </select>
              </div>

              {tokenIn && (
                <div style={styles.allowanceBox}>
                  Allowance: {allowance > BigInt(1e30) ? '∞ (approved)' : allowance.toString()}
                  {needsApproval && <span style={styles.warningText}> - Needs approval!</span>}
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Token Out:</label>
                <select value={tokenOut} onChange={(e) => setTokenOut(e.target.value)} style={styles.select}>
                  <option value="">Select token</option>
                  {Object.entries(tokens).map(([name, addr]) => (
                    <option key={addr} value={addr}>{name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Amount In (wei):</label>
                <input type="text" value={amountIn} onChange={(e) => setAmountIn(e.target.value)} style={styles.input} />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Min Amount Out (wei):</label>
                <input type="text" value={minAmountOut} onChange={(e) => setMinAmountOut(e.target.value)} style={styles.input} />
              </div>

              <div style={styles.buttonGroup}>
                {/* Best option: ERC-2612 Permit for ZTA/ZTB - FULLY GASLESS */}
                {isPermitToken ? (
                  <>
                    <button onClick={handlePermitSwap} disabled={isProcessing || !tokenIn || !tokenOut} style={styles.permitButton}>
                      {isProcessing ? 'Processing...' : '⚡ SWAP (ZERO GAS!)'}
                    </button>
                    <p style={styles.successHint}>
                      ✓ ZTA/ZTB support ERC-2612 Permit - sign twice, pay ZERO gas!
                    </p>
                  </>
                ) : (
                  <>
                    {/* Fallback: Permit2 for other tokens */}
                    {needsPermit2Approval ? (
                      <button onClick={handleApprovePermit2} disabled={isApproving || isProcessing} style={styles.permit2ApproveButton}>
                        {isApproving ? 'Approving...' : '1️⃣ Approve to Permit2 (one-time gas)'}
                      </button>
                    ) : (
                      <button onClick={handlePermit2Swap} disabled={isProcessing || !tokenIn || !tokenOut} style={styles.permit2Button}>
                        {isProcessing ? 'Processing...' : '⚡ Swap via Permit2'}
                      </button>
                    )}
                    <p style={styles.hint}>
                      {needsPermit2Approval 
                        ? '⚠️ WETH/USDC need one-time Permit2 approval (gas required). After that, all swaps are gasless!' 
                        : '✓ Permit2 approved! All swaps are now gasless.'}
                    </p>

                    <div style={styles.orDivider}>— OR (Traditional) —</div>

                    {needsApproval ? (
                      <button onClick={handleApprove} disabled={isApproving || isProcessing} style={styles.approveButton}>
                        {isApproving ? 'Approving...' : 'Approve to Router (gas)'}
                      </button>
                    ) : (
                      <button onClick={handleSwap} disabled={isProcessing || !tokenIn || !tokenOut} style={styles.swapButton}>
                        {isProcessing ? 'Processing...' : '✅ Swap'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {status && (
                <div style={status.includes('Error') || status.includes('✗') || status.includes('failed') ? styles.errorBox : styles.statusBox}>
                  {status}
                </div>
              )}

              {txResult?.txHash && (
                <div style={styles.successBox}>
                  <p>Tx: {formatAddress(txResult.txHash)}</p>
                  <a href={txResult.explorerUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    View on Explorer →
                  </a>
                </div>
              )}
            </div>
          )}

          <hr style={styles.divider} />
          <button onClick={disconnect} style={styles.disconnectButton}>Disconnect</button>
        </div>
      )}

      {error && <div style={styles.errorBox}>Error: {error}</div>}
    </div>
  );
}

const styles = {
  container: { maxWidth: '550px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' },
  title: { margin: '0 0 5px 0', fontSize: '28px' },
  subtitle: { margin: '0 0 20px 0', color: '#666', fontSize: '14px' },
  infoBox: { background: '#f0f7ff', padding: '15px', borderRadius: '8px', fontSize: '14px' },
  list: { margin: '10px 0 0 0', paddingLeft: '20px' },
  divider: { border: 'none', borderTop: '1px solid #e0e0e0', margin: '20px 0' },
  button: { background: '#037DD6', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', width: '100%' },
  approveButton: { background: '#FF9800', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
  permitButton: { background: '#4CAF50', color: 'white', border: 'none', padding: '16px 28px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer', width: '100%', fontWeight: 'bold' },
  permit2Button: { background: '#2196F3', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', width: '100%', fontWeight: 'bold' },
  permit2ApproveButton: { background: '#03A9F4', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
  faucetBox: { background: '#fff3e0', padding: '12px', borderRadius: '8px', marginTop: '10px' },
  faucetButtons: { display: 'flex', gap: '10px', marginTop: '8px' },
  faucetButton: { background: '#FF9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', flex: 1 },
  successHint: { fontSize: '13px', color: '#2e7d32', marginTop: '8px', textAlign: 'center', fontWeight: '500' },
  swapButton: { background: '#4CAF50', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', width: '100%' },
  disconnectButton: { background: '#888', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  buttonGroup: { marginTop: '15px' },
  orDivider: { textAlign: 'center', color: '#999', margin: '12px 0', fontSize: '13px' },
  hint: { fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' },
  labelCell: { padding: '8px 0', color: '#666', width: '100px' },
  valueCell: { padding: '8px 0', fontFamily: 'monospace', fontSize: '13px' },
  formGroup: { marginBottom: '15px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: '500' },
  select: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' },
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'monospace', fontSize: '13px', boxSizing: 'border-box' },
  allowanceBox: { background: '#f5f5f5', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '15px', fontFamily: 'monospace' },
  warning: { background: '#fff3e0', padding: '12px', borderRadius: '8px', color: '#e65100' },
  warningText: { color: '#e65100', fontWeight: 'bold' },
  statusBox: { marginTop: '15px', padding: '12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '14px' },
  successBox: { marginTop: '15px', padding: '12px', background: '#e8f5e9', borderRadius: '8px' },
  errorBox: { marginTop: '15px', padding: '12px', background: '#ffebee', borderRadius: '8px', color: '#c62828' },
  link: { color: '#2e7d32', textDecoration: 'none', fontWeight: 'bold' }
};

export default GaslessSwap;
