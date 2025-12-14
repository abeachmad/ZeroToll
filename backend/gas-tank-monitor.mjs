/**
 * ZeroToll Gas Tank Monitor - Phase 2
 * 
 * Monitors paymaster balances and auto-refills when low.
 * Run as: node backend/gas-tank-monitor.mjs
 * Or with PM2: pm2 start backend/gas-tank-monitor.mjs --name gas-tank
 */

import { config } from 'dotenv';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';

config();

// Configuration
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Thresholds per network
const THRESHOLDS = {
  11155111: {
    name: 'sepolia',
    chain: sepolia,
    symbol: 'ETH',
    minBalance: parseEther('0.05'),    // Alert when below 0.05 ETH
    refillAmount: parseEther('0.2'),   // Refill 0.2 ETH
    criticalBalance: parseEther('0.01') // Critical alert
  },
  80002: {
    name: 'polygon-amoy',
    chain: polygonAmoy,
    symbol: 'POL',
    minBalance: parseEther('2'),       // Alert when below 2 POL
    refillAmount: parseEther('5'),     // Refill 5 POL
    criticalBalance: parseEther('0.5') // Critical alert
  }
};

// Get paymaster addresses from env
const PAYMASTERS = {
  11155111: process.env.SEPOLIA_VERIFYING_PAYMASTER,
  80002: process.env.AMOY_VERIFYING_PAYMASTER
};

// Gas tank wallet (funds paymasters)
const GAS_TANK_KEY = process.env.GAS_TANK_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
if (!GAS_TANK_KEY) {
  console.error('Missing GAS_TANK_PRIVATE_KEY or RELAYER_PRIVATE_KEY');
  process.exit(1);
}

const gasTankAccount = privateKeyToAccount(`0x${GAS_TANK_KEY.replace('0x', '')}`);
console.log('Gas Tank Wallet:', gasTankAccount.address);

// Alert webhook (Discord/Telegram)
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL;

// Paymaster ABI
const PAYMASTER_ABI = parseAbi([
  'function deposit() external payable',
  'function getDeposit() view returns (uint256)'
]);

// Create clients for each chain
function getClients(chainId) {
  const config = THRESHOLDS[chainId];
  const rpc = chainId === 11155111 
    ? (process.env.RPC_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com')
    : (process.env.RPC_AMOY || 'https://rpc-amoy.polygon.technology');

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(rpc)
  });

  const walletClient = createWalletClient({
    account: gasTankAccount,
    chain: config.chain,
    transport: http(rpc)
  });

  return { publicClient, walletClient };
}

// Send alert
async function sendAlert(message, level = 'info') {
  const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
  const fullMessage = `${emoji} [ZeroToll Gas Tank] ${message}`;
  
  console.log(fullMessage);

  if (ALERT_WEBHOOK) {
    try {
      await fetch(ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullMessage })
      });
    } catch (e) {
      console.error('Failed to send alert:', e.message);
    }
  }
}

// Check and refill paymaster
async function checkAndRefill(chainId) {
  const config = THRESHOLDS[chainId];
  const paymaster = PAYMASTERS[chainId];

  if (!paymaster) {
    console.log(`[${config.name}] Paymaster not configured, skipping`);
    return;
  }

  const { publicClient, walletClient } = getClients(chainId);

  try {
    // Get paymaster deposit from EntryPoint
    const deposit = await publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [paymaster]
    });

    const depositFormatted = formatEther(deposit);
    console.log(`[${config.name}] Paymaster deposit: ${depositFormatted} ${config.symbol}`);

    // Check if critical
    if (deposit < config.criticalBalance) {
      await sendAlert(
        `CRITICAL: ${config.name} paymaster deposit is ${depositFormatted} ${config.symbol}! Immediate refill needed.`,
        'critical'
      );
    }

    // Check if below threshold
    if (deposit < config.minBalance) {
      console.log(`[${config.name}] Below threshold, attempting refill...`);

      // Check gas tank balance
      const tankBalance = await publicClient.getBalance({ address: gasTankAccount.address });
      const tankFormatted = formatEther(tankBalance);
      console.log(`[${config.name}] Gas tank balance: ${tankFormatted} ${config.symbol}`);

      if (tankBalance < config.refillAmount) {
        await sendAlert(
          `WARNING: ${config.name} gas tank low (${tankFormatted} ${config.symbol}). Cannot refill paymaster.`,
          'warning'
        );
        return;
      }

      // Refill paymaster
      console.log(`[${config.name}] Refilling ${formatEther(config.refillAmount)} ${config.symbol}...`);
      
      const tx = await walletClient.writeContract({
        address: paymaster,
        abi: PAYMASTER_ABI,
        functionName: 'deposit',
        value: config.refillAmount
      });

      console.log(`[${config.name}] Refill tx: ${tx}`);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      if (receipt.status === 'success') {
        const newDeposit = await publicClient.readContract({
          address: ENTRYPOINT_V07,
          abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
          functionName: 'balanceOf',
          args: [paymaster]
        });

        await sendAlert(
          `Refilled ${config.name} paymaster: ${formatEther(config.refillAmount)} ${config.symbol}. New balance: ${formatEther(newDeposit)} ${config.symbol}`,
          'info'
        );
      } else {
        await sendAlert(
          `FAILED to refill ${config.name} paymaster. Tx: ${tx}`,
          'critical'
        );
      }
    }
  } catch (error) {
    console.error(`[${config.name}] Error:`, error.message);
    await sendAlert(`Error checking ${config.name}: ${error.message}`, 'warning');
  }
}

// Check all chains
async function checkAllChains() {
  console.log('\n' + '='.repeat(50));
  console.log(`Gas Tank Check - ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  for (const chainId of Object.keys(THRESHOLDS)) {
    await checkAndRefill(parseInt(chainId));
  }
}

// Status endpoint (optional HTTP server)
async function getStatus() {
  const status = {};

  for (const chainId of Object.keys(THRESHOLDS)) {
    const config = THRESHOLDS[chainId];
    const paymaster = PAYMASTERS[chainId];

    if (!paymaster) {
      status[config.name] = { configured: false };
      continue;
    }

    const { publicClient } = getClients(parseInt(chainId));

    try {
      const deposit = await publicClient.readContract({
        address: ENTRYPOINT_V07,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [paymaster]
      });

      const tankBalance = await publicClient.getBalance({ address: gasTankAccount.address });

      status[config.name] = {
        configured: true,
        paymaster,
        deposit: formatEther(deposit),
        minThreshold: formatEther(config.minBalance),
        gasTankBalance: formatEther(tankBalance),
        symbol: config.symbol,
        healthy: deposit >= config.minBalance
      };
    } catch (e) {
      status[config.name] = { configured: true, error: e.message };
    }
  }

  return status;
}

// Main loop
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  ZEROTOLL GAS TANK MONITOR');
  console.log('='.repeat(60));
  console.log(`Gas Tank Wallet: ${gasTankAccount.address}`);
  console.log(`Check Interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`Alert Webhook: ${ALERT_WEBHOOK ? 'Configured' : 'Not configured'}`);
  console.log('');
  console.log('Paymasters:');
  for (const [chainId, address] of Object.entries(PAYMASTERS)) {
    const config = THRESHOLDS[chainId];
    console.log(`  ${config.name}: ${address || 'NOT SET'}`);
  }
  console.log('='.repeat(60) + '\n');

  // Initial check
  await checkAllChains();

  // Schedule periodic checks
  setInterval(checkAllChains, CHECK_INTERVAL_MS);

  // Optional: Start HTTP server for status endpoint
  if (process.env.GAS_TANK_HTTP_PORT) {
    const express = (await import('express')).default;
    const app = express();
    
    app.get('/status', async (req, res) => {
      const status = await getStatus();
      res.json(status);
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', gasTank: gasTankAccount.address });
    });

    const port = parseInt(process.env.GAS_TANK_HTTP_PORT);
    app.listen(port, () => {
      console.log(`Gas Tank status server on port ${port}`);
    });
  }
}

main().catch(console.error);
