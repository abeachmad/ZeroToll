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
              Execute swaps and bridges across Polygon without holding native gas. 
              Pay fees in any token you're swapping (input/output), stablecoins, or native—your choice. 
              Powered by ERC-4337 and optimistic settlement.
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
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Any-Token Fee Payment</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                No need to hold native POL or ETH. Pay fees in any token you're swapping—input, output, 
                stablecoins, or native. ERC-4337 paymaster fronts gas with transparent caps and auto-refunds.
              </p>
            </div>

            <div className="glass p-8 rounded-2xl hover-lift" data-testid="feature-crosschain">
              <div className="w-14 h-14 rounded-xl bg-zt-aqua/20 flex items-center justify-center mb-6">
                <Globe className="w-7 h-7 text-zt-aqua" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Cross-Chain Routing</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                Seamlessly bridge between Polygon Amoy ↔ Ethereum Sepolia. 
                Output-fee skimming on destination + Input-fee locking on source (Permit2). 
                Optimistic settlement ensures relayers get reimbursed securely.
              </p>
            </div>

            <div className="glass p-8 rounded-2xl hover-lift" data-testid="feature-secure">
              <div className="w-14 h-14 rounded-xl bg-zt-violet/20 flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-zt-violet" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Secure & Transparent</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                Permissionless LP vault, RFQ auctions for best rates, and AI-ready 
                scoring for optimal route selection. All on-chain and auditable.
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
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">Sign Your Intent</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  Choose your source/destination chains and tokens. Select fee mode: Native, Use Input Token (Permit2), 
                  Use Output Token (skim on dest), or Stable. Sign EIP-712 intent with fee cap. No native gas required.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-zt-aqua flex items-center justify-center flex-shrink-0 text-xl font-bold text-zt-ink">
                2
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">Relayers Compete</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  RFQ auction selects the best relayer quote. Relayer submits your UserOp 
                  to the 4337 bundler and fronts the native gas.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-zt-violet flex items-center justify-center flex-shrink-0 text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">Pay in Any Token</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  Paymaster charges you in your chosen fee token (input/output/stable/native), capped at your limit. 
                  Surplus auto-refunded in fee token. Output mode skims fee before crediting net tokens. 
                  Relayer gets reimbursed from LP vault after settlement.
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
            Start swapping cross-chain without worrying about native gas tokens.
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
              <h4 className="text-zt-paper font-semibold mb-3">Contracts (Testnet)</h4>
              <div className="space-y-2 text-sm text-zt-paper/60 font-mono">
                <p>Paymaster: 0x742d...bEb0</p>
                <p>RouterHub: 0x8f3C...9A2d</p>
                <p>VaultStableFloat: 0x1a2B...4C5D</p>
                <p>SettlementHub: 0x9e8F...7B6A</p>
              </div>
            </div>
            <div>
              <h4 className="text-zt-paper font-semibold mb-3">Resources</h4>
              <div className="space-y-2 text-sm">
                <a href="https://github.com/abeachmad/ZeroToll" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">GitHub</a>
                <a href="https://docs.polygon.technology" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">Polygon Docs</a>
                <a href="https://eips.ethereum.org/EIPS/eip-4337" target="_blank" rel="noopener noreferrer" className="block text-zt-paper/60 hover:text-zt-aqua transition-colors">ERC-4337 Spec</a>
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
            <p>© 2025 ZeroToll. MIT License. Powered by Polygon & ERC-4337.</p>
            <p className="mt-2">Testnet: Polygon Amoy (80002) · Ethereum Sepolia (11155111)</p>
            <p className="mt-2 text-xs">⚠️ Testnet demo. Permissionless LP vault. Non-custodial.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
