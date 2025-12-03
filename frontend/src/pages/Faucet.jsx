import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Droplets, Loader2, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import ConnectButton from '../components/ConnectButton';
import contractsConfig from '../config/contracts.json';
import sepoliaTokens from '../config/tokenlists/zerotoll.tokens.sepolia.json';
import amoyTokens from '../config/tokenlists/zerotoll.tokens.amoy.json';

// ZeroTollToken ABI (minimal for faucet)
const ZTOKEN_ABI = [
  {
    name: 'faucet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'faucetAmount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

// Chain configurations
const chains = [
  { 
    id: 11155111, 
    name: 'Ethereum Sepolia', 
    logo: '⭐',
    explorer: 'https://sepolia.etherscan.io',
    tokens: sepoliaTokens.tokens.filter(t => t.symbol.startsWith('z'))
  },
  { 
    id: 80002, 
    name: 'Polygon Amoy', 
    logo: '🔷',
    explorer: 'https://amoy.polygonscan.com',
    tokens: amoyTokens.tokens.filter(t => t.symbol.startsWith('z'))
  },
];

const Faucet = () => {
  const navigate = useNavigate();
  const { address, isConnected, chain } = useAccount();
  
  const [selectedChain, setSelectedChain] = useState(chains[0]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [balances, setBalances] = useState({});

  // Wagmi hooks for faucet
  const { writeContract: callFaucet, data: faucetHash, isPending } = useWriteContract();
  const { isSuccess: faucetSuccess, isLoading: faucetConfirming } = useWaitForTransactionReceipt({ 
    hash: faucetHash 
  });

  // Update selected chain based on wallet
  useEffect(() => {
    if (chain) {
      const matchingChain = chains.find(c => c.id === chain.id);
      if (matchingChain) {
        setSelectedChain(matchingChain);
      }
    }
  }, [chain]);

  // Set default token when chain changes
  useEffect(() => {
    if (selectedChain.tokens.length > 0) {
      setSelectedToken(selectedChain.tokens[0]);
    }
  }, [selectedChain]);

  // Handle faucet success
  useEffect(() => {
    if (faucetSuccess && faucetHash) {
      setTxHash(faucetHash);
      toast.success(`🎉 Received 1,000 ${selectedToken?.symbol}!`);
      setLoading(false);
    }
  }, [faucetSuccess, faucetHash, selectedToken]);

  const handleFaucet = async (token) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (chain?.id !== selectedChain.id) {
      toast.error(`Please switch to ${selectedChain.name} in your wallet`);
      return;
    }

    setLoading(true);
    setSelectedToken(token);
    setTxHash(null);

    try {
      toast.info(`🚰 Requesting ${token.symbol} from faucet...`);
      
      await callFaucet({
        address: token.address,
        abi: ZTOKEN_ABI,
        functionName: 'faucet',
        args: [],
      });

      toast.info('⏳ Transaction submitted, waiting for confirmation...');
    } catch (error) {
      console.error('Faucet error:', error);
      setLoading(false);
      
      if (error.message?.includes('User rejected') || error.message?.includes('User denied')) {
        toast.error('❌ Transaction cancelled');
      } else {
        toast.error(error.shortMessage || error.message || 'Faucet request failed');
      }
    }
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied!');
  };

  const getPermitIcon = (token) => {
    if (token.permitType === 'ERC2612') return '⚡';
    if (token.permitType === 'permit2') return '🔄';
    return '⚠️';
  };

  const getPermitLabel = (token) => {
    if (token.permitType === 'ERC2612') return 'ERC-2612 Permit';
    if (token.permitType === 'permit2') return 'Permit2';
    return 'Standard Approve';
  };

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      <header className="border-b border-white/10 backdrop-blur-sm bg-zt-ink/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zt-paper/70 hover:text-zt-aqua transition-colors"
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
              onClick={() => navigate('/swap')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            >
              Swap
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="glass-strong p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <Droplets className="w-8 h-8 text-zt-aqua" />
            <h1 className="text-3xl font-bold text-zt-paper">zToken Faucet</h1>
          </div>
          <p className="text-zt-paper/60 mb-8">
            Get free zTokens for testing gasless swaps. These tokens support ERC-2612 permit for fully gasless approvals.
          </p>

          {/* Chain Selector */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">Select Network</label>
            <div className="flex gap-4">
              {chains.map(chain => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain)}
                  className={`flex-1 glass p-4 rounded-xl transition-all ${
                    selectedChain.id === chain.id 
                      ? 'border-2 border-zt-aqua bg-zt-aqua/10' 
                      : 'border border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-2xl mb-2">{chain.logo}</div>
                  <div className="text-zt-paper font-semibold">{chain.name}</div>
                  <div className="text-zt-paper/50 text-sm">{chain.tokens.length} zTokens</div>
                </button>
              ))}
            </div>
          </div>

          {/* Token Grid */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">Available zTokens</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedChain.tokens.map(token => (
                <div 
                  key={token.address}
                  className="glass p-5 rounded-xl border border-white/10 hover:border-zt-aqua/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{token.logo}</span>
                        <span className="text-xl font-bold text-zt-paper">{token.symbol}</span>
                        <span className="text-sm px-2 py-0.5 rounded-full bg-zt-aqua/20 text-zt-aqua">
                          {getPermitIcon(token)} {getPermitLabel(token)}
                        </span>
                      </div>
                      <div className="text-zt-paper/50 text-sm mt-1">{token.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4 text-xs">
                    <code className="text-zt-paper/50 bg-white/5 px-2 py-1 rounded font-mono">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </code>
                    <button 
                      onClick={() => copyAddress(token.address)}
                      className="text-zt-paper/50 hover:text-zt-aqua transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a 
                      href={`${selectedChain.explorer}/token/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zt-paper/50 hover:text-zt-aqua transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <button
                    onClick={() => handleFaucet(token)}
                    disabled={loading || isPending || faucetConfirming || !isConnected}
                    className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      loading && selectedToken?.address === token.address
                        ? 'bg-zt-violet/50 text-zt-paper/50 cursor-wait'
                        : 'bg-gradient-to-r from-zt-violet to-zt-aqua text-white hover:opacity-90'
                    }`}
                  >
                    {loading && selectedToken?.address === token.address ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {faucetConfirming ? 'Confirming...' : 'Requesting...'}
                      </>
                    ) : (
                      <>
                        <Droplets className="w-5 h-5" />
                        Get 1,000 {token.symbol}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Success Message */}
          {txHash && (
            <div className="glass p-4 rounded-xl border border-green-500/30 bg-green-500/10">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Tokens Received!</span>
              </div>
              <a 
                href={`${selectedChain.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zt-aqua hover:underline text-sm flex items-center gap-1"
              >
                View transaction <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 glass p-5 rounded-xl border border-zt-aqua/20">
            <h3 className="text-lg font-semibold text-zt-paper mb-3">About zTokens</h3>
            <ul className="space-y-2 text-zt-paper/70 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-zt-aqua">⚡</span>
                <span><strong>ERC-2612 Permit:</strong> Sign a message instead of paying gas for approvals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zt-aqua">💰</span>
                <span><strong>Pyth Oracle Pricing:</strong> Real-time prices from Pyth Network (zUSDC = USDC, zETH = ETH, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zt-aqua">🔄</span>
                <span><strong>Gasless Swaps:</strong> Use with Pimlico mode for completely gasless trading</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zt-aqua">🧪</span>
                <span><strong>Testnet Only:</strong> These tokens have no real value and are for testing purposes</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Faucet;
