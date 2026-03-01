/**
 * Test Component for EIP-7702 + ERC-4337 Gasless
 * 
 * Tests TRUE GASLESS using:
 * - EIP-7702: EOA upgraded to smart account (already done via MetaMask)
 * - ERC-4337: UserOperation with Pimlico bundler + paymaster
 */

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { usePimlico7702 } from '../hooks/usePimlico7702';
import { parseUnits } from 'viem';

// Test tokens
const TEST_TOKENS = {
  80002: { // Amoy
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881'
  },
  11155111: { // Sepolia
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84'
  }
};

export default function TestSmartAccount() {
  const { address, chain, isConnected } = useAccount();
  const pimlico = usePimlico7702();
  const [testResult, setTestResult] = useState(null);
  const [availability, setAvailability] = useState(null);

  const chainConfig = TEST_TOKENS[chain?.id];

  // Test 1: Check availability
  const handleCheckAvailability = async () => {
    try {
      setTestResult({ success: true, message: 'Checking...' });
      const result = await pimlico.checkAvailability();
      setAvailability(result);
      setTestResult({ success: true, message: 'Availability checked', data: result });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
  };

  // Test 2: Check Smart Account Status
  const handleCheckStatus = async () => {
    try {
      setTestResult({ success: true, message: 'Checking 7702 status...' });
      const upgraded = await pimlico.checkSmartAccountStatus();
      setTestResult({ 
        success: true, 
        message: upgraded ? '✅ EOA is 7702 upgraded!' : '❌ EOA not upgraded',
        data: {
          isSmartAccount: upgraded,
          delegator: pimlico.delegatorAddress
        }
      });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
  };

  // Test 3: Gasless Approval
  const handleGaslessApproval = async () => {
    if (!chainConfig) {
      setTestResult({ success: false, message: 'Chain not supported' });
      return;
    }

    try {
      setTestResult({ success: true, message: 'Sending gasless approval via Pimlico...' });
      
      const result = await pimlico.executeGaslessApproval({
        tokenAddress: chainConfig.USDC,
        spender: chainConfig.routerHub,
        amount: parseUnits('1', 6).toString() // 1 USDC
      });

      setTestResult({ 
        success: true, 
        message: '🎉 GASLESS approval successful!', 
        data: result 
      });
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: err.message
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-lg">
        <h2 className="text-xl font-bold mb-4">MetaMask Smart Account Test (7702 + 4337)</h2>
        <p className="text-yellow-400">Please connect your wallet first</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg max-w-2xl mx-auto my-8">
      <h2 className="text-xl font-bold mb-4">EIP-7702 + ERC-4337 Gasless Test</h2>
      <p className="text-sm text-gray-400 mb-4">
        TRUE GASLESS using Pimlico Bundler + Paymaster
      </p>
      
      {/* Status */}
      <div className="mb-6 p-4 bg-gray-800 rounded">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Chain:</div>
          <div className="text-cyan-400">{chain?.name} ({chain?.id})</div>
          
          <div>EOA Address:</div>
          <div className="text-cyan-400 font-mono text-xs">{address}</div>
          
          <div>7702 Upgraded:</div>
          <div className={pimlico.isSmartAccount ? 'text-green-400' : 'text-yellow-400'}>
            {pimlico.isSmartAccount ? '✅ YES' : '❌ NO'}
          </div>
          
          <div>Delegator:</div>
          <div className="text-cyan-400 font-mono text-xs">
            {pimlico.delegatorAddress || 'N/A'}
          </div>
          
          <div>Status:</div>
          <div className="text-cyan-400">{pimlico.status}</div>
        </div>
      </div>

      {/* Status Message */}
      {pimlico.statusMessage && (
        <div className="mb-4 p-3 bg-blue-900/50 rounded text-sm">
          {pimlico.statusMessage}
        </div>
      )}

      {/* Test Buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleCheckAvailability}
          disabled={pimlico.isLoading}
          className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded font-semibold disabled:opacity-50"
        >
          1. Check Availability
        </button>

        <button
          onClick={handleCheckStatus}
          disabled={pimlico.isLoading}
          className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded font-semibold disabled:opacity-50"
        >
          2. Check 7702 Status
        </button>

        <button
          onClick={handleGaslessApproval}
          disabled={pimlico.isLoading || !chainConfig || !pimlico.isSmartAccount}
          className="w-full p-3 bg-green-600 hover:bg-green-700 rounded font-semibold disabled:opacity-50"
        >
          3. 🎉 TRUE GASLESS Approval (1 USDC)
        </button>

        <button
          onClick={pimlico.reset}
          className="w-full p-3 bg-gray-600 hover:bg-gray-700 rounded font-semibold"
        >
          Reset
        </button>
      </div>

      {/* Result */}
      {testResult && (
        <div className={`p-4 rounded ${testResult.success ? 'bg-green-900' : 'bg-red-900'}`}>
          <div className="font-semibold mb-2">
            {testResult.success ? '✅ Success' : '❌ Error'}
          </div>
          <div className="text-sm">{testResult.message}</div>
          {testResult.data && (
            <pre className="mt-2 text-xs bg-black/50 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Availability */}
      {availability && (
        <div className="mt-4 p-4 bg-gray-800 rounded">
          <div className="font-semibold mb-2">Availability:</div>
          <pre className="text-xs bg-black/50 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(availability, null, 2)}
          </pre>
        </div>
      )}

      {/* UserOp Hash */}
      {pimlico.userOpHash && (
        <div className="mt-4 p-4 bg-blue-900 rounded">
          <div className="font-semibold mb-2">UserOp Hash:</div>
          <div className="text-cyan-400 text-sm font-mono break-all">
            {pimlico.userOpHash}
          </div>
        </div>
      )}

      {/* TX Hash */}
      {pimlico.txHash && (
        <div className="mt-4 p-4 bg-green-900 rounded">
          <div className="font-semibold mb-2">🎉 Transaction Confirmed!</div>
          <a 
            href={`${TEST_TOKENS[chain?.id] ? 
              (chain?.id === 80002 ? 'https://amoy.polygonscan.com' : 'https://sepolia.etherscan.io') 
              : ''}/tx/${pimlico.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline text-sm font-mono break-all"
          >
            {pimlico.txHash}
          </a>
        </div>
      )}

      {/* Error */}
      {pimlico.error && (
        <div className="mt-4 p-4 bg-red-900 rounded">
          <div className="font-semibold mb-2">Error:</div>
          <div className="text-sm whitespace-pre-wrap">{pimlico.error}</div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-800 rounded text-xs text-gray-400">
        <div className="font-semibold text-white mb-2">How it works:</div>
        <ul className="space-y-1">
          <li>1. EOA is already 7702 upgraded (via MetaMask Smart Account)</li>
          <li>2. We build a UserOperation targeting the delegator contract</li>
          <li>3. Pimlico's pm_sponsorUserOperation adds paymaster data</li>
          <li>4. You sign the UserOp hash (NOT a transaction)</li>
          <li>5. Pimlico bundler submits to EntryPoint</li>
          <li>6. Result: $0 gas fees!</li>
        </ul>
      </div>
    </div>
  );
}
