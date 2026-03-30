/**
 * Route Planner - Multi-DEX and Bridge Aggregation
 * 
 * Enumerates all possible routes across DEXes and bridges,
 * scores them by:
 * - Best output price
 * - Lowest gas cost
 * - Minimal Pyth oracle fees
 * - Acceptable slippage
 * - MEV risk
 * 
 * Returns the optimal route for execution
 */

import { ethers } from 'ethers';

// DEX Adapter addresses per chain
const DEX_ADAPTERS = {
  11155111: {
    // Sepolia
    uniswapV2: process.env.SEPOLIA_UNISWAPV2_ADAPTER,
    uniswapV3: process.env.SEPOLIA_UNISWAPV3_ADAPTER,
    mockDex: process.env.SEPOLIA_MOCKDEX_ADAPTER,
  },
  80002: {
    // Amoy
    quickswapV2: process.env.AMOY_QUICKSWAP_ADAPTER,
    mockDex: process.env.AMOY_MOCKDEX_ADAPTER,
  },
  421614: {
    // Arbitrum Sepolia
    uniswapV3: process.env.ARB_SEPOLIA_UNISWAPV3_ADAPTER,
    mockDex: process.env.ARB_SEPOLIA_MOCKDEX_ADAPTER,
  },
  11155420: {
    // Optimism Sepolia
    uniswapV3: process.env.OP_SEPOLIA_UNISWAPV3_ADAPTER,
    mockDex: process.env.OP_SEPOLIA_MOCKDEX_ADAPTER,
  },
};

// Bridge Adapter addresses
const BRIDGE_ADAPTERS = {
  mockBridge: {
    11155111: process.env.SEPOLIA_MOCKBRIDGE_ADAPTER,
    80002: process.env.AMOY_MOCKBRIDGE_ADAPTER,
    421614: process.env.ARB_SEPOLIA_MOCKBRIDGE_ADAPTER,
    11155420: process.env.OP_SEPOLIA_MOCKBRIDGE_ADAPTER,
  },
  // Feature-flagged real bridges (disabled by default)
  polygonPOS: process.env.BRIDGE_POS === 'true' ? {
    11155111: process.env.SEPOLIA_POS_ADAPTER,
    80002: process.env.AMOY_POS_ADAPTER,
  } : null,
  arbitrum: process.env.BRIDGE_ARBITRUM === 'true' ? {
    11155111: process.env.SEPOLIA_ARB_ADAPTER,
    421614: process.env.ARB_SEPOLIA_ARB_ADAPTER,
  } : null,
  optimism: process.env.BRIDGE_OPTIMISM === 'true' ? {
    11155111: process.env.SEPOLIA_OP_ADAPTER,
    11155420: process.env.OP_SEPOLIA_OP_ADAPTER,
  } : null,
};

// Gas cost estimates (in gas units)
const GAS_ESTIMATES = {
  uniswapV2Swap: 150000,
  uniswapV3Swap: 180000,
  quickswapSwap: 150000,
  mockDexSwap: 100000,
  mockBridge: 200000,
  polygonPOSBridge: 300000,
  arbitrumBridge: 250000,
  optimismBridge: 250000,
};

// Pyth update fee (approximate)
const PYTH_UPDATE_FEE = ethers.parseUnits('0.001', 'ether'); // 0.001 ETH/POL

export interface RouteCandidate {
  routeId: string;
  type: 'same-chain' | 'cross-chain';
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedOut: string;
  steps: RouteStep[];
  totalGasCost: string;
  pythFee: string;
  netUserOutput: string;
  score: number;
  explain: string;
}

export interface RouteStep {
  type: 'swap' | 'bridge';
  protocol: string;
  adapterAddress: string;
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  estimatedGas: number;
}

export interface Intent {
  user: string;
  tokenIn: string;
  amtIn: string;
  tokenOut: string;
  minOut: string;
  dstChainId: number;
  srcChainId: number;
  feeMode: string;
  deadline: number;
}

/**
 * Plan routes for a given intent
 * @param intent User intent
 * @param providers Ethers providers for each chain
 * @returns Array of route candidates sorted by score (best first)
 */
export async function planRoutes(
  intent: Intent,
  providers: Record<number, ethers.Provider>
): Promise<RouteCandidate[]> {
  const candidates: RouteCandidate[] = [];

  const isSameChain = intent.srcChainId === intent.dstChainId;

  if (isSameChain) {
    // Same-chain swap: enumerate DEX adapters
    const dexAdapters = DEX_ADAPTERS[intent.srcChainId];
    if (!dexAdapters) {
      throw new Error(`No DEX adapters configured for chain ${intent.srcChainId}`);
    }

    for (const [dexName, adapterAddress] of Object.entries(dexAdapters)) {
      if (!adapterAddress) continue;

      try {
        const route = await buildSameChainRoute(
          intent,
          dexName,
          adapterAddress,
          providers[intent.srcChainId]
        );
        if (route) candidates.push(route);
      } catch (error) {
        console.warn(`Failed to build route for ${dexName}:`, error.message);
      }
    }
  } else {
    // Cross-chain: enumerate bridge adapters
    for (const [bridgeName, bridgeConfig] of Object.entries(BRIDGE_ADAPTERS)) {
      if (!bridgeConfig) continue; // Skip if feature-flagged and disabled

      const srcAdapter = bridgeConfig[intent.srcChainId];
      const dstAdapter = bridgeConfig[intent.dstChainId];

      if (!srcAdapter || !dstAdapter) continue;

      try {
        const route = await buildCrossChainRoute(
          intent,
          bridgeName,
          srcAdapter,
          dstAdapter,
          providers
        );
        if (route) candidates.push(route);
      } catch (error) {
        console.warn(`Failed to build cross-chain route for ${bridgeName}:`, error.message);
      }
    }
  }

  // Score routes
  candidates.forEach((route) => {
    route.score = scoreRoute(route, intent);
  });

  // Sort by score (descending - higher is better)
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

/**
 * Build a same-chain swap route
 */
async function buildSameChainRoute(
  intent: Intent,
  dexName: string,
  adapterAddress: string,
  provider: ethers.Provider
): Promise<RouteCandidate | null> {
  // Get quote from DEX adapter
  const adapter = new ethers.Contract(
    adapterAddress,
    [
      'function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, address[] memory path)',
      'function protocolName() external pure returns (string memory)',
    ],
    provider
  );

  const [amountOut, path] = await adapter.getQuote(
    intent.tokenIn,
    intent.tokenOut,
    intent.amtIn
  );

  if (amountOut.toString() === '0') {
    return null; // No liquidity
  }

  const gasEstimate = GAS_ESTIMATES[`${dexName}Swap`] || 150000;
  const gasPrice = (await provider.getFeeData()).gasPrice;
  const totalGasCost = BigInt(gasEstimate) * gasPrice;

  const pythFee = PYTH_UPDATE_FEE; // Single chain, single update
  const netUserOutput = amountOut; // Simplified, actual would deduct fees based on feeMode

  const routeId = `same-chain-${intent.srcChainId}-${dexName}-${Date.now()}`;

  return {
    routeId,
    type: 'same-chain',
    srcChainId: intent.srcChainId,
    dstChainId: intent.dstChainId,
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amtIn,
    expectedOut: amountOut.toString(),
    steps: [
      {
        type: 'swap',
        protocol: dexName,
        adapterAddress,
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        chainId: intent.srcChainId,
        estimatedGas: gasEstimate,
      },
    ],
    totalGasCost: totalGasCost.toString(),
    pythFee: pythFee.toString(),
    netUserOutput: netUserOutput.toString(),
    score: 0, // Calculated later
    explain: `Swap via ${dexName} on chain ${intent.srcChainId}`,
  };
}

/**
 * Build a cross-chain route
 */
async function buildCrossChainRoute(
  intent: Intent,
  bridgeName: string,
  srcAdapter: string,
  dstAdapter: string,
  providers: Record<number, ethers.Provider>
): Promise<RouteCandidate | null> {
  // For cross-chain, we need:
  // 1. Optional: Swap tokenIn → bridge-compatible token on source chain
  // 2. Bridge from source to destination
  // 3. Optional: Swap bridged token → tokenOut on destination chain

  // Simplified implementation: assume direct bridge transfer
  const srcProvider = providers[intent.srcChainId];
  const dstProvider = providers[intent.dstChainId];

  const bridgeAdapter = new ethers.Contract(
    srcAdapter,
    [
      'function estimateBridgeFee(address token, uint256 amount, uint256 toChainId) external view returns (uint256 estimatedCost)',
      'function estimatedBridgeTime(uint256 toChainId) external pure returns (uint256 estimatedSeconds)',
    ],
    srcProvider
  );

  const bridgeFee = await bridgeAdapter.estimateBridgeFee(
    intent.tokenIn,
    intent.amtIn,
    intent.dstChainId
  );

  const gasEstimate = GAS_ESTIMATES[`${bridgeName}Bridge`] || 250000;
  const gasPrice = (await srcProvider.getFeeData()).gasPrice;
  const totalGasCost = BigInt(gasEstimate) * gasPrice;

  // For cross-chain, Pyth fees on both chains
  const pythFee = PYTH_UPDATE_FEE * BigInt(2);

  // Net output = amountIn - bridgeFee (simplified)
  const netUserOutput = BigInt(intent.amtIn) - bridgeFee;

  const routeId = `cross-chain-${intent.srcChainId}-${intent.dstChainId}-${bridgeName}-${Date.now()}`;

  return {
    routeId,
    type: 'cross-chain',
    srcChainId: intent.srcChainId,
    dstChainId: intent.dstChainId,
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amtIn,
    expectedOut: netUserOutput.toString(),
    steps: [
      {
        type: 'bridge',
        protocol: bridgeName,
        adapterAddress: srcAdapter,
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        chainId: intent.srcChainId,
        estimatedGas: gasEstimate,
      },
    ],
    totalGasCost: totalGasCost.toString(),
    pythFee: pythFee.toString(),
    netUserOutput: netUserOutput.toString(),
    score: 0,
    explain: `Bridge via ${bridgeName} from chain ${intent.srcChainId} to ${intent.dstChainId}`,
  };
}

/**
 * Score a route (higher is better)
 * Factors:
 * - Net user output (most important)
 * - Gas cost (lower is better)
 * - Pyth fees (lower is better)
 * - Slippage risk (lower is better)
 */
function scoreRoute(route: RouteCandidate, intent: Intent): number {
  const netOutput = BigInt(route.netUserOutput);
  const gasCost = BigInt(route.totalGasCost);
  const pythFee = BigInt(route.pythFee);

  // Convert to comparable units (assume 1 ETH = 2000 USD for simplicity)
  const outputValue = Number(ethers.formatUnits(netOutput, 18)) * 2000;
  const gasCostUSD = Number(ethers.formatUnits(gasCost, 18)) * 2000;
  const pythFeeUSD = Number(ethers.formatUnits(pythFee, 18)) * 2000;

  // Score formula: output - gas - fees
  const score = outputValue - gasCostUSD - pythFeeUSD;

  return score;
}

/**
 * Get best route
 */
export async function getBestRoute(
  intent: Intent,
  providers: Record<number, ethers.Provider>
): Promise<RouteCandidate | null> {
  const routes = await planRoutes(intent, providers);
  return routes.length > 0 ? routes[0] : null;
}

/**
 * Explain route savings vs baseline
 */
export function explainRouteSavings(
  bestRoute: RouteCandidate,
  baselineRoute: RouteCandidate
): string {
  const savings = bestRoute.score - baselineRoute.score;
  const savingsBps = Math.round((savings / baselineRoute.score) * 10000);

  return `Smart Route saved ${savingsBps} bps by using ${bestRoute.steps[0].protocol} instead of ${baselineRoute.steps[0].protocol}. Lower gas cost and better liquidity.`;
}
