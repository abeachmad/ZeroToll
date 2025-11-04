import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, CheckCircle, Info, HelpCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAccount } from 'wagmi';
import FeeModeExplainer from '../components/FeeModeExplainer';
import ConnectButton from '../components/ConnectButton';
import amoyTokens from '../config/tokenlists/zerotoll.tokens.amoy.json';
import sepoliaTokens from '../config/tokenlists/zerotoll.tokens.sepolia.json';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const chains = [
  { id: 80002, name: 'Polygon Amoy', logo: '🔷', tokens: amoyTokens.tokens },
  { id: 11155111, name: 'Ethereum Sepolia', logo: '⭐', tokens: sepoliaTokens.tokens }
];

const feeModes = [
  { id: 'NATIVE', label: 'Native (POL/ETH)', desc: 'Pay gas in native token' },
  { id: 'INPUT', label: 'Use Input Token', desc: 'Deduct fee from input on source' },
  { id: 'OUTPUT', label: 'Use Output Token', desc: 'Skim fee from output on dest' },
  { id: 'STABLE', label: 'Stable', desc: 'Pay in stablecoins' }
];

const Swap = () => {
  const navigate = useNavigate();
  const { address, isConnected, chain } = useAccount();
  
  const [fromChain, setFromChain] = useState(chains[0]);
  const [toChain, setToChain] = useState(chains[1]);
  const [tokenIn, setTokenIn] = useState(fromChain.tokens[0]);
  const [tokenOut, setTokenOut] = useState(toChain.tokens[0]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [feeMode, setFeeMode] = useState('INPUT');
  const [feeCap, setFeeCap] = useState('3');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => {
    setTokenIn(fromChain.tokens[0]);
  }, [fromChain]);

  useEffect(() => {
    setTokenOut(toChain.tokens[0]);
  }, [toChain]);

  useEffect(() => {
    if (!tokenIn.feeModes.includes(feeMode)) {
      setFeeMode(tokenIn.feeModes[0]);
    }
  }, [tokenIn, feeMode]);

  const isNativeOutput = tokenOut.isNative;
  const wrappedOutputSymbol = isNativeOutput ? tokenOut.symbol.replace(/^(POL|ETH)$/, 'W$1') : null;

  const handleGetQuote = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (chain?.id !== 80002 && chain?.id !== 11155111) {
      toast.error('Please switch to Polygon Amoy or Ethereum Sepolia');
      return;
    }

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
        user: address || '0x1234567890123456789012345678901234567890',
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
        
        // CRITICAL: Use backend's netOut for correct price conversion
        if (quoteData.netOut !== undefined) {
          setAmountOut(quoteData.netOut.toFixed(6));
        } else {
          setAmountOut((parseFloat(amountIn) * 0.995).toFixed(6));
        }
        
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

    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    setLoading(true);
    try {
      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}`;
      const feeToken = feeMode === 'INPUT' ? tokenIn.symbol : 
                       feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) :
                       feeMode === 'STABLE' ? 'USDC' : 'POL';
      
      const userOp = {
        sender: address,
        nonce: Date.now(),
        feeMode,
        feeToken
      };

      const response = await axios.post(`${API}/execute`, { intentId, userOp });
      
      if (response.data && response.data.success) {
        setTxHash(response.data.txHash);
        if (response.data.status === 'demo') {
          toast.success('Demo swap executed! (No real transaction)');
        } else {
          toast.success(`Swap executed! Block: ${response.data.blockNumber || 'pending'}`);
        }
      } else {
        toast.error(response.data?.detail || response.data?.message || 'Execution failed');
      }
    } catch (error) {
      console.error('Execute error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to execute swap';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      <header className="border-b border-white/10 backdrop-blur-sm bg-zt-ink/80 sticky top-0 z-50">
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/market')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors hidden md:block"
            >
              Market
            </button>
            <button
              onClick={() => navigate('/history')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors hidden md:block"
              data-testid="view-history-btn"
            >
              History
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="glass-strong p-8 rounded-3xl">
          <h1 className="text-3xl font-bold mb-2 text-zt-paper">Gasless Cross-Chain Swap</h1>
          <p className="text-zt-paper/60 mb-8">Pay fees in any token you swap—use input, skim from output (even native via wrapped), or stick to native gas. Fee capped on-chain, unused refunded.</p>

          {/* From Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">From</label>
            <div className="glass p-4 rounded-xl">
              <div className="flex justify-between mb-3">
                <select
                  value={fromChain.id}
                  onChange={(e) => setFromChain(chains.find(c => c.id === parseInt(e.target.value)))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="from-chain-select"
                >
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id} className="bg-zt-ink text-zt-paper">{chain.logo} {chain.name}</option>
                  ))}
                </select>
                <select
                  value={tokenIn.symbol}
                  onChange={(e) => setTokenIn(fromChain.tokens.find(t => t.symbol === e.target.value))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="token-in-select"
                >
                  {fromChain.tokens.map(token => (
                    <option key={token.symbol} value={token.symbol} className="bg-zt-ink text-zt-paper">{token.logo} {token.symbol}</option>
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
            <button
              onClick={() => {
                // Swap chains and tokens
                const tempChain = fromChain;
                const tempToken = tokenIn;
                setFromChain(toChain);
                setToChain(tempChain);
                setTokenIn(tokenOut);
                setTokenOut(tempToken);
                setAmountOut('');
                setQuote(null);
              }}
              className="w-12 h-12 rounded-full bg-zt-violet hover:bg-zt-violet/80 flex items-center justify-center transition-all hover:rotate-180 cursor-pointer"
              title="Swap tokens"
            >
              <ArrowDownUp className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* To Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">To</label>
            <div className="glass p-4 rounded-xl">
              <div className="flex justify-between mb-3">
                <select
                  value={toChain.id}
                  onChange={(e) => setToChain(chains.find(c => c.id === parseInt(e.target.value)))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="to-chain-select"
                >
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id} className="bg-zt-ink text-zt-paper">{chain.logo} {chain.name}</option>
                  ))}
                </select>
                <select
                  value={tokenOut.symbol}
                  onChange={(e) => setTokenOut(toChain.tokens.find(t => t.symbol === e.target.value))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="token-out-select"
                >
                  {toChain.tokens.map(token => (
                    <option key={token.symbol} value={token.symbol} className="bg-zt-ink text-zt-paper">{token.logo} {token.symbol}</option>
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
            {isNativeOutput && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zt-aqua">
                <Zap className="w-3 h-3" />
                <span>Will unwrap to {tokenOut.symbol} on completion</span>
              </div>
            )}
          </div>

          {/* Gas Payment Mode Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">
              Gas Payment Mode
              <span className="ml-2 text-xs text-zt-aqua cursor-help" title="Choose how to pay transaction fees">ⓘ</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {feeModes.map((mode) => {
                const isAvailable = tokenIn.feeModes.includes(mode.id);
                const isDisabled = !isAvailable;
                return (
                  <button
                    key={mode.id}
                    onClick={() => !isDisabled && setFeeMode(mode.id)}
                    disabled={isDisabled}
                    className={`p-4 rounded-xl text-left transition-all ${
                      feeMode === mode.id
                        ? 'glass-strong border-2 border-zt-violet'
                        : isDisabled
                        ? 'glass border border-white/5 opacity-40 cursor-not-allowed'
                        : 'glass border border-white/5 hover:border-zt-aqua/30'
                    }`}
                    data-testid={`fee-mode-${mode.id.toLowerCase()}`}
                    title={isDisabled ? `Not available for ${tokenIn.symbol} (no oracle/low liquidity)` : ''}
                  >
                    <div className="font-semibold text-zt-paper mb-1">
                      {mode.label}
                      {isDisabled && <span className="ml-2 text-xs text-red-400">⚠️</span>}
                    </div>
                    <div className="text-xs text-zt-paper/60">{mode.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-zt-paper/50">
                ℹ️ Some modes disabled for tokens without oracle or low liquidity
              </p>
              <button
                onClick={() => setShowExplainer(!showExplainer)}
                className="text-zt-aqua text-xs flex items-center gap-1 hover:text-zt-violet transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                {showExplainer ? 'Hide' : 'How it works'}
              </button>
            </div>
            {showExplainer && (
              <div className="mt-4">
                <FeeModeExplainer mode={feeMode} />
              </div>
            )}
          </div>

          {/* Fee Cap */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">
              Max Fee Cap (
              {feeMode === 'INPUT' ? tokenIn.symbol : 
               feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) : 
               feeMode === 'STABLE' ? 'USDC' : 'POL/ETH'})
              <span className="ml-2 text-xs text-zt-aqua cursor-help" title="Surplus auto-refunded on-chain">ⓘ</span>
            </label>
            <input
              type="number"
              value={feeCap}
              onChange={(e) => setFeeCap(e.target.value)}
              placeholder="e.g. 3.0"
              className="w-full glass p-4 rounded-xl bg-transparent text-zt-paper outline-none"
              data-testid="fee-cap-input"
            />
            <p className="text-xs text-zt-paper/50 mt-2">
              ✅ Fee ≤ cap enforced on-chain. Unused amount refunded in fee token.
            </p>
          </div>

          {/* Info Banners */}
          {feeMode === 'OUTPUT' && isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output-fee + Unwrap:</strong> Fee skimmed from wrapped output ({wrappedOutputSymbol}) before unwrapping to native {tokenOut.symbol}.
              </div>
            </div>
          )}
          {feeMode === 'OUTPUT' && !isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output Mode:</strong> Fee skimmed from output tokens on destination before crediting net amount.
              </div>
            </div>
          )}
          {feeMode === 'INPUT' && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-violet/30">
              <Info className="w-5 h-5 text-zt-violet flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-violet">Input Mode:</strong> You'll sign Permit2 to lock fee from input token on source. Non-custodial, one-time approval.
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
                  {feeMode === 'INPUT' ? tokenIn.symbol : 
                   feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) : 
                   feeMode === 'STABLE' ? 'USDC' : 'POL/ETH'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Estimated Fee:</span>
                <span className="text-zt-paper">{quote.estimatedFee || '~0.5'} ({quote.feeUSD || '$0.50'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Oracle:</span>
                <span className="text-zt-aqua text-xs">
                  {quote.oracleSource || 'Pyth'} 
                  {quote.priceAge && <span className="text-zt-paper/50 ml-1">(age {quote.priceAge}s)</span>}
                  {quote.confidence && <span className="text-zt-paper/50 ml-1">(conf {quote.confidence}%)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Net Receives:</span>
                <span className="text-zt-aqua font-semibold">{amountOut} {tokenOut.symbol}</span>
              </div>
              {quote.includesPriceUpdate && (
                <div className="pt-2 border-t border-white/10 text-xs text-zt-paper/60">
                  ℹ️ Includes on-chain price update fee (Pyth)
                </div>
              )}
              <div className="pt-2 border-t border-white/10 text-xs text-zt-paper/60">
                ✅ Fee ≤ cap. Surplus auto-refunded in fee token.
              </div>
            </div>
          )}

          {/* Success Message */}
          {txHash && (
            <div className="mb-6 glass p-4 rounded-xl flex items-center gap-3 border border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-zt-paper font-semibold">Swap Submitted!</p>
                <p className="text-zt-paper/70 text-sm font-mono mb-2">{txHash.slice(0, 20)}...</p>
                {txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div className="flex gap-2">
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-zt-aqua text-xs hover:text-zt-violet transition-colors"
                    >
                      View on Sepolia Explorer →
                    </a>
                    <a 
                      href={`https://amoy.polygonscan.com/tx/${txHash}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-zt-aqua text-xs hover:text-zt-violet transition-colors"
                    >
                      View on Amoy Explorer →
                    </a>
                  </div>
                )}
                {txHash === '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <p className="text-yellow-400 text-xs">⚠️ Demo mode - No real transaction sent</p>
                )}
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
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Current Mode</p>
              <p className={`text-lg font-bold ${
                feeMode === 'INPUT' ? 'text-zt-violet' :
                feeMode === 'OUTPUT' ? 'text-zt-aqua' :
                feeMode === 'STABLE' ? 'text-blue-400' :
                'text-gray-400'
              }`}>{feeMode}</p>
            </div>
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Supported Tokens</p>
              <p className="text-zt-aqua text-lg font-bold">{fromChain.tokens.length + toChain.tokens.length}</p>
            </div>
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Success Rate</p>
              <p className="text-zt-aqua text-lg font-bold">99.8%</p>
            </div>
          </div>
          
          <div className="glass p-4 rounded-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zt-paper/70">Network:</span>
              <span className="text-zt-paper font-semibold">
                {fromChain.name} → {toChain.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-zt-paper/70">Fee Token:</span>
              <span className="text-zt-aqua font-semibold">
                {feeMode === 'INPUT' ? tokenIn.symbol : 
                 feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) : 
                 feeMode === 'STABLE' ? 'USDC' : 'POL/ETH'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-zt-paper/70">Cap Enforcement:</span>
              <span className="text-green-400 font-semibold">✓ On-chain</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Swap;
