/**
 * Compare backend Pyth prices vs on-chain oracle prices
 */

const { ethers } = require('ethers');

const AMOY_RPC = 'https://rpc-amoy.polygon.technology';
const PRICE_ORACLE = '0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e';

const ORACLE_ABI = [
  'function getPrice(address token) view returns (uint256)'
];

const TOKENS = {
  WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
  USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
};

// Pyth Hermes API
const PYTH_API = 'https://hermes.pyth.network/v2/updates/price/latest';
const PYTH_FEEDS = {
  WMATIC: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
  USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

async function fetchPythPrice(feedId) {
  const url = `${PYTH_API}?ids[]=${feedId}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.parsed && data.parsed.length > 0) {
    const priceData = data.parsed[0].price;
    const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
    return price;
  }
  return null;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const oracle = new ethers.Contract(PRICE_ORACLE, ORACLE_ABI, provider);
  
  console.log('Price Comparison: Backend (Pyth) vs On-Chain Oracle');
  console.log('====================================================\n');
  
  for (const [symbol, address] of Object.entries(TOKENS)) {
    console.log(`${symbol}:`);
    
    // On-chain price
    try {
      const onChainPrice = await oracle.getPrice(address);
      const onChainUSD = parseFloat(ethers.formatUnits(onChainPrice, 8));
      console.log(`  On-Chain Oracle: $${onChainUSD.toFixed(6)}`);
    } catch (err) {
      console.log(`  On-Chain Oracle: Error - ${err.message}`);
    }
    
    // Pyth price
    try {
      const pythPrice = await fetchPythPrice(PYTH_FEEDS[symbol]);
      console.log(`  Pyth (Backend):  $${pythPrice?.toFixed(6) || 'N/A'}`);
    } catch (err) {
      console.log(`  Pyth (Backend):  Error - ${err.message}`);
    }
    
    console.log('');
  }
  
  // Calculate expected swap output
  console.log('====================================================');
  console.log('Swap Calculation: 0.1 USDC -> WMATIC\n');
  
  const usdcOnChain = parseFloat(ethers.formatUnits(await oracle.getPrice(TOKENS.USDC), 8));
  const wmaticOnChain = parseFloat(ethers.formatUnits(await oracle.getPrice(TOKENS.WMATIC), 8));
  
  const usdcPyth = await fetchPythPrice(PYTH_FEEDS.USDC);
  const wmaticPyth = await fetchPythPrice(PYTH_FEEDS.WMATIC);
  
  const amountIn = 0.1; // USDC
  
  // On-chain calculation (what MockDEXAdapter will output)
  const onChainOutput = (amountIn * usdcOnChain / wmaticOnChain) * 0.997; // 0.3% slippage
  console.log(`On-Chain Expected Output: ${onChainOutput.toFixed(6)} WMATIC`);
  
  // Backend calculation (what quote returns)
  const backendOutput = (amountIn * usdcPyth / wmaticPyth) * 0.95; // 5% slippage
  console.log(`Backend Quote (netOut):   ${backendOutput.toFixed(6)} WMATIC`);
  
  // Frontend minOut (95% of backend)
  const frontendMinOut = backendOutput * 0.95;
  console.log(`Frontend minOut (95%):    ${frontendMinOut.toFixed(6)} WMATIC`);
  
  console.log('\n====================================================');
  if (frontendMinOut > onChainOutput) {
    console.log('❌ PROBLEM: minOut > expected output!');
    console.log('   The swap will fail with "Slippage exceeded"');
  } else {
    console.log('✅ OK: minOut < expected output');
    console.log('   The swap should succeed');
  }
}

main().catch(console.error);
