import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  EyeOff,
  Globe,
  Lock,
  Shield,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import LiveMetrics from '../components/LiveMetrics';

const heroStatus = [
  {
    title: 'Public gasless swaps',
    detail: 'Live on Ethereum Sepolia and Polygon Amoy',
    tone: 'text-emerald-300',
    border: 'border-emerald-400/20',
    icon: Zap,
  },
  {
    title: 'Confidential intent path',
    detail: 'Live staged execution on Sepolia with private thresholds',
    tone: 'text-cyan-300',
    border: 'border-cyan-400/20',
    icon: EyeOff,
  },
  {
    title: 'Native ETH delivery',
    detail: 'Internal wrapped output can finalize as native ETH on Sepolia',
    tone: 'text-violet-300',
    border: 'border-violet-400/20',
    icon: ArrowUpRight,
  },
];

const pillars = [
  {
    title: 'Gasless by default',
    description:
      'ZeroToll fronts native gas through its own sponsorship stack, then settles cost back from token flow instead of making users top up ETH or POL first.',
    icon: Zap,
    accent: 'bg-violet-500/15 text-violet-300',
  },
  {
    title: 'Private when it matters',
    description:
      'Users can choose a confidential staged path on Sepolia where a private execution threshold is encrypted in the browser and enforced through escrow-based finalization.',
    icon: EyeOff,
    accent: 'bg-cyan-500/15 text-cyan-300',
  },
  {
    title: 'Native output, not just wrapped output',
    description:
      'ZeroToll can take public or confidential execution all the way through to native ETH delivery on Sepolia, which is much closer to how users expect swaps to finish.',
    icon: Globe,
    accent: 'bg-emerald-500/15 text-emerald-300',
  },
  {
    title: 'Explorer-verifiable execution',
    description:
      'Public swaps, staged confidential lifecycle steps, and contract addresses are all visible and auditable, so the product story is tied to real on-chain proof rather than mock UI only.',
    icon: Shield,
    accent: 'bg-amber-500/15 text-amber-300',
  },
];

const executionLanes = [
  {
    eyebrow: 'Fast path',
    title: 'Public gasless execution',
    description:
      'For the common path, users sign authorization plus intent, ZeroToll sponsors execution, and the fee is recouped from swap token flow. This is the practical daily-use lane.',
    bullets: [
      'ERC-4337 sponsorship already live',
      'No native gas required up front',
      'Native ETH delivery already working on Sepolia',
    ],
    accent: 'border-violet-400/20 bg-violet-500/10',
    icon: Zap,
  },
  {
    eyebrow: 'Optional private path',
    title: 'Confidential gasless intent',
    description:
      'For users who care about keeping their threshold private, ZeroToll runs a staged submit / execute / decrypt / finalize lifecycle on Sepolia using CoFHE-backed browser encryption and on-chain escrow.',
    bullets: [
      'Private threshold encrypted client-side',
      'Submit / execute / decrypt / finalize lifecycle',
      'Live today on Sepolia, still intentionally staged',
    ],
    accent: 'border-cyan-400/20 bg-cyan-500/10',
    icon: Lock,
  },
];

const privateFacts = [
  {
    label: 'What stays private',
    value: 'The user threshold / confidential execution guard',
  },
  {
    label: 'What stays public',
    value: 'Chain, token pair, amount in, and settlement transactions',
  },
  {
    label: 'Why it is staged',
    value: 'Encrypted checks need submit / execute / decrypt / finalize instead of one-step public settlement',
  },
];

const rewardFacts = [
  {
    title: '80% to pool providers',
    description:
      'The planned community gas pool routes the majority of protocol fee flow to liquidity providers who help keep ZeroToll’s gas tank funded.',
  },
  {
    title: '15% to operations',
    description:
      'A smaller slice is reserved for infrastructure, relayer operations, and protocol upkeep so the gasless runtime stays online.',
  },
  {
    title: '5% to reserve',
    description:
      'A reserve layer is designed to protect the system during rough network conditions and help avoid downtime in the paymaster stack.',
  },
  {
    title: 'Illustrative APR model',
    description:
      'Current docs model a $10k community pool and $60/day fees at roughly $1,440 monthly LP rewards, or about 173% annualized. This is a projection, not live guaranteed yield.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Choose your lane',
    description:
      'Users decide whether they want the faster public gasless path or the staged confidential path on Sepolia. The UI should make that difference obvious instead of hiding it.',
  },
  {
    number: '02',
    title: 'Authorize without funding native gas',
    description:
      'Depending on token support, the user signs permit-style authorization and the ZeroToll intent. Sponsorship begins once the chosen execution lane is ready to run.',
  },
  {
    number: '03',
    title: 'ZeroToll fronts execution',
    description:
      'The relayer, paymaster, and settlement contracts take over. Public swaps execute through the normal sponsored path, while private intent runs through staged confidential settlement.',
  },
  {
    number: '04',
    title: 'Fee recovery closes the loop',
    description:
      'ZeroToll recovers sponsored cost and protocol fee from token flow, which is also the basis for the future community gas pool reward model.',
  },
];

const resourceLinks = [
  { label: 'GitHub', href: 'https://github.com/abeachmad/ZeroToll' },
  { label: 'ERC-4337 Spec', href: 'https://eips.ethereum.org/EIPS/eip-4337' },
  { label: 'EIP-7702 Spec', href: 'https://eips.ethereum.org/EIPS/eip-7702' },
  { label: 'ERC-2612 Spec', href: 'https://eips.ethereum.org/EIPS/eip-2612' },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-hidden bg-zt-ink noise-overlay">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-20 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-[160px]" />
        <div className="absolute right-[-8rem] top-52 h-[24rem] w-[24rem] rounded-full bg-cyan-400/15 blur-[140px]" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/10 blur-[180px]" />
      </div>

      <header className="fixed z-50 w-full border-b border-white/10 bg-zt-ink/75 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ZeroToll" className="h-10 w-10" />
            <span className="text-2xl font-bold tracking-tight text-zt-paper">ZeroToll</span>
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#advantages" className="text-zt-paper/70 transition-colors hover:text-zt-aqua">Advantages</a>
            <a href="#private" className="text-zt-paper/70 transition-colors hover:text-zt-aqua">Private</a>
            <a href="#rewards" className="text-zt-paper/70 transition-colors hover:text-zt-aqua">Rewards</a>
            <button
              onClick={() => navigate('/market')}
              className="text-zt-paper/70 transition-colors hover:text-zt-aqua"
            >
              Market
            </button>
            <button
              onClick={() => navigate('/pool')}
              className="text-zt-paper/70 transition-colors hover:text-zt-aqua"
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

      <section className="relative px-6 pb-24 pt-32">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Live on Ethereum Sepolia + Polygon Amoy
            </div>

            <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] text-zt-paper sm:text-6xl lg:text-7xl">
              Gasless by default.
              <br />
              <span className="text-zt-aqua">Private when it matters.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zt-paper/72 sm:text-xl">
              ZeroToll sponsors DeFi execution so users do not need native gas up front, can finish into native ETH on Sepolia,
              and can optionally choose a confidential staged path when they want their execution threshold kept private.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={() => navigate('/swap')}
                className="btn-primary text-lg hover-lift"
                data-testid="hero-get-started-btn"
              >
                Launch Gasless Swap <ArrowRight className="ml-2 inline h-5 w-5" />
              </button>
              <button
                onClick={() => navigate('/pool')}
                className="btn-secondary text-lg hover-glow"
                data-testid="hero-pool-btn"
              >
                Explore Pool Economics
              </button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="glass rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zt-paper/45">Execution</p>
                <p className="mt-2 text-sm font-semibold text-zt-paper">ERC-4337 sponsorship + fee recovery from token flow</p>
              </div>
              <div className="glass rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zt-paper/45">Private mode</p>
                <p className="mt-2 text-sm font-semibold text-zt-paper">CoFHE-encrypted threshold with staged settlement on Sepolia</p>
              </div>
              <div className="glass rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zt-paper/45">Gas pool</p>
                <p className="mt-2 text-sm font-semibold text-zt-paper">Community reward model planned around protocol fee flow</p>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <div className="glass-strong relative overflow-hidden rounded-[2rem] p-6 shadow-[0_24px_80px_rgba(68,224,198,0.08)]">
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-cyan-400/15 via-transparent to-violet-500/15" />
              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zt-paper/45">What makes ZeroToll stand out</p>
                    <h2 className="mt-2 text-2xl font-bold text-zt-paper">One product, two execution lanes</h2>
                  </div>
                  <button
                    onClick={() => navigate('/docs')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zt-paper/75 transition-colors hover:text-zt-aqua"
                  >
                    Docs <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {heroStatus.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className={`glass rounded-2xl border ${item.border} p-5`}>
                        <div className="flex items-start gap-4">
                          <div className={`rounded-2xl p-3 ${item.tone} bg-white/5`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zt-paper">{item.title}</p>
                            <p className={`mt-1 text-sm ${item.tone}`}>{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-amber-300/80">Fee loop</p>
                    <p className="mt-3 text-xl font-bold text-zt-paper">Sponsor first, recover later</p>
                    <p className="mt-2 text-sm leading-relaxed text-zt-paper/70">
                      ZeroToll fronts execution, then recovers sponsored cost plus protocol fee from token flow instead of demanding a native gas balance up front.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Pool upside</p>
                    <p className="mt-3 text-xl font-bold text-zt-paper">Fee flow becomes reward flow</p>
                    <p className="mt-2 text-sm leading-relaxed text-zt-paper/70">
                      The future community gas pool turns sponsored execution into a treasury-backed reward system for liquidity providers who help keep the gas tank healthy.
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-xs leading-relaxed text-zt-paper/45">
                  Confidential mode is live on Sepolia as a staged experimental path. The homepage now treats it as a real feature with an explicit execution model, not hidden side functionality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="advantages" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zt-aqua/80">Advantages</p>
            <h2 className="mt-4 text-4xl font-bold text-zt-paper sm:text-5xl">
              ZeroToll fixes the parts of DeFi that users feel immediately
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-zt-paper/68">
              The homepage now puts the real differentiators front and center: gasless execution, optional private thresholds,
              native ETH delivery, and on-chain proof that the system is not just a mock concept.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="glass group rounded-[1.75rem] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(122,77,255,0.18)]">
                  <div className={`inline-flex rounded-2xl p-3 ${pillar.accent}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-zt-paper">{pillar.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-zt-paper/68">{pillar.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="private" className="px-6 py-24 gradient-accent">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/85">Private execution</p>
            <h2 className="mt-4 text-4xl font-bold text-zt-paper sm:text-5xl">
              The private mode should be a headline feature, not hidden in the swap form
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zt-paper/70">
              ZeroToll already has a Sepolia confidential path where the browser encrypts a private threshold,
              the protocol stages execution on-chain, and settlement finalizes after decryption. That is not the same
              thing as a normal public swap, and the homepage should say so clearly.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {executionLanes.map((lane) => {
                const Icon = lane.icon;
                return (
                  <div key={lane.title} className={`glass rounded-[1.75rem] border p-6 ${lane.accent}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zt-paper/45">{lane.eyebrow}</p>
                        <h3 className="mt-3 text-2xl font-bold text-zt-paper">{lane.title}</h3>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-3 text-zt-paper">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zt-paper/68">{lane.description}</p>
                    <div className="mt-5 space-y-3">
                      {lane.bullets.map((bullet) => (
                        <div key={bullet} className="flex items-start gap-3 text-sm text-zt-paper/72">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-strong rounded-[2rem] p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                <EyeOff className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zt-paper/45">What the page should explain</p>
                <h3 className="mt-1 text-2xl font-bold text-zt-paper">Public vs private boundaries</h3>
              </div>
            </div>

            <div className="mt-7 space-y-4">
              {privateFacts.map((fact) => (
                <div key={fact.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zt-paper/45">{fact.label}</p>
                  <p className="mt-3 text-sm leading-7 text-zt-paper/72">{fact.value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/swap')}
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/15"
            >
              Open Swap and choose Confidential Intent <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section id="rewards" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300/85">Pool rewards</p>
              <h2 className="mt-4 text-4xl font-bold text-zt-paper sm:text-5xl">
                Pool providers need a clearer upside story
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-zt-paper/70">
                ZeroToll is not only about trader UX. The long-term economics also depend on a community gas pool
                that keeps sponsored execution sustainable. The homepage should explain why someone would help fund that layer.
              </p>

              <div className="mt-8 rounded-[1.75rem] border border-amber-400/20 bg-amber-500/10 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/85">Phase 4 planned</p>
                <h3 className="mt-3 text-2xl font-bold text-zt-paper">Community gas pool / paymaster vault</h3>
                <p className="mt-4 text-sm leading-7 text-zt-paper/72">
                  The intended model is simple: ZeroToll sponsors user execution first, treasury receives protocol fee flow,
                  and the future community-backed gas pool shares most of that economics with providers who help keep the native gas runway funded.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zt-paper/45">LP rewards</p>
                    <p className="mt-2 text-3xl font-bold text-amber-300">80%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zt-paper/45">Operations</p>
                    <p className="mt-2 text-3xl font-bold text-zt-paper">15%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zt-paper/45">Reserve</p>
                    <p className="mt-2 text-3xl font-bold text-zt-paper">5%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {rewardFacts.map((fact) => (
                <div key={fact.title} className="glass rounded-[1.75rem] p-6">
                  <div className="inline-flex rounded-2xl bg-amber-500/10 p-3 text-amber-300">
                    <Coins className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-2xl font-bold text-zt-paper">{fact.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-zt-paper/68">{fact.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-300/85">How it works</p>
            <h2 className="mt-4 text-4xl font-bold text-zt-paper sm:text-5xl">
              A cleaner homepage should make the execution model feel obvious
            </h2>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="glass relative rounded-[1.75rem] p-7">
                <div className="absolute right-6 top-6 text-4xl font-extrabold text-white/7">{step.number}</div>
                <div className="inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zt-aqua/90">
                  Step {step.number}
                </div>
                <h3 className="mt-6 text-2xl font-bold text-zt-paper">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-zt-paper/68">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Protocol proof</p>
            <h2 className="mt-4 text-4xl font-bold text-zt-paper sm:text-5xl">
              Real metrics belong on the front page too
            </h2>
          </div>
          <LiveMetrics />
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/6 via-violet-500/10 to-cyan-400/10 p-8 shadow-[0_20px_80px_rgba(122,77,255,0.12)] sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zt-aqua/80">Get started</p>
              <h2 className="mt-4 text-4xl font-bold text-zt-paper sm:text-5xl">
                Swap without pre-funding native gas, then decide how private you want execution to be
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zt-paper/68">
                The page now makes the product promise much clearer: sponsored execution for everyday swaps,
                a staged private mode when threshold privacy matters, and a future community gas pool that turns protocol usage into provider rewards.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <button
                onClick={() => navigate('/swap')}
                className="btn-primary flex items-center justify-center gap-2 text-lg hover-lift"
                data-testid="cta-launch-btn"
              >
                Launch App <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate('/pool')}
                className="btn-secondary flex items-center justify-center gap-2 text-lg hover-glow"
              >
                View Pool Page <Wallet className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 grid gap-8 md:grid-cols-3">
            <div>
              <h4 className="mb-3 font-semibold text-zt-paper">Live Sepolia Components</h4>
              <div className="space-y-2 font-mono text-sm text-zt-paper/60">
                <p>Paymaster: 0xAf7e...0054</p>
                <p>RouterHub: 0x8Bf6...4e84</p>
                <p>ConfidentialEscrow: 0xF85F...FFbe1</p>
                <p>Treasury: 0x2c73...C130</p>
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-zt-paper">Resources</h4>
              <div className="space-y-2 text-sm">
                {resourceLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-zt-paper/60 transition-colors hover:text-zt-aqua"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-zt-paper">What deserves emphasis</h4>
              <div className="space-y-2 text-sm text-zt-paper/60">
                <p>Gasless execution without native top-ups</p>
                <p>Optional confidential staged settlement on Sepolia</p>
                <p>Community gas pool rewards as the long-term flywheel</p>
                <p>Explicit live-vs-planned boundaries</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 text-center text-sm text-zt-paper/50">
            <p>© 2025 ZeroToll. MIT License. Powered by multichain testnets, ERC-4337, and confidential intent R&D.</p>
            <p className="mt-2">Live today: Ethereum Sepolia (11155111) · Polygon Amoy (80002)</p>
            <p className="mt-2 text-xs">
              Confidential runtime currently focuses on Sepolia. Community gas pool rewards are a planned next economic layer, not a live guaranteed yield program yet.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
