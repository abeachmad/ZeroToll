import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Users, ArrowRight, CheckCircle, Circle, Code, Database, Globe, Shield, Layers, GitBranch } from 'lucide-react';
import ConnectButton from '../components/ConnectButton';

export default function Docs() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: Globe },
    { id: 'architecture', title: 'Architecture', icon: Layers },
    { id: 'gasless', title: 'Gasless Swaps', icon: Zap },
    { id: 'crosschain', title: 'Cross-Chain', icon: GitBranch },
    { id: 'pools', title: 'Liquidity Pools', icon: Database },
    { id: 'security', title: 'Security', icon: Shield },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">What is ZeroToll?</h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                ZeroToll is a gasless DeFi protocol that eliminates the need for users to hold native tokens (ETH, POL) 
                for gas fees. Users can swap tokens and interact with DeFi without worrying about gas costs.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mb-3" />
                  <h3 className="text-xl font-semibold text-white mb-2">For Users</h3>
                  <p className="text-gray-400">Swap any token without holding ETH or POL for gas. True gasless experience.</p>
                </div>
                <div className="p-6 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <Users className="w-8 h-8 text-cyan-400 mb-3" />
                  <h3 className="text-xl font-semibold text-white mb-2">For LPs</h3>
                  <p className="text-gray-400">Earn high yields by providing liquidity to the community paymaster pool.</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Key Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: '⚡', title: 'EIP-7702 Smart Accounts', desc: 'Upgrade EOA to smart account in one click' },
                  { icon: '🆓', title: 'True Gasless Swaps', desc: 'Zero native tokens required for transactions' },
                  { icon: '🌉', title: 'Cross-Chain Swaps', desc: 'Bridge tokens between Amoy and Sepolia' },
                  { icon: '💰', title: 'High Yield Pools', desc: 'Earn up to 3000% APY from swap fees' },
                  { icon: '🔮', title: 'Live Oracle Prices', desc: 'Real-time Pyth Network integration' },
                  { icon: '🔐', title: 'Fully On-Chain', desc: 'All transactions verifiable on explorers' }
                ].map((feature, i) => (
                  <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-2xl mb-2">{feature.icon}</div>
                    <h4 className="font-semibold text-white mb-1">{feature.title}</h4>
                    <p className="text-sm text-gray-500">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'architecture':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-4">System Architecture</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">ZeroToll consists of multiple components working together to provide gasless DeFi experience.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: 'Frontend (React)', description: 'User interface with EIP-7702 smart account integration', tech: 'React, Tailwind, wagmi, viem', color: 'cyan' },
                { name: 'Smart Contracts', description: 'RouterHub, DEX adapters, bridge adapters, price oracles', tech: 'Solidity, Hardhat, OpenZeppelin', color: 'violet' },
                { name: 'Account Abstraction', description: 'EIP-7702 smart accounts with gasless transactions', tech: 'ERC-4337, Pimlico paymaster', color: 'emerald' },
                { name: 'Cross-Chain Bridge', description: 'LayerZero-style message passing between chains', tech: 'MockLayerZeroAdapter, event-based relaying', color: 'orange' }
              ].map((component, i) => {
                const colors = { cyan: 'from-cyan-500/20 border-cyan-500/30', violet: 'from-violet-500/20 border-violet-500/30', emerald: 'from-emerald-500/20 border-emerald-500/30', orange: 'from-orange-500/20 border-orange-500/30' };
                return (
                  <div key={i} className={`p-6 rounded-xl border bg-gradient-to-br ${colors[component.color]} to-transparent backdrop-blur-sm`}>
                    <Code className="w-8 h-8 text-white/70 mb-3" />
                    <h3 className="text-xl font-semibold text-white mb-2">{component.name}</h3>
                    <p className="text-gray-400 mb-3">{component.description}</p>
                    <p className="text-sm text-gray-500 font-mono">{component.tech}</p>
                  </div>
                );
              })}
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Contract Addresses</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="text-cyan-400 font-semibold mb-2">Polygon Amoy</h4>
                  <div className="space-y-1 font-mono text-gray-400">
                    <div>RouterHub: <span className="text-white">0x49AD...4881</span></div>
                    <div>MockDexAdapter: <span className="text-white">0xc8A7...15d1</span></div>
                    <div>BridgeAdapter: <span className="text-white">0x3494...bE50</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-violet-400 font-semibold mb-2">Ethereum Sepolia</h4>
                  <div className="space-y-1 font-mono text-gray-400">
                    <div>RouterHub: <span className="text-white">0x8Bf6...4e84</span></div>
                    <div>MockDexAdapter: <span className="text-white">0x86D1...E84B</span></div>
                    <div>BridgeAdapter: <span className="text-white">0x73F0...6A4C</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'gasless':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-4">How Gasless Swaps Work</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">ZeroToll uses EIP-7702 smart accounts and ERC-4337 account abstraction to eliminate gas fees for users.</p>
            <div className="space-y-6">
              {[
                { step: 1, title: 'User Connects', desc: 'Connect wallet and upgrade to EIP-7702 smart account' },
                { step: 2, title: 'Enable Gasless', desc: 'Toggle gasless mode - paymaster sponsors gas fees' },
                { step: 3, title: 'Execute Swap', desc: 'Swap tokens with zero gas cost to user' },
                { step: 4, title: 'Fee Payment', desc: 'Swap fees paid in output tokens, not native gas' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold">{item.step}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <h3 className="text-xl font-semibold text-white mb-3">Technical Implementation</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span><strong>EIP-7702:</strong> Upgrade EOA to smart account with delegation</span></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span><strong>ERC-4337:</strong> Account abstraction for gasless transactions</span></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span><strong>Pimlico Paymaster:</strong> Sponsors gas fees for user operations</span></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span><strong>Fee Payment:</strong> Swap fees paid in output tokens, not ETH/POL</span></li>
              </ul>
            </div>
          </div>
        );

      case 'crosschain':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-4">Cross-Chain Architecture</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">ZeroToll enables gasless swaps across different blockchains using a SushiXSwap-inspired architecture.</p>
            <div className="space-y-4">
              {[
                { step: 1, title: 'Initiate on Source', desc: 'User swaps on Amoy (gasless), tokens locked' },
                { step: 2, title: 'Bridge Message', desc: 'MockLayerZeroAdapter emits cross-chain event' },
                { step: 3, title: 'Relayer Picks Up', desc: 'Off-chain relayer monitors events' },
                { step: 4, title: 'Execute on Destination', desc: 'Relayer calls receiveMessage on Sepolia' },
                { step: 5, title: 'Deliver Tokens', desc: 'User receives tokens on destination chain' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm font-bold">{item.step}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <h3 className="text-xl font-semibold text-white mb-3">Current Implementation</h3>
                <ul className="space-y-2 text-gray-400">
                  <li>• MockLayerZeroAdapter for testnet</li>
                  <li>• Event-based message passing</li>
                  <li>• Off-chain relayer service</li>
                  <li>• Amoy ↔ Sepolia bridge</li>
                </ul>
              </div>
              <div className="p-6 rounded-xl bg-violet-500/10 border border-violet-500/30">
                <h3 className="text-xl font-semibold text-white mb-3">Production Ready</h3>
                <ul className="space-y-2 text-gray-400">
                  <li>• Real LayerZero V2 OApp</li>
                  <li>• Chainlink CCIP integration</li>
                  <li>• Automated relayer network</li>
                  <li>• Multi-chain support</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'pools':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-4">Liquidity Pools</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">ZeroToll's liquidity pools fund the paymaster and provide high yields to liquidity providers.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <h3 className="text-xl font-semibold text-white mb-3">Community Paymaster Pool</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-gray-400">Current APY</span><span className="text-emerald-400 font-bold">3,000%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Total Liquidity</span><span className="text-white">$1,000</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Fee Share</span><span className="text-cyan-400">20%</span></div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-3">How It Works</h3>
                <ul className="space-y-2 text-gray-400">
                  <li>• Deposit USDC to fund gas costs</li>
                  <li>• Earn 20% of all swap fees</li>
                  <li>• No lock period, withdraw anytime</li>
                  <li>• Bonus $ZEROTOLL token rewards</li>
                </ul>
              </div>
            </div>
            <div className="p-6 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <h3 className="text-xl font-semibold text-white mb-3">Fee Distribution Model</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-orange-400 font-semibold mb-2">Revenue Sources</h4>
                  <ul className="space-y-1 text-gray-400">
                    <li>• 0.5% swap fee on each trade</li>
                    <li>• Cross-chain bridge fees</li>
                    <li>• MEV capture (future)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-orange-400 font-semibold mb-2">Distribution</h4>
                  <ul className="space-y-1 text-gray-400">
                    <li>• 80% → Protocol treasury</li>
                    <li>• 20% → Liquidity providers</li>
                    <li>• Gas costs: ~$10-20/day</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-4">Security & Audits</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">ZeroToll prioritizes security with multiple layers of protection and best practices.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <Shield className="w-8 h-8 text-emerald-400 mb-3" />
                <h3 className="text-xl font-semibold text-white mb-3">Smart Contract Security</h3>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span>OpenZeppelin contracts</span></li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span>Reentrancy protection</span></li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span>Access control patterns</span></li>
                  <li className="flex items-center gap-2"><Circle className="w-4 h-4 text-gray-500" /><span>Formal audit (planned)</span></li>
                </ul>
              </div>
              <div className="p-6 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <Code className="w-8 h-8 text-cyan-400 mb-3" />
                <h3 className="text-xl font-semibold text-white mb-3">Account Abstraction</h3>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /><span>EIP-7702 delegation</span></li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /><span>ERC-4337 compliance</span></li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /><span>Pimlico paymaster</span></li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /><span>User operation validation</span></li>
                </ul>
              </div>
            </div>
            <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30">
              <h3 className="text-xl font-semibold text-white mb-3">Risk Considerations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-red-400 font-semibold mb-2">Smart Contract Risks</h4>
                  <ul className="space-y-1 text-gray-400 text-sm">
                    <li>• Unaudited testnet contracts</li>
                    <li>• Oracle price manipulation</li>
                    <li>• Bridge message spoofing</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-red-400 font-semibold mb-2">Operational Risks</h4>
                  <ul className="space-y-1 text-gray-400 text-sm">
                    <li>• Relayer downtime</li>
                    <li>• Paymaster fund depletion</li>
                    <li>• Network congestion</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <header className="relative z-50 border-b border-white/10 backdrop-blur-xl bg-black/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
            <ArrowLeft className="w-5 h-5" /><span className="font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ZeroToll Docs</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="sticky top-24 space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeSection === section.id
                      ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <section.icon className="w-5 h-5" />
                  <span className="font-medium">{section.title}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              {renderSection()}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>© 2025 ZeroToll. Making DeFi gasless for everyone.</p>
        </div>
      </footer>
    </div>
  );
}
