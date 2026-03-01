/**
 * Banner prompting users to upgrade to EIP-7702 Smart Account
 */

import React from 'react';
import { Zap, X, Loader2, CheckCircle, Info } from 'lucide-react';

export default function UpgradeAccountBanner({ 
  onUpgrade, 
  onDismiss, 
  isUpgrading,
  isSmartAccount,
  canUpgrade,
}) {
  // Don't show if already upgraded
  if (isSmartAccount) {
    return null;
  }
  
  // Don't show if can't upgrade (not connected or Pimlico unavailable)
  if (!canUpgrade) {
    return null;
  }
  
  return (
    <div className="mb-6 glass p-4 rounded-xl border border-zt-aqua/30 bg-gradient-to-r from-zt-violet/10 to-zt-aqua/10">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Zap className="w-6 h-6 text-zt-aqua animate-pulse" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-zt-paper">Upgrade to Smart Account</h3>
            <span className="px-2 py-0.5 text-xs font-semibold bg-zt-aqua/20 text-zt-aqua rounded-full">
              EIP-7702
            </span>
          </div>
          
          <p className="text-sm text-zt-paper/80 mb-3">
            Enable <strong>gasless swaps</strong> with one click! Your EOA will be upgraded to support smart account features.
            Pay <strong>$0 gas</strong> - our paymaster sponsors your transactions.
          </p>
          
          <div className="flex items-center gap-2 text-xs text-zt-paper/60 mb-3">
            <Info className="w-4 h-4" />
            <span>One-time upgrade • Reversible • No funds at risk • Powered by MetaMask</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onUpgrade}
              disabled={isUpgrading}
              className="px-4 py-2 bg-gradient-to-r from-zt-violet to-zt-aqua text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Upgrading...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Upgrade Now (Free)</span>
                </>
              )}
            </button>
            
            <button
              onClick={onDismiss}
              disabled={isUpgrading}
              className="px-4 py-2 text-zt-paper/70 hover:text-zt-paper transition-colors text-sm"
            >
              Maybe Later
            </button>
          </div>
        </div>
        
        <button
          onClick={onDismiss}
          disabled={isUpgrading}
          className="flex-shrink-0 text-zt-paper/50 hover:text-zt-paper transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Success banner shown after upgrade
 */
export function UpgradeSuccessBanner({ onDismiss }) {
  return (
    <div className="mb-6 glass p-4 rounded-xl border border-green-500/30 bg-green-500/10">
      <div className="flex items-start gap-3">
        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1">
          <h3 className="font-bold text-zt-paper mb-1">Smart Account Activated! 🎉</h3>
          <p className="text-sm text-zt-paper/80 mb-2">
            Your account is now upgraded. Toggle "Gasless Mode" below to start swapping without gas fees!
          </p>
        </div>
        
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-zt-paper/50 hover:text-zt-paper transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
