import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([
        axios.get(`${API}/history`),
        axios.get(`${API}/stats`)
      ]);
      setHistory(historyRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-zt-ink/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/swap')}
            className="flex items-center gap-2 text-zt-paper/70 hover:text-zt-aqua transition-colors"
            data-testid="back-swap-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-lg font-semibold">Back to Swap</span>
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ZeroToll" className="w-8 h-8" />
            <span className="text-xl font-bold text-zt-paper">ZeroToll</span>
          </div>
          <div className="w-32"></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8 text-zt-paper">Transaction History</h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            <div className="glass p-6 rounded-xl" data-testid="stat-total-swaps">
              <p className="text-zt-paper/70 text-sm mb-2">Total Swaps</p>
              <p className="text-zt-paper text-3xl font-bold">{stats.totalSwaps}</p>
            </div>
            <div className="glass p-6 rounded-xl" data-testid="stat-success-rate">
              <p className="text-zt-paper/70 text-sm mb-2">Success Rate</p>
              <p className="text-zt-aqua text-3xl font-bold">{stats.successRate.toFixed(1)}%</p>
            </div>
            <div className="glass p-6 rounded-xl" data-testid="stat-volume">
              <p className="text-zt-paper/70 text-sm mb-2">Total Volume</p>
              <p className="text-zt-paper text-3xl font-bold">{stats.totalVolume}</p>
            </div>
            <div className="glass p-6 rounded-xl" data-testid="stat-gas-saved">
              <p className="text-zt-paper/70 text-sm mb-2">Gas Saved</p>
              <p className="text-zt-violet text-3xl font-bold">{stats.gasSaved}</p>
            </div>
            <div className="glass p-6 rounded-xl" data-testid="stat-successful">
              <p className="text-zt-paper/70 text-sm mb-2">Successful</p>
              <p className="text-zt-paper text-3xl font-bold">{stats.successfulSwaps}</p>
            </div>
          </div>
        )}

        {/* History Table */}
        <div className="glass-strong rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Time</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Route</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Amount In</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Amount Out</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Fee</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Status</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Tx</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8 text-zt-paper/50">
                      Loading...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8 text-zt-paper/50">
                      No transactions yet. Start swapping!
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-zt-paper/70 text-sm">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-zt-paper">{item.fromChain}</span>
                          <span className="text-zt-aqua">→</span>
                          <span className="text-zt-paper">{item.toChain}</span>
                        </div>
                      </td>
                      <td className="p-4 text-zt-paper">
                        {item.amountIn} {item.tokenIn}
                      </td>
                      <td className="p-4 text-zt-paper">
                        {item.amountOut} {item.tokenOut}
                      </td>
                      <td className="p-4 text-zt-paper/70">
                        {item.feePaid} USDC
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'success' ? 'bg-green-500/20 text-green-400' :
                          item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {item.txHash && (
                          <a
                            href={`https://amoy.polygonscan.com/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zt-aqua hover:text-zt-violet transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
