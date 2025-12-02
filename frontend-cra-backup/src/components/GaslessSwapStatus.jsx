/**
 * GaslessSwapStatus Component
 * 
 * Shows real-time status of a gasless swap UserOp
 */

import React from 'react';
import { Loader2, CheckCircle, XCircle, Zap, FileSignature, Send, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  preparing: {
    icon: Loader2,
    label: 'Preparing Transaction',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    spinning: true
  },
  building: {
    icon: Loader2,
    label: 'Building UserOp',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    spinning: true
  },
  approving: {
    icon: FileSignature,
    label: 'Approving Token',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    spinning: true
  },
  sponsoring: {
    icon: Zap,
    label: 'Getting Sponsorship',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    spinning: false
  },
  signing: {
    icon: FileSignature,
    label: 'Waiting for Signature',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    spinning: false
  },
  submitted: {
    icon: Send,
    label: 'Transaction Submitted',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    spinning: true
  },
  submitting: {
    icon: Send,
    label: 'Submitting to Bundler',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    spinning: true
  },
  pending: {
    icon: Clock,
    label: 'Processing',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    spinning: true
  },
  success: {
    icon: CheckCircle,
    label: 'Transaction Complete',
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    spinning: false
  },
  error: {
    icon: XCircle,
    label: 'Transaction Failed',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    spinning: false
  }
};

export function GaslessSwapStatus({ status, message, txHash, chainId }) {
  if (!status) return null;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.building;
  const Icon = config.icon;

  return (
    <div className={`mt-4 p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center gap-3">
        <Icon 
          className={`w-5 h-5 ${config.color} ${config.spinning ? 'animate-spin' : ''}`}
        />
        <div className="flex-1">
          <p className={`font-semibold ${config.color}`}>
            {config.label}
          </p>
          {message && (
            <p className="text-sm text-gray-600 mt-1">
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Transaction hash link */}
      {txHash && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <a
            href={getExplorerLink(txHash, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
          >
            View on Explorer
            <span className="text-xs">↗</span>
          </a>
        </div>
      )}

      {/* Error details */}
      {status === 'error' && message && (
        <div className="mt-2 pt-2 border-t border-red-200">
          <p className="text-sm text-red-600 font-medium">
            ❌ {message}
          </p>
          <p className="text-xs text-red-500 mt-1">
            Check MetaMask activity for more details
          </p>
        </div>
      )}

      {/* Batch transaction indicator */}
      {status !== 'error' && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-3 h-3" />
            <span>Batch transaction via Smart Account (EIP-7702)</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact status indicator for inline use
 */
export function GaslessSwapStatusInline({ status }) {
  if (!status) return null;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.building;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon 
        className={`w-4 h-4 ${config.color} ${config.spinning ? 'animate-spin' : ''}`}
      />
      <span className={`text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}

/**
 * Progress bar for gasless swap
 */
export function GaslessSwapProgress({ status }) {
  const steps = ['building', 'sponsoring', 'signing', 'submitting', 'pending', 'success'];
  const currentIndex = steps.indexOf(status);
  const progress = status === 'error' ? 0 : Math.max(0, ((currentIndex + 1) / steps.length) * 100);

  return (
    <div className="mt-4">
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Building</span>
        <span>Sponsoring</span>
        <span>Signing</span>
        <span>Submitting</span>
        <span>Complete</span>
      </div>
    </div>
  );
}

// Helper to get explorer link
function getExplorerLink(txHash, chainId) {
  const explorers = {
    80002: `https://amoy.polygonscan.com/tx/${txHash}`,
    11155111: `https://sepolia.etherscan.io/tx/${txHash}`
  };
  return explorers[chainId] || `#${txHash}`;
}

export default GaslessSwapStatus;
