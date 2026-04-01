import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Globe } from 'lucide-react';
import LiveMetrics from '../components/LiveMetrics';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm fixed w-full z-50 bg-zt-ink/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ZeroToll" className="w-10 h-10" />
            <span className="text-2xl font-bold text-zt-paper tracking-tight">ZeroToll</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-zt-paper/70 hover:text-zt-aqua transition-colors">Features</a>
            <a href="#how" className="text-zt-paper/70 hover:text-zt-aqua transition-colors">How It Works</a>
            <button
              onClick={() => navigate('/market')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            >
              Market
            </button>
            <button
              onClick={() => navigate('/pool')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            >
              Pool
            </button>
            <button
              onClick={() => navigate('/faucet')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            >
              Faucet
            </button>
            <button
              onClick={() => navigate('/swap')}
              className="btn-primary"
              data-testid="header-launch-btn"
            >
              Launch App
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8 inline-block">
              <img src="/logo.svg" alt="ZeroToll" className="w-96 h-96 mx-auto" />
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="text-zt-paper">Zero native gas.</span>
              <br />
              <span className="text-zt-aqua">Smarter cross-chain.</span>
            </h1>
            <p className="text-lg sm:text-xl text-zt-paper/70 mb-12 max-w-2xl mx-auto">
              Execute gasless swaps across Ethereum Sepolia and Polygon Amoy without holding native gas.
              ZeroToll sponsors execution, recovers costs from token flow, and now includes a confidential
              intent path on Sepolia for staged private settlement experiments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/swap')}
                className="btn-primary text-lg hover-lift"
                data-testid="hero-get-started-btn"
              >
                Get Started <ArrowRight className="inline ml-2 w-5 h-5" />
              </button>
              <button
                className="btn-secondary text-lg hover-glow"
                data-testid="hero-learn-more-btn"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-zt-paper">
            Why ZeroToll?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass p-8 rounded-2xl hover-lift" data-testid="feature-gasless">
              <div className="w-14 h-14 rounded-xl bg-zt-violet/20 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-zt-violet" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Sponsored Gasless Execution</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                No need to hold native ETH or POL up front. ZeroToll fronts execution on supported flows,
                then recovers sponsored cost and protocol fees from token flow instead of forcing users
                to pre-fund native gas.
              </p>
            </div>

            <div className="glass p-8 rounded-2xl hover-lift" data-testid="feature-crosschain">
              <div className="w-14 h-14 rounded-xl bg-zt-aqua/20 flex items-center justify-center mb-6">
                <Globe className="w-7 h-7 text-zt-aqua" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Multichain Testnet Runtime</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                ZeroToll runs today on Ethereum Sepolia and Polygon Amoy, with native ETH delivery
                on Sepolia and confidential staged execution on Sepolia. Additional testnet expansion
                remains part of the roadmap, but the current live runtime is already multichain.
              </p>
            </div>

            <div className="glass p-8 rounded-2xl hover-lift" data-testid="feature-secure">
              <div className="w-14 h-14 rounded-xl bg-zt-violet/20 flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-zt-violet" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Secure & Transparent</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                ERC-4337 sponsorship, staged confidential settlement, explorer-verifiable execution,
                and explicit public-vs-demo boundaries keep the system auditable while ZeroToll
                evolves toward stronger multichain and privacy-native routing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-20 px-6 gradient-accent">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-zt-paper">
            How It Works
          </h2>
          <div className="space-y-12">
            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-zt-violet flex items-center justify-center flex-shrink-0 text-xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">Sign Authorization + Intent</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  Choose chain, tokens, and execution mode. Depending on token support, ZeroToll can use
                  signature-native authorization such as ERC-2612 today, and is designed to grow toward
                  same-address smart-EOA execution for generic ERC-20s.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-zt-aqua flex items-center justify-center flex-shrink-0 text-xl font-bold text-zt-ink">
                2
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">ZeroToll Sponsors Execution</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  The relayer and paymaster front the native gas cost. Public gasless swaps run through
                  ERC-4337 sponsorship, while the confidential path on Sepolia uses a staged
                  submit / execute / decrypt / finalize lifecycle.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-zt-violet flex items-center justify-center flex-shrink-0 text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">Repay From Token Flow</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  Instead of asking users to pre-fund ETH or POL, ZeroToll recovers sponsored cost and
                  protocol fees from swap token flow. On Sepolia, internal wrapped output can also be
                  finalized as native ETH before delivery.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Metrics Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <LiveMetrics />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center glass-strong p-12 rounded-3xl">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-zt-paper">
            Ready to go gasless?
          </h2>
          <p className="text-lg text-zt-paper/70 mb-8">
            Start swapping on supported testnets without worrying about native gas balances.
          </p>
          <button
            onClick={() => navigate('/swap')}
            className="btn-primary text-lg hover-lift"
            data-testid="cta-launch-btn"
          >
            Launch App <ArrowRight className="inline ml-2 w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="text-zt-paper font-semibold mb-3">Live Sepolia Components</h4>
              <div className="space-y-2 text-sm text-zt-paper/60 font-mono">
                <p>Paymaster: 0xAf7e...0054</p>
                <p>RouterHub: 0x8Bf6...4e84</p>
                <p>ConfidentialEscrow: 0xF85F...FFbe1</p>
                <p>Treasury: 0x2c73...C130</p>
              </div>
            </div>
            <div>
              <h4 className="text-zt-paper font-semibold mb-3">Resources</h4>
              <div className="space-y-2 text-sm">
                <a href="https://github.com/abeachmad/ZeroToll" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">GitHub</a>
                <a href="https://eips.ethereum.org/EIPS/eip-4337" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">ERC-4337 Spec</a>
                <a href="https://eips.ethereum.org/EIPS/eip-7702" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">EIP-7702 Spec</a>
                <a href="https://eips.ethereum.org/EIPS/eip-2612" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">ERC-2612 Spec</a>
              </div>
            </div>
            <div>
              <h4 className="text-zt-paper font-semibold mb-3">Legal</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">Terms of Service</a>
                <a href="#" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">Privacy Policy</a>
                <a href="https://github.com/abeachmad/ZeroToll/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">Security Policy</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-zt-paper/50 text-sm">
            <p>© 2025 ZeroToll. MIT License. Powered by multichain testnets, ERC-4337, and confidential intent R&D.</p>
            <p className="mt-2">Live today: Ethereum Sepolia (11155111) · Polygon Amoy (80002)</p>
            <p className="mt-2 text-xs">⚠️ Testnet demo. Confidential runtime currently focuses on Sepolia. Non-custodial.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
