/**
 * Pyth Batch Optimizer
 * 
 * Batches multiple price update requests within a time window
 * to reduce gas costs and Pyth network fees
 * 
 * Features:
 * - 15-second batching window (configurable)
 * - Content-based caching (same price IDs → single fetch)
 * - Automatic deduplication
 * - Fee optimization
 */

import { EvmPriceServiceConnection, PriceFeed } from '@pythnetwork/pyth-evm-js';
import { ethers } from 'ethers';

const PYTH_ENDPOINTS = {
  mainnet: 'https://hermes.pyth.network',
  testnet: 'https://hermes.pyth.network', // Same endpoint for testnet
};

const BATCH_WINDOW_MS = parseInt(process.env.PYTH_BATCH_WINDOW_MS || '15000'); // 15 seconds

interface PriceUpdateRequest {
  priceIds: string[];
  timestamp: number;
  resolve: (value: string[]) => void;
  reject: (error: Error) => void;
}

/**
 * Pyth Batch Optimizer
 */
export class PythBatchOptimizer {
  private priceService: EvmPriceServiceConnection;
  private pendingRequests: PriceUpdateRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private cache: Map<string, { data: string; timestamp: number }> = new Map();
  private cacheValidityMs: number = 60000; // 1 minute cache

  constructor(endpoint: string = PYTH_ENDPOINTS.testnet) {
    this.priceService = new EvmPriceServiceConnection(endpoint, {
      priceFeedRequestConfig: {
        binary: true,
      },
    });
  }

  /**
   * Request price update data (batched)
   * @param priceIds Array of Pyth price feed IDs
   * @returns Promise resolving to price update data
   */
  async getPriceUpdateData(priceIds: string[]): Promise<string[]> {
    // Check cache first
    const cachedData = this.getCachedData(priceIds);
    if (cachedData) {
      console.log(`[Pyth Batch] Cache hit for ${priceIds.length} price IDs`);
      return cachedData;
    }

    // Add to pending queue
    return new Promise<string[]>((resolve, reject) => {
      this.pendingRequests.push({
        priceIds,
        timestamp: Date.now(),
        resolve,
        reject,
      });

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), BATCH_WINDOW_MS);
      }
    });
  }

  /**
   * Process batched requests
   */
  private async processBatch() {
    if (this.pendingRequests.length === 0) {
      this.batchTimer = null;
      return;
    }

    console.log(`[Pyth Batch] Processing batch of ${this.pendingRequests.length} requests`);

    // Collect all unique price IDs
    const allPriceIds = new Set<string>();
    this.pendingRequests.forEach((req) => {
      req.priceIds.forEach((id) => allPriceIds.add(id));
    });

    const uniquePriceIds = Array.from(allPriceIds);
    console.log(`[Pyth Batch] Fetching ${uniquePriceIds.length} unique price feeds`);

    try {
      // Fetch price update data for all unique IDs
      const priceUpdateData = await this.priceService.getPriceFeedsUpdateData(uniquePriceIds);

      // Cache the results
      uniquePriceIds.forEach((priceId, index) => {
        this.cache.set(priceId, {
          data: priceUpdateData[index],
          timestamp: Date.now(),
        });
      });

      // Resolve all pending requests
      this.pendingRequests.forEach((req) => {
        const requestData = req.priceIds.map((id) => {
          const cached = this.cache.get(id);
          return cached ? cached.data : '';
        });
        req.resolve(requestData);
      });

      console.log(`[Pyth Batch] Successfully resolved ${this.pendingRequests.length} requests`);
    } catch (error) {
      console.error('[Pyth Batch] Error fetching price data:', error);
      this.pendingRequests.forEach((req) => {
        req.reject(error as Error);
      });
    } finally {
      // Clear pending requests and timer
      this.pendingRequests = [];
      this.batchTimer = null;
    }
  }

  /**
   * Check cache for price data
   */
  private getCachedData(priceIds: string[]): string[] | null {
    const now = Date.now();
    const cachedData: string[] = [];

    for (const priceId of priceIds) {
      const cached = this.cache.get(priceId);
      if (!cached || now - cached.timestamp > this.cacheValidityMs) {
        return null; // Cache miss or expired
      }
      cachedData.push(cached.data);
    }

    return cachedData;
  }

  /**
   * Get latest price (no batching, for immediate needs)
   */
  async getLatestPrice(priceId: string): Promise<PriceFeed> {
    const priceFeeds = await this.priceService.getLatestPriceFeeds([priceId]);
    if (!priceFeeds || priceFeeds.length === 0) {
      throw new Error(`No price feed found for ${priceId}`);
    }
    return priceFeeds[0];
  }

  /**
   * Estimate Pyth update fee
   */
  async estimateUpdateFee(chainId: number, numPriceIds: number): Promise<bigint> {
    // Pyth charges per price update
    // Testnet fee is typically 0.001 ETH per update
    const feePerUpdate = ethers.parseUnits('0.001', 'ether');
    return feePerUpdate * BigInt(numPriceIds);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [priceId, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheValidityMs) {
        this.cache.delete(priceId);
      }
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
let batchOptimizer: PythBatchOptimizer | null = null;

/**
 * Get or create batch optimizer instance
 */
export function getPythBatchOptimizer(): PythBatchOptimizer {
  if (!batchOptimizer) {
    const endpoint = process.env.PYTH_ENDPOINT || PYTH_ENDPOINTS.testnet;
    batchOptimizer = new PythBatchOptimizer(endpoint);

    // Set up periodic cache cleanup
    setInterval(() => {
      batchOptimizer?.clearExpiredCache();
    }, 60000); // Every minute
  }
  return batchOptimizer;
}

/**
 * Common Pyth price feed IDs (testnet)
 */
export const PRICE_FEED_IDS = {
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  POL_USD: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  LINK_USD: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
};

/**
 * Example usage:
 * 
 * const optimizer = getPythBatchOptimizer();
 * 
 * // Multiple requests within 15s window will be batched
 * const updateData1 = await optimizer.getPriceUpdateData([PRICE_FEED_IDS.ETH_USD]);
 * const updateData2 = await optimizer.getPriceUpdateData([PRICE_FEED_IDS.USDC_USD]);
 * 
 * // All requests batched into single Pyth API call
 */
