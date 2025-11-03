import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Globe } from 'lucide-react';

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
              Pay fees in stablecoins. Powered by ERC-4337 and optimistic settlement.
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
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Gasless Transactions</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                No need to hold native POL or ETH. Our ERC-4337 paymaster fronts gas costs 
                and charges you in stablecoins with transparent fee caps.
              </p>
            </div>

            <div className="glass p-8 rounded-2xl hover-lift" data-testid="feature-crosschain">
              <div className="w-14 h-14 rounded-xl bg-zt-aqua/20 flex items-center justify-center mb-6">
                <Globe className="w-7 h-7 text-zt-aqua" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-zt-paper">Cross-Chain Routing</h3>
              <p className="text-zt-paper/70 leading-relaxed">
                Seamlessly bridge between Polygon Amoy and Ethereum Sepolia. 
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
                  Choose your source/destination chains and tokens. Sign an EIP-712 intent 
                  with your stablecoin fee cap. No native gas required.
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
                <h3 className="text-2xl font-bold mb-3 text-zt-paper">Pay in Stablecoins</h3>
                <p className="text-zt-paper/70 leading-relaxed">
                  Paymaster charges you in USDC/USDT/DAI, capped at your fee limit. 
                  Surplus is refunded. Relayer gets reimbursed from the LP vault after settlement.
                </p>
              </div>
            </div>
          </div>
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
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-zt-paper/50 text-sm">
          <p>© 2025 ZeroToll. Powered by Polygon & ERC-4337.</p>
          <p className="mt-2">Testnet: Amoy · Sepolia</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
