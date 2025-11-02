import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const chains = [
  { id: 80002, name: 'Polygon Amoy', logo: '🔷' },
  { id: 11155111, name: 'Ethereum Sepolia', logo: '⭐' }
];

const tokens = [
  { symbol: 'USDC', name: 'USD Coin', logo: '💵', feeModes: ['NATIVE', 'INPUT', 'OUTPUT', 'STABLE'] },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', logo: '₿', feeModes: ['INPUT', 'OUTPUT'] },
  { symbol: 'WAVAX', name: 'Wrapped AVAX', logo: '🔺', feeModes: ['INPUT', 'OUTPUT'] },
  { symbol: 'wDOGE', name: 'Wrapped DOGE', logo: '🐕', feeModes: ['INPUT', 'OUTPUT'] },
  { symbol: 'WATOM', name: 'Wrapped ATOM', logo: '⚛️', feeModes: ['INPUT', 'OUTPUT'] },
  { symbol: 'WPEPE', name: 'Wrapped PEPE', logo: '🐸', feeModes: ['INPUT', 'OUTPUT'] },
  { symbol: 'WTON', name: 'Wrapped TON', logo: '💎', feeModes: ['INPUT', 'OUTPUT'] },
  { symbol: 'WBNB', name: 'Wrapped BNB', logo: '🟡', feeModes: ['INPUT', 'OUTPUT'] }
];

const feeModes = [
  { id: 'NATIVE', label: 'Native (POL/ETH)', desc: 'Pay gas in native token' },
  { id: 'INPUT', label: 'Use Input Token', desc: 'Deduct fee from input on source' },
  { id: 'OUTPUT', label: 'Use Output Token', desc: 'Skim fee from output on dest' },
  { id: 'STABLE', label: 'Stable', desc: 'Pay in stablecoins' }
];

const Swap = () => {
  const navigate = useNavigate();
  const [fromChain, setFromChain] = useState(chains[0]);
  const [toChain, setToChain] = useState(chains[1]);
  const [tokenIn, setTokenIn] = useState(tokens[0]);
  const [tokenOut, setTokenOut] = useState(tokens[0]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [feeMode, setFeeMode] = useState('INPUT');
  const [feeCap, setFeeCap] = useState('3');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const availableFeeModes = feeModes.filter(mode => 
    tokenIn.feeModes.includes(mode.id)
  );

  useEffect(() => {
    // Auto-select first available fee mode when token changes
    if (!tokenIn.feeModes.includes(feeMode)) {
      setFeeMode(tokenIn.feeModes[0]);
    }
  }, [tokenIn]);

  const handleGetQuote = async () => {
    const amount = parseFloat(amountIn);
    if (!amountIn || isNaN(amount) || amount <= 0 || amount > 1e12) {
      toast.error('Enter a valid amount');
      return;
    }
    
    const cap = parseFloat(feeCap);
    if (isNaN(cap) || cap <= 0 || cap > 1e6) {
      toast.error('Enter a valid fee cap');
      return;
    }

    setLoading(true);
    try {
      const intent = {
        user: '0x1234567890123456789012345678901234567890',
        tokenIn: tokenIn.symbol,
        amtIn: parseFloat(amountIn),
        tokenOut: tokenOut.symbol,
        minOut: parseFloat(amountIn) * 0.995,
        dstChainId: toChain.id,
        feeMode,
        feeCap: parseFloat(feeCap),
        deadline: Math.floor(Date.now() / 1000) + 600,
        nonce: Date.now()
      };

      const response = await axios.post(`${API}/quote`, { intent });
      
      if (response.data.success) {
        const quoteData = response.data;
        setQuote(quoteData);
        
        // Calculate net output based on fee mode
        let netOut = parseFloat(amountIn) * 0.995;
        if (feeMode === 'OUTPUT') {
          netOut -= parseFloat(feeCap);
        }
        setAmountOut(netOut.toFixed(2));
        
        toast.success('Quote received!');
      } else {
        toast.error(response.data.reason || 'No quote available');
      }
    } catch (error) {
      console.error('Quote error:', error);
      toast.error('Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!quote) {
      toast.error('Get a quote first');
      return;
    }

    setLoading(true);
    try {
      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}`;
      const userOp = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: Date.now(),
        feeMode,
        feeToken: feeMode === 'INPUT' ? tokenIn.symbol : tokenOut.symbol
      };

      const response = await axios.post(`${API}/execute`, { intentId, userOp });
      
      if (response.data.success) {
        setTxHash(response.data.txHash);
        toast.success('Swap executed successfully!');
      } else {
        toast.error('Execution failed');
      }
    } catch (error) {
      console.error('Execute error:', error);
      toast.error('Failed to execute swap');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      <header className="border-b border-white/10 backdrop-blur-sm bg-zt-ink/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zt-paper/70 hover:text-zt-aqua transition-colors"
            data-testid="back-home-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-lg font-semibold">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ZeroToll" className="w-8 h-8" />
            <span className="text-xl font-bold text-zt-paper">ZeroToll</span>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            data-testid="view-history-btn"
          >
            History
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="glass-strong p-8 rounded-3xl">
          <h1 className="text-3xl font-bold mb-2 text-zt-paper">Gasless Cross-Chain Swap</h1>
          <p className="text-zt-paper/60 mb-8">Pay fees in ANY token you're swapping.</p>

          {/* From Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">From</label>
            <div className="glass p-4 rounded-xl">
              <div className="flex justify-between mb-3">
                <select
                  value={fromChain.id}
                  onChange={(e) => setFromChain(chains.find(c => c.id === parseInt(e.target.value)))}
                  className="bg-transparent text-zt-paper font-semibold outline-none cursor-pointer"
                  data-testid="from-chain-select"
                >
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id}>{chain.logo} {chain.name}</option>
                  ))}
                </select>
                <select
                  value={tokenIn.symbol}
                  onChange={(e) => setTokenIn(tokens.find(t => t.symbol === e.target.value))}
                  className="bg-transparent text-zt-paper font-semibold outline-none cursor-pointer"
                  data-testid="token-in-select"
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>{token.logo} {token.symbol}</option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-3xl font-bold text-zt-paper outline-none"
                data-testid="amount-in-input"
              />
            </div>
          </div>

          <div className="flex justify-center my-4">
            <div className="w-12 h-12 rounded-full bg-zt-violet flex items-center justify-center">
              <ArrowDownUp className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* To Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">To</label>
            <div className="glass p-4 rounded-xl">
              <div className="flex justify-between mb-3">
                <select
                  value={toChain.id}
                  onChange={(e) => setToChain(chains.find(c => c.id === parseInt(e.target.value)))}
                  className="bg-transparent text-zt-paper font-semibold outline-none cursor-pointer"
                  data-testid="to-chain-select"
                >
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id}>{chain.logo} {chain.name}</option>
                  ))}
                </select>
                <select
                  value={tokenOut.symbol}
                  onChange={(e) => setTokenOut(tokens.find(t => t.symbol === e.target.value))}
                  className="bg-transparent text-zt-paper font-semibold outline-none cursor-pointer"
                  data-testid="token-out-select"
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>{token.logo} {token.symbol}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={amountOut}
                placeholder="0.00"
                readOnly
                className="w-full bg-transparent text-3xl font-bold text-zt-paper/50 outline-none"
                data-testid="amount-out-display"
              />
            </div>
          </div>

          {/* Gas Payment Mode Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">Gas Payment</label>
            <div className="grid grid-cols-2 gap-3">
              {availableFeeModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setFeeMode(mode.id)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    feeMode === mode.id
                      ? 'glass-strong border-2 border-zt-violet'
                      : 'glass border border-white/5 hover:border-zt-aqua/30'
                  }`}
                  data-testid={`fee-mode-${mode.id.toLowerCase()}`}
                >
                  <div className="font-semibold text-zt-paper mb-1">{mode.label}</div>
                  <div className="text-xs text-zt-paper/60">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fee Cap */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">
              Max Fee ({feeMode === 'INPUT' ? tokenIn.symbol : feeMode === 'OUTPUT' ? tokenOut.symbol : 'USDC'})
            </label>
            <input
              type="number"
              value={feeCap}
              onChange={(e) => setFeeCap(e.target.value)}
              className="w-full glass p-4 rounded-xl bg-transparent text-zt-paper outline-none"
              data-testid="fee-cap-input"
            />
          </div>

          {/* Info Banner */}
          {feeMode === 'OUTPUT' && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output Mode:</strong> Fee will be skimmed from output tokens on destination before you receive net amount.
              </div>
            </div>
          )}

          {/* Quote Info */}
          {quote && (
            <div className="mb-6 glass p-4 rounded-xl space-y-2 text-sm border border-zt-violet/30">
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Relayer:</span>
                <span className="text-zt-aqua font-mono">{quote.relayer?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Fee Token:</span>
                <span className="text-zt-paper font-semibold">
                  {feeMode === 'INPUT' ? tokenIn.symbol : feeMode === 'OUTPUT' ? tokenOut.symbol : 'USDC'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Estimated Fee:</span>
                <span className="text-zt-paper">{quote.estimatedFee || '~0.5'} ({quote.feeUSD || '$0.50'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Oracle Source:</span>
                <span className="text-zt-aqua text-xs">{quote.oracleSource || 'TWAP'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Quote Valid:</span>
                <span className="text-zt-paper">60 seconds</span>
              </div>
              <div className="pt-2 border-t border-white/10 text-xs text-zt-paper/60">
                ℹ️ Any unused cap is refunded on-chain in the fee token
              </div>
            </div>
          )}

          {/* Success Message */}
          {txHash && (
            <div className="mb-6 glass p-4 rounded-xl flex items-center gap-3 border border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-zt-paper font-semibold">Swap Submitted!</p>
                <p className="text-zt-paper/70 text-sm font-mono">{txHash.slice(0, 20)}...</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleGetQuote}
              disabled={loading}
              className="flex-1 btn-secondary hover-glow"
              data-testid="get-quote-btn"
            >
              {loading ? <Loader2 className="inline w-5 h-5 animate-spin" /> : 'Get Quote'}
            </button>
            <button
              onClick={handleExecute}
              disabled={loading || !quote}
              className="flex-1 btn-primary hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="execute-swap-btn"
            >
              {loading ? <Loader2 className="inline w-5 h-5 animate-spin" /> : 'Execute Swap'}
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="glass p-4 rounded-xl">
            <p className="text-zt-paper/70 text-sm mb-1">Fee Mode</p>
            <p className="text-zt-aqua text-lg font-bold">{feeMode}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-zt-paper/70 text-sm mb-1">Supported Tokens</p>
            <p className="text-zt-aqua text-lg font-bold">{tokens.length}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-zt-paper/70 text-sm mb-1">Success Rate</p>
            <p className="text-zt-aqua text-lg font-bold">99.8%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Swap;
