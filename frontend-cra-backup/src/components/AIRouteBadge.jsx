import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

/**
 * AIRouteBadge displays AI route optimization results with an explanation popover
 * 
 * @param {Object} route - Route object with { savings, explain, riskScore, adaptations }
 * @param {string} size - Badge size: 'sm', 'md', 'lg'
 */
export default function AIRouteBadge({ route, size = 'md' }) {
  const [open, setOpen] = useState(false);

  if (!route || !route.savings) {
    return null;
  }

  const savingsBps = parseFloat(route.savings) || 0;
  const riskScore = route.riskScore || 0;
  const adaptations = route.adaptations || [];

  // Badge styling based on savings
  const getBadgeColor = (bps) => {
    if (bps >= 50) return 'bg-gradient-to-r from-purple-500 to-pink-500';
    if (bps >= 20) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    if (bps >= 10) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    return 'bg-gradient-to-r from-gray-500 to-slate-500';
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const badgeClass = `${getBadgeColor(savingsBps)} text-white font-semibold rounded-full shadow-lg cursor-pointer hover:shadow-xl transition-all ${sizeClasses[size]}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={badgeClass}>
          <span className="flex items-center gap-1.5">
            <span className="animate-pulse">✨</span>
            <span>AI Saved {savingsBps.toFixed(0)} bps</span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-bold text-lg">Smart Route</h3>
              <p className="text-xs text-gray-500">AI-optimized execution</p>
            </div>
          </div>

          {/* Savings Breakdown */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Cost Savings</span>
              <span className="text-2xl font-bold text-purple-600">
                {savingsBps.toFixed(1)} bps
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {(savingsBps / 100).toFixed(3)}% better than default route
            </p>
          </div>

          {/* Risk Score */}
          {riskScore > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Risk Score</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      riskScore <= 30
                        ? 'bg-green-500'
                        : riskScore <= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(riskScore, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{riskScore.toFixed(0)}</span>
              </div>
            </div>
          )}

          {/* Explanation */}
          {route.explain && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <p className="text-xs text-gray-700 leading-relaxed">{route.explain}</p>
            </div>
          )}

          {/* Adaptations */}
          {adaptations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                AI Optimizations Applied:
              </h4>
              <ul className="space-y-1.5">
                {adaptations.map((adaptation, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{adaptation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Details */}
          {route.dexes && route.dexes.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Route Details:</h4>
              <div className="flex flex-wrap gap-1.5">
                {route.dexes.map((dex, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                  >
                    {dex}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            Powered by ZeroToll AI Engine
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Compact version for inline display
 */
export function AIRouteBadgeCompact({ route }) {
  if (!route || !route.savings) {
    return null;
  }

  const savingsBps = parseFloat(route.savings) || 0;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
      <span>✨</span>
      <span>AI: {savingsBps.toFixed(0)}bps</span>
    </span>
  );
}
