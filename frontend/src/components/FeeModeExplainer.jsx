import React from 'react';
import { Info, Lock, Zap, DollarSign, Coins } from 'lucide-react';

const FeeModeExplainer = ({ mode }) => {
  const explainers = {
    NATIVE: {
      icon: Zap,
      title: 'Native Gas Mode',
      steps: [
        'Paymaster fronts native gas (POL/ETH)',
        'You pay back in native token',
        'Standard ERC-4337 flow',
        'No permit required'
      ],
      color: 'text-gray-400'
    },
    INPUT: {
      icon: Lock,
      title: 'Input Token Mode',
      steps: [
        'Sign Permit2 to lock fee from input token',
        'Non-custodial, one-time approval',
        'Fee deducted on source chain',
        'Surplus auto-refunded in input token'
      ],
      color: 'text-zt-violet'
    },
    OUTPUT: {
      icon: Coins,
      title: 'Output Token Mode',
      steps: [
        'No upfront fee payment needed',
        'Bridge + swap executes normally',
        'FeeSink skims fee from output on destination',
        'You receive net amount after fee'
      ],
      color: 'text-zt-aqua'
    },
    STABLE: {
      icon: DollarSign,
      title: 'Stablecoin Mode',
      steps: [
        'Pay fee in USDC/USDT/DAI',
        'EIP-2612 permit or approval',
        'Fee charged on source chain',
        'Surplus auto-refunded in stablecoin'
      ],
      color: 'text-blue-400'
    }
  };

  const config = explainers[mode];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="glass p-4 rounded-xl border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <Icon className={`w-6 h-6 ${config.color}`} />
        <h4 className="text-zt-paper font-semibold">{config.title}</h4>
      </div>
      <ol className="space-y-2">
        {config.steps.map((step, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-zt-paper/70">
            <span className={`${config.color} font-bold flex-shrink-0`}>{idx + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default FeeModeExplainer;
