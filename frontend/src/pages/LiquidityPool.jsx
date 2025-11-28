import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { 
  ArrowLeft, 
  TrendingUp, 
  Wallet, 
  DollarSign, 
  Users, 
  Zap,
  Info,
  ChevronDown,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import ConnectButton from '../components/ConnectButton';

// Mock data - In production, fetch from contracts/backend
const MOCK_DATA = {
  paymasterPool: {
    apy: 3000,
    tvl: 1000,
    feesCollected: 150000,
    feesDistributed: 30000,
    lpShare: 20,
    protocolShare: 80,
    depositors: 42,
    userDeposit: 100,
    userEarnings: 15.50,
  },
  feeHistory: [
    { date: 'Nov 22', fees: 4200, gasCost: 12 },
    { date: 'Nov 23', fees: 5100, gasCost: 15 },
    { date: 'Nov 24', fees: 4800, gasCost: 11 },
    { date: 'Nov 25', fees: 6200, gasCost: 18 },
    { date: 'Nov 26', fees: 5500, gasCost: 14 },
    { date: 'Nov 27', fees: 7100, gasCost: 20 },
    { date: 'Nov 28', fees: 6800, gasCost: 16 },
  ],
  pools: [
    { name: 'Paymaster Pool', network: 'Multi-Chain', apy: 3000, tvl: 1000, type: 'paymaster', highlight: true },
    { name: 'ETH-USDC', network: 'Sepolia', apy: 32, tvl: 500000, type: 'swap' },
    { name: 'POL-USDC', network: 'Amoy', apy: 45, tvl: 200000, type: 'swap' },
    { name: 'WETH-DAI', network: 'Sepolia', apy: 28, tvl: 150000, type: 'swap' },
  ]
};

// Stat Card Component with neon glow effect
const StatCard = ({ icon: Icon, label, value, subValue, color = 'cyan', trend }) => {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 shadow-cyan-500/20',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 shadow-violet-500/20',
    orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/30 shadow-orange-500/20',
    green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 shadow-emerald-500/20',
  };
  
  const iconColors = {
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    orange: 'text-orange-400',
    green: 'text-emerald-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorClasses[color]} backdrop-blur-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group`}>
      {/* Glow effect */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color === 'cyan' ? 'cyan' : color === 'violet' ? 'violet' : color === 'orange' ? 'orange' : 'emerald'}-500/10 rounded-full blur-3xl group-hover:bg-opacity-20 transition-all`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg bg-white/5 ${iconColors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
      </div>
    </div>
  );
};

// Mini Chart Component (simplified bar chart)
const MiniChart = ({ data }) => {
  const maxFee = Math.max(...data.map(d => d.fees));
  
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div 
            className="w-full bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative group"
            style={{ height: `${(item.fees / maxFee) * 100}%`, minHeight: '4px' }}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              ${item.fees.toLocaleString()}
            </div>
          </div>
          <span className="text-[10px] text-gray-500">{item.date.split(' ')[1]}</span>
        </div>
      ))}
    </div>
  );
};

// Donut Chart Component for fee split
const DonutChart = ({ lpShare, protocolShare }) => {
  const circumference = 2 * Math.PI * 40;
  const lpOffset = circumference * (1 - lpShare / 100);
  
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle cx="64" cy="64" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
        {/* Protocol share (violet) */}
        <circle 
          cx="64" cy="64" r="40" fill="none" 
          stroke="url(#violetGradient)" strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={0}
          className="transition-all duration-1000"
        />
        {/* LP share (cyan) */}
        <circle 
          cx="64" cy="64" r="40" fill="none" 
          stroke="url(#cyanGradient)" strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={lpOffset}
          className="transition-all duration-1000"
        />
        <defs>
          <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="violetGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{lpShare}%</span>
        <span className="text-xs text-gray-400">to LPs</span>
      </div>
    </div>
  );
};

// Pool Row Component
const PoolRow = ({ pool, onDeposit }) => {
  const isPaymaster = pool.type === 'paymaster';
  
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${
      isPaymaster 
        ? 'bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 border border-cyan-500/30 shadow-lg shadow-cyan-500/10' 
        : 'bg-white/5 hover:bg-white/10 border border-white/10'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isPaymaster ? 'bg-gradient-to-br from-cyan-500 to-violet-500' : 'bg-white/10'
        }`}>
          {isPaymaster ? <Zap className="w-5 h-5 text-white" /> : <DollarSign className="w-5 h-5 text-gray-400" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{pool.name}</span>
            {isPaymaster && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                COMMUNITY
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{pool.network}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className={`font-bold ${isPaymaster ? 'text-emerald-400 text-lg' : 'text-white'}`}>
            {pool.apy.toLocaleString()}%
          </p>
          <p className="text-xs text-gray-500">APY</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-white">${pool.tvl.toLocaleString()}</p>
          <p className="text-xs text-gray-500">TVL</p>
        </div>
        <button
          onClick={() => onDeposit(pool)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            isPaymaster
              ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-105'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isPaymaster ? 'Deposit' : 'Add Liquidity'}
        </button>
      </div>
    </div>
  );
};

// Main Component
export default function LiquidityPool() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState(null);
  
  const data = MOCK_DATA;

  const handleDeposit = (pool) => {
    setSelectedPool(pool);
    setShowDepositModal(true);
  };

  const executeDeposit = () => {
    // In production, call contract
    console.log('Depositing', depositAmount, 'to', selectedPool?.name);
    setShowDepositModal(false);
    setDepositAmount('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Animated background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-orange-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/10 backdrop-blur-xl bg-black/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ZeroToll</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/swap')} className="text-gray-400 hover:text-cyan-400 transition-colors">
              Swap
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-400 font-medium">Community Paymaster Pool</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Earn <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">High Yield</span> by Funding Gas
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Deposit to the community paymaster pool and earn a share of all swap fees. 
            Fully decentralized, no lock period, withdraw anytime.
          </p>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatCard 
            icon={TrendingUp} 
            label="Pool APY" 
            value={`${data.paymasterPool.apy.toLocaleString()}%`}
            subValue="Annualized yield"
            color="green"
            trend="+12% this week"
          />
          <StatCard 
            icon={Wallet} 
            label="Total Liquidity (TVL)" 
            value={`$${data.paymasterPool.tvl.toLocaleString()}`}
            subValue="In paymaster treasury"
            color="cyan"
          />
          <StatCard 
            icon={DollarSign} 
            label="Fees Collected" 
            value={`$${data.paymasterPool.feesCollected.toLocaleString()}`}
            subValue="Total swap fees"
            color="violet"
          />
          <StatCard 
            icon={Users} 
            label="Fees to LPs" 
            value={`$${data.paymasterPool.feesDistributed.toLocaleString()}`}
            subValue={`${data.paymasterPool.depositors} depositors`}
            color="orange"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Fee Revenue Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Fee Revenue vs Gas Costs</h3>
                <p className="text-sm text-gray-500">Last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-gray-400">Fees Collected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-gray-400">Gas Costs</span>
                </div>
              </div>
            </div>
            <MiniChart data={data.feeHistory} />
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-500">Total Fees: </span>
                <span className="text-cyan-400 font-semibold">
                  ${data.feeHistory.reduce((a, b) => a + b.fees, 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Total Gas: </span>
                <span className="text-orange-400 font-semibold">
                  ${data.feeHistory.reduce((a, b) => a + b.gasCost, 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Net Profit: </span>
                <span className="text-emerald-400 font-semibold">
                  ${(data.feeHistory.reduce((a, b) => a + b.fees, 0) - data.feeHistory.reduce((a, b) => a + b.gasCost, 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Fee Distribution Donut */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Fee Distribution</h3>
            <p className="text-sm text-gray-500 mb-6">How swap fees are split</p>
            <div className="flex flex-col items-center">
              <DonutChart lpShare={data.paymasterPool.lpShare} protocolShare={data.paymasterPool.protocolShare} />
              <div className="mt-6 w-full space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" />
                    <span className="text-sm text-gray-400">LP Rewards</span>
                  </div>
                  <span className="text-sm font-semibold text-cyan-400">{data.paymasterPool.lpShare}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-violet-400" />
                    <span className="text-sm text-gray-400">Protocol Treasury</span>
                  </div>
                  <span className="text-sm font-semibold text-violet-400">{data.paymasterPool.protocolShare}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Position (if connected) */}
        {isConnected && (
          <div className="mb-12 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Your Position</h3>
                <p className="text-sm text-gray-500">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">${data.paymasterPool.userDeposit.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Your Deposit</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-400">+${data.paymasterPool.userEarnings.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Earned Fees</p>
                </div>
                <button className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all">
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pools List */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">All Pools</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="w-4 h-4" />
              <span>APY based on 7-day average</span>
            </div>
          </div>
          <div className="space-y-3">
            {data.pools.map((pool, i) => (
              <PoolRow key={i} pool={pool} onDeposit={handleDeposit} />
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          <h3 className="text-xl font-bold text-white mb-6 text-center">Why Deposit to the Paymaster Pool?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '✅', title: 'Fully Decentralized', desc: 'No single point of failure. Community-owned gas fund.' },
              { icon: '💰', title: 'High Yield', desc: 'Earn from 0.5% swap fees. Early depositors get highest APY.' },
              { icon: '🔓', title: 'No Lock Period', desc: 'Withdraw your USDC + earned yield anytime.' },
              { icon: '⚡', title: '$ZEROTOLL Rewards', desc: 'Bonus tokens for long-term liquidity providers.' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h4 className="font-semibold text-white mb-2">{item.title}</h4>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Deposit to {selectedPool?.name}</h3>
              <button 
                onClick={() => setShowDepositModal(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Amount (USDC)</label>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xl font-semibold outline-none focus:border-cyan-500/50 transition-colors"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400 hover:text-cyan-300">
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Available: 1,000.00 USDC</p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Current APY</span>
                <span className="text-emerald-400 font-semibold">{selectedPool?.apy.toLocaleString()}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Your share of pool</span>
                <span className="text-white">
                  {depositAmount ? ((parseFloat(depositAmount) / (data.paymasterPool.tvl + parseFloat(depositAmount || 0))) * 100).toFixed(2) : '0.00'}%
                </span>
              </div>
            </div>

            <button
              onClick={executeDeposit}
              disabled={!depositAmount || parseFloat(depositAmount) <= 0}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnected ? 'Deposit' : 'Connect Wallet'}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              By depositing, you agree to the protocol terms. Funds are used to sponsor gas for swaps.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm text-gray-500">
          <p>© 2025 ZeroToll. Gasless DeFi for everyone.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              Docs <ExternalLink className="w-3 h-3" />
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
