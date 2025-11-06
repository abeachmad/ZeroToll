import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function Portfolio() {
  const { address, chain } = useAccount();
  const [swapHistory, setSwapHistory] = useState([]);
  const [vaultPosition, setVaultPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (address) {
      fetchPortfolioData();
    }
  }, [address]);

  const fetchPortfolioData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch swap history from backend
      const historyResponse = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/history?user=${address}`
      );

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setSwapHistory(historyData.swaps || []);
      }

      // TODO: Fetch vault position from subgraph or contract
      // For now, placeholder data
      setVaultPosition({
        deposited: '1000.00',
        currentValue: '1025.50',
        yield: '25.50',
        apr: '12.30',
      });
    } catch (err) {
      console.error('Failed to fetch portfolio data:', err);
      setError('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (swapHistory.length === 0) {
      alert('No data to export');
      return;
    }

    // CSV headers
    const headers = [
      'Timestamp',
      'From Chain',
      'To Chain',
      'Token In',
      'Token Out',
      'Amount In',
      'Amount Out',
      'Net Out',
      'Fee Mode',
      'Fee Paid',
      'Fee Token',
      'Status',
      'TX Hash',
    ];

    // CSV rows
    const rows = swapHistory.map((swap) => [
      new Date(swap.timestamp).toLocaleString(),
      swap.fromChain || '',
      swap.toChain || '',
      swap.tokenIn || '',
      swap.tokenOut || '',
      swap.amountIn || '',
      swap.amountOut || '',
      swap.netOut || '',
      swap.feeMode || '',
      swap.feePaid || '',
      swap.feeToken || '',
      swap.status || '',
      swap.txHash || '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `zerotoll-portfolio-${address}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>
            Please connect your wallet to view your portfolio.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Portfolio</h1>
        <Button onClick={exportToCSV} variant="outline">
          📥 Export CSV
        </Button>
      </div>

      {error && (
        <Alert className="mb-6 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Vault Position */}
      {vaultPosition && (
        <Card className="p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">Fee Vault Position</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Deposited</p>
              <p className="text-2xl font-bold text-blue-600">${vaultPosition.deposited}</p>
              <p className="text-xs text-gray-500">USDC</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Current Value</p>
              <p className="text-2xl font-bold text-green-600">${vaultPosition.currentValue}</p>
              <p className="text-xs text-gray-500">Including yield</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Total Yield</p>
              <p className="text-2xl font-bold text-purple-600">+${vaultPosition.yield}</p>
              <p className="text-xs text-gray-500">
                {((parseFloat(vaultPosition.yield) / parseFloat(vaultPosition.deposited)) * 100).toFixed(2)}% gain
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">APR</p>
              <p className="text-2xl font-bold text-orange-600">{vaultPosition.apr}%</p>
              <p className="text-xs text-gray-500">Current rate</p>
            </div>
          </div>
        </Card>
      )}

      {/* Swap History */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Swap History</h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading...</p>
        ) : swapHistory.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No swaps yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Route</th>
                  <th className="text-left p-3 font-semibold">Swap</th>
                  <th className="text-left p-3 font-semibold">Fee Mode</th>
                  <th className="text-left p-3 font-semibold">Fee Paid</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">TX</th>
                </tr>
              </thead>
              <tbody>
                {swapHistory.map((swap, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      {new Date(swap.timestamp).toLocaleDateString()}
                      <br />
                      <span className="text-xs text-gray-500">
                        {new Date(swap.timestamp).toLocaleTimeString()}
                      </span>
                    </td>

                    <td className="p-3 text-sm">
                      {swap.fromChain}
                      <br />
                      <span className="text-xs text-gray-500">→ {swap.toChain}</span>
                    </td>

                    <td className="p-3 text-sm">
                      <span className="font-semibold">{swap.amountIn} {swap.tokenIn}</span>
                      <br />
                      <span className="text-xs text-gray-500">→ {swap.netOut} {swap.tokenOut}</span>
                    </td>

                    <td className="p-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {swap.feeMode}
                      </span>
                    </td>

                    <td className="p-3 text-sm">
                      {swap.feePaid} {swap.feeToken}
                      {swap.refund && parseFloat(swap.refund) > 0 && (
                        <>
                          <br />
                          <span className="text-xs text-green-600">+{swap.refund} refund</span>
                        </>
                      )}
                    </td>

                    <td className="p-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          swap.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : swap.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {swap.status}
                      </span>
                    </td>

                    <td className="p-3 text-sm">
                      {swap.explorerUrl ? (
                        <a
                          href={swap.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View →
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      {swapHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Total Swaps</h3>
            <p className="text-3xl font-bold text-blue-600">{swapHistory.length}</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Gas Saved</h3>
            <p className="text-3xl font-bold text-green-600">
              ~${(swapHistory.length * 5.5).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">via gasless transactions</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Success Rate</h3>
            <p className="text-3xl font-bold text-purple-600">
              {((swapHistory.filter((s) => s.status === 'success').length / swapHistory.length) * 100).toFixed(0)}%
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
