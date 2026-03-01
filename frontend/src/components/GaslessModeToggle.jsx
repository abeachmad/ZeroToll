/**
 * Toggle component for switching between gasless and regular swap modes
 */

import React from 'react';
import { Zap, Info, AlertTriangle } from 'lucide-react';

export default function GaslessModeToggle({ 
  isGaslessMode, 
  onToggle, 
  isGaslessReady,
  isSmartAccount,
  pimlicoAvailable,
  disabled = false,
}) {
  const canUseGasless = isGaslessReady && isSmartAccount && pimlicoAvailable;
  
  return (
    <div className="mb-6">
      <div className={`glass p-4 rounded-xl border ${
        isGaslessMode && canUseGasless
          ? 'border-zt-aqua/50 bg-zt-aqua/5'
          : 'border-white/10'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className={`w-5 h-5 ${
              isGaslessMode && canUseGasless ? 'text-zt-aqua' : 'text-zt-paper/50'
            }`} />
            <div>
              <div className="font-semibold text-zt-paper flex items-center gap-2">
                Gasless Swap
                {isGaslessMode && canUseGasless && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-zt-aqua/20 text-zt-aqua rounded-full">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-xs text-zt-paper/60">
                {canUseGasless 
                  ? 'Pay $0 gas fees (Pimlico sponsors)'
                  : 'Upgrade to smart account to enable'
                }
              </div>
            </div>
          </div>
          
          <button
            onClick={onToggle}
            disabled={disabled || !canUseGasless}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isGaslessMode && canUseGasless
                ? 'bg-zt-aqua'
                : 'bg-white/20'
            } ${
              disabled || !canUseGasless
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
            title={!canUseGasless ? 'Upgrade to smart account first' : ''}
          >
            <div
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                isGaslessMode && canUseGasless ? 'translate-x-7' : ''
              }`}
            />
          </button>
        </div>
        
        {isGaslessMode && canUseGasless && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-start gap-2 text-xs text-zt-paper/80">
              <Info className="w-4 h-4 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-zt-aqua mb-1">How Gasless Swaps Work</div>
                <ul className="space-y-1 text-zt-paper/70">
                  <li>✅ Pimlico paymaster sponsors your gas fees</li>
                  <li>✅ You sign a UserOperation (not a regular transaction)</li>
                  <li>✅ Swap fee (0.5%) deducted from output tokens</li>
                  <li>⚡ Transaction submitted via ERC-4337 bundler</li>
                </ul>
                <div className="mt-2 text-zt-violet/90 font-medium">
                  You pay: $0 gas + 0.5% swap fee
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!canUseGasless && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-start gap-2 text-xs text-zt-paper/70">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                {!isSmartAccount && (
                  <span>Upgrade to smart account above to enable gasless swaps</span>
                )}
                {isSmartAccount && !pimlicoAvailable && (
                  <span>Pimlico bundler unavailable on this network</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
