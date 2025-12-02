import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useGasless7702 } from '../hooks/useGasless7702';
import { encodeFunctionData, parseUnits } from 'viem';

const TEST_TOKENS = {
  80002: {
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881'
  },
  11155111: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84'
  }
};

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
];

export default function TestSmartAccount() {
  const { address, chain, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const gasless = useGasless7702();
  const [testResult, setTestResult] = useState(null);

  const chainConfig = TEST_TOKENS[chain?.id];

  useEffect(() => {
    if (isConnected && address) {
      gasless.checkUpgradeStatus();
    }
  }, [isConnected, address, chain?.id]);

  const handleCheckStatus = async () => {
    try {
      setTestResult({ success: true, message: 'Checking 7702 status...' });
      const upgraded = await gasless.checkUpgradeStatus();
      setTestResult({
        success: true,
        message: upgraded
          ? '✅ EOA is 7702 upgraded! Ready for gasless transactions.'
          : '❌ EOA not upgraded. Enable Smart Account in MetaMask settings.',
        data: { isUpgraded: upgraded, address }
      });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
  };

  const handleGaslessApproval = async () => {
    if (!chainConfig) {
      setTestResult({ success: false, message: 'Chain not supported' });
      return;
    }

    try {
      setTestResult({ success: true, message: 'Sending gasless approval via Pimlico...' });

      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [chainConfig.routerHub, parseUnits('1', 6)]
      });

      const txHash = await gasless.executeGasless({
        to: chainConfig.USDC,
        data: approveData,
        value: 0n
      });

      if (txHash) {
        setTestResult({
          success: true,
          message: '🎉 GASLESS approval successful!',
          data: { txHash }
        });
      } else {
        setTestResult({
          success: false,
          message: gasless.error || 'Transaction failed'
        });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
  };

  if (!isConnected) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h2>EIP-7702 Gasless Transactions</h2>
        <p style={{ color: '#f59e0b' }}>Connect your wallet to continue</p>
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            style={{ padding: '1rem 2rem', margin: '0.5rem', cursor: 'pointer' }}
          >
            Connect {connector.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h2>EIP-7702 Gasless Transactions</h2>
      <p style={{ color: '#888' }}>Using MetaMask Smart Accounts Kit + Pimlico Paymaster</p>

      {/* Status Panel */}
      <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <div><strong>Chain:</strong> {chain?.name} ({chain?.id})</div>
        <div><strong>Address:</strong> <code style={{ fontSize: '0.8rem' }}>{address}</code></div>
        <div>
          <strong>7702 Status:</strong>{' '}
          <span style={{ color: gasless.isUpgraded ? '#22c55e' : '#ef4444' }}>
            {gasless.isUpgraded ? '✅ UPGRADED' : '❌ NOT UPGRADED'}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}
        >
          Disconnect
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={handleCheckStatus}
          disabled={gasless.isLoading}
          style={{ padding: '1rem' }}
        >
          1. Check 7702 Status
        </button>

        <button
          onClick={handleGaslessApproval}
          disabled={gasless.isLoading || !chainConfig || !gasless.isUpgraded}
          style={{
            padding: '1rem',
            background: gasless.isUpgraded ? '#22c55e' : '#666',
            cursor: !gasless.isUpgraded ? 'not-allowed' : 'pointer'
          }}
        >
          2. 🎉 GASLESS Approval (1 USDC) via Pimlico
        </button>

        <button
          onClick={() => { setTestResult(null); gasless.clearError(); }}
          style={{ padding: '1rem', background: '#444' }}
        >
          Clear Results
        </button>
      </div>

      {/* Loading State */}
      {gasless.isLoading && (
        <div style={{ background: '#1e3a5f', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
          ⏳ Processing via Pimlico bundler...
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div style={{
          background: testResult.success ? '#14532d' : '#7f1d1d',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div><strong>{testResult.success ? '✅ Success' : '❌ Error'}</strong></div>
          <div>{testResult.message}</div>
          {testResult.data && (
            <pre style={{ fontSize: '0.75rem', overflow: 'auto', marginTop: '0.5rem' }}>
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Transaction Hash */}
      {gasless.txHash && (
        <div style={{ background: '#14532d', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <div><strong>🎉 Transaction Confirmed!</strong></div>
          <a
            href={`${chain?.id === 80002 ? 'https://amoy.polygonscan.com' : 'https://sepolia.etherscan.io'}/tx/${gasless.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#22d3ee', wordBreak: 'break-all' }}
          >
            {gasless.txHash}
          </a>
        </div>
      )}

      {/* Error Display */}
      {gasless.error && (
        <div style={{ background: '#7f1d1d', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
          <div><strong>Error:</strong></div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{gasless.error}</div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.85rem' }}>
        <strong>How it works (per MetaMask Tutorial):</strong>
        <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li>Creates PaymasterClient pointing to Pimlico</li>
          <li>Creates BundlerClient with paymaster attached</li>
          <li>Creates MetaMaskSmartAccount (Stateless7702)</li>
          <li>Calls sendUserOperation - Pimlico sponsors gas!</li>
        </ol>
        <p style={{ color: '#22c55e', marginTop: '0.5rem' }}>
          ✅ This uses the CORRECT approach from MetaMask's official docs!
        </p>
      </div>
    </div>
  );
}
