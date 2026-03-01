/**
 * Test Component for MetaMask 7702
 * 
 * This is a simple test to verify wallet_sendCalls works
 * before integrating into the full swap flow.
 */

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMetaMask7702 } from '../hooks/useMetaMask7702';
import { parseUnits, encodeFunctionData, parseAbi } from 'viem';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
]);

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

export default function TestMetaMask7702() {
  const { address, chain, isConnected } = useAccount();
  const metamask7702 = useMetaMask7702();
  const [testResult, setTestResult] = useState(null);
  const [capabilities, setCapabilities] = useState(null);

  const chainConfig = TEST_TOKENS[chain?.id];

  // Test 1: Check capabilities
  const handleCheckCapabilities = async () => {
    try {
      const caps = await metamask7702.getCapabilities();
      setCapabilities(caps);
      setTestResult({ success: true, message: 'Capabilities fetched', data: caps });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
  };

  // Test 2: Simple approval (single call)
  const handleTestApproval = async () => {
    if (!chainConfig) {
      setTestResult({ success: false, message: 'Chain not supported' });
      return;
    }

    try {
      setTestResult({ success: true, message: 'Sending approval...' });
      
      const result = await metamask7702.executeApproval({
        tokenAddress: chainConfig.USDC,
        spender: chainConfig.routerHub,
        amount: parseUnits('1', 6).toString() // 1 USDC
      });

      setTestResult({ 
        success: true, 
        message: 'Approval successful!', 
        data: result 
      });
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: err.message,
        code: err.code 
      });
    }
  };

  // Test 3: Batch calls (approve + dummy call)
  const handleTestBatch = async () => {
    if (!chainConfig) {
      setTestResult({ success: false, message: 'Chain not supported' });
      return;
    }

    try {
      setTestResult({ success: true, message: 'Sending batch...' });

      // Create two approval calls as a simple batch test
      const approveData1 = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [chainConfig.routerHub, parseUnits('1', 6)]
      });

      const approveData2 = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [chainConfig.routerHub, parseUnits('2', 6)]
      });

      const result = await metamask7702.sendCalls({
        calls: [
          { to: chainConfig.USDC, data: approveData1, value: '0x0' },
          { to: chainConfig.USDC, data: approveData2, value: '0x0' }
        ]
      });

      setTestResult({ 
        success: true, 
        message: 'Batch successful!', 
        data: result 
      });
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: err.message,
        code: err.code 
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-lg">
        <h2 className="text-xl font-bold mb-4">MetaMask 7702 Test</h2>
        <p className="text-yellow-400">Please connect your wallet first</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg max-w-2xl mx-auto my-8">
      <h2 className="text-xl font-bold mb-4">MetaMask 7702 Test</h2>
      
      {/* Status */}
      <div className="mb-6 p-4 bg-gray-800 rounded">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Chain:</div>
          <div className="text-cyan-400">{chain?.name} ({chain?.id})</div>
          
          <div>Address:</div>
          <div className="text-cyan-400 font-mono text-xs">{address}</div>
          
          <div>Smart Account:</div>
          <div className={metamask7702.isSmartAccount ? 'text-green-400' : 'text-yellow-400'}>
            {metamask7702.isSmartAccount ? '✅ ENABLED' : '❌ NOT ENABLED'}
          </div>
          
          <div>Status:</div>
          <div className="text-cyan-400">{metamask7702.status}</div>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleCheckCapabilities}
          disabled={metamask7702.isLoading}
          className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded font-semibold disabled:opacity-50"
        >
          1. Check Wallet Capabilities
        </button>

        <button
          onClick={handleTestApproval}
          disabled={metamask7702.isLoading || !chainConfig}
          className="w-full p-3 bg-green-600 hover:bg-green-700 rounded font-semibold disabled:opacity-50"
        >
          2. Test Single Approval (1 USDC)
        </button>

        <button
          onClick={handleTestBatch}
          disabled={metamask7702.isLoading || !chainConfig}
          className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded font-semibold disabled:opacity-50"
        >
          3. Test Batch Calls (2 approvals)
        </button>

        <button
          onClick={metamask7702.reset}
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
          {testResult.code && (
            <div className="text-sm text-gray-400">Code: {testResult.code}</div>
          )}
          {testResult.data && (
            <pre className="mt-2 text-xs bg-black/50 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Capabilities */}
      {capabilities && (
        <div className="mt-4 p-4 bg-gray-800 rounded">
          <div className="font-semibold mb-2">Wallet Capabilities:</div>
          <pre className="text-xs bg-black/50 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(capabilities, null, 2)}
          </pre>
        </div>
      )}

      {/* TX Hash */}
      {metamask7702.txHash && (
        <div className="mt-4 p-4 bg-gray-800 rounded">
          <div className="font-semibold mb-2">Transaction:</div>
          <a 
            href={`${metamask7702.explorer}/tx/${metamask7702.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline text-sm font-mono break-all"
          >
            {metamask7702.txHash}
          </a>
        </div>
      )}

      {/* Error */}
      {metamask7702.error && (
        <div className="mt-4 p-4 bg-red-900 rounded">
          <div className="font-semibold mb-2">Error:</div>
          <div className="text-sm">{metamask7702.error}</div>
        </div>
      )}
    </div>
  );
}
