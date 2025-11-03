import React, { useEffect, useState } from 'react';
import { TrendingUp, Zap, DollarSign, RefreshCw } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LiveMetrics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-6 rounded-xl animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-white/10 rounded w-3/4"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="glass-strong p-8 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-zt-paper">Live Metrics</h3>
        <div className="flex items-center gap-2 text-zt-aqua text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Real-time</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zt-violet/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-zt-violet" />
            </div>
            <div>
              <p className="text-zt-paper/60 text-sm">Gas Saved (7d)</p>
              <p className="text-zt-paper text-xl font-bold">{stats.gasSaved}</p>
            </div>
          </div>
          <div className="text-xs text-zt-paper/50">
            POL/ETH fronted by paymaster
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zt-aqua/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-zt-aqua" />
            </div>
            <div>
              <p className="text-zt-paper/60 text-sm">Any-Token Adoption</p>
              <p className="text-zt-paper text-xl font-bold">{stats.anyTokenShare || '67.3%'}</p>
            </div>
          </div>
          <div className="text-xs text-zt-paper/50">
            Input + Output mode usage
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-zt-paper/60 text-sm">Refund Rate</p>
              <p className="text-zt-paper text-xl font-bold">{stats.refundRate || '15.2%'}</p>
            </div>
          </div>
          <div className="text-xs text-zt-paper/50">
            Avg surplus returned to users
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-zt-paper/60 text-xs mb-1">Success Rate</p>
          <p className="text-zt-aqua text-lg font-bold">
            {typeof stats.successRate === 'number' ? stats.successRate.toFixed(1) : stats.successRate}%
          </p>
        </div>
        <div>
          <p className="text-zt-paper/60 text-xs mb-1">Avg Fee</p>
          <p className="text-zt-paper text-lg font-bold">{stats.avgFeeUSD || '$0.50'}</p>
        </div>
        <div>
          <p className="text-zt-paper/60 text-xs mb-1">Total Volume</p>
          <p className="text-zt-paper text-lg font-bold">{stats.totalVolume}</p>
        </div>
        <div>
          <p className="text-zt-paper/60 text-xs mb-1">Total Swaps</p>
          <p className="text-zt-paper text-lg font-bold">{stats.totalSwaps}</p>
        </div>
      </div>

      {stats.modeDistribution && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-zt-paper/60 text-sm mb-3">Fee Mode Distribution</p>
          <div className="flex gap-2">
            {stats.modeDistribution.input > 0 && (
              <div className="flex-1 bg-zt-violet/20 rounded px-3 py-2 text-center">
                <p className="text-zt-violet text-xs font-semibold">INPUT</p>
                <p className="text-zt-paper text-sm">{stats.modeDistribution.input}</p>
              </div>
            )}
            {stats.modeDistribution.output > 0 && (
              <div className="flex-1 bg-zt-aqua/20 rounded px-3 py-2 text-center">
                <p className="text-zt-aqua text-xs font-semibold">OUTPUT</p>
                <p className="text-zt-paper text-sm">{stats.modeDistribution.output}</p>
              </div>
            )}
            {stats.modeDistribution.stable > 0 && (
              <div className="flex-1 bg-blue-500/20 rounded px-3 py-2 text-center">
                <p className="text-blue-400 text-xs font-semibold">STABLE</p>
                <p className="text-zt-paper text-sm">{stats.modeDistribution.stable}</p>
              </div>
            )}
            {stats.modeDistribution.native > 0 && (
              <div className="flex-1 bg-gray-500/20 rounded px-3 py-2 text-center">
                <p className="text-gray-400 text-xs font-semibold">NATIVE</p>
                <p className="text-zt-paper text-sm">{stats.modeDistribution.native}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <p className="text-zt-paper/40 text-xs">
          ⚠️ Testnet: Amoy ↔ Sepolia | Updates every 30s
        </p>
      </div>
    </div>
  );
};

export default LiveMetrics;
