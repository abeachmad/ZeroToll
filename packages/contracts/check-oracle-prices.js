/**
 * Check Price Oracle prices on Amoy
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
  LINK: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904'
};

async function main() {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  
  console.log('Price Oracle Check (Amoy)');
  console.log('=========================\n');
  console.log('Oracle:', PRICE_ORACLE);
  
  const oracle = new ethers.Contract(PRICE_ORACLE, ORACLE_ABI, provider);
  
  console.log('\nToken Prices (USD, 8 decimals):');
  for (const [symbol, address] of Object.entries(TOKENS)) {
    try {
      const price = await oracle.getPrice(address);
      const priceUSD = parseFloat(ethers.formatUnits(price, 8));
      console.log(`  ${symbol}: $${priceUSD.toFixed(4)} (raw: ${price.toString()})`);
    } catch (err) {
      console.log(`  ${symbol}: ❌ Error - ${err.message}`);
    }
  }
  
  // Test a swap calculation
  console.log('\n=========================');
  console.log('Test Swap Calculation:');
  console.log('0.1 USDC -> WMATIC');
  
  try {
    const usdcPrice = await oracle.getPrice(TOKENS.USDC);
    const wmaticPrice = await oracle.getPrice(TOKENS.WMATIC);
    
    const amountIn = 100000n; // 0.1 USDC (6 decimals)
    const decimalsIn = 6;
    const decimalsOut = 18;
    
    // Calculate: amountOut = (amountIn * priceIn * 10^decimalsOut) / (priceOut * 10^decimalsIn)
    const amountOut = (amountIn * usdcPrice * (10n ** BigInt(decimalsOut - decimalsIn))) / wmaticPrice;
    
    console.log(`  USDC Price: $${ethers.formatUnits(usdcPrice, 8)}`);
    console.log(`  WMATIC Price: $${ethers.formatUnits(wmaticPrice, 8)}`);
    console.log(`  Expected Output: ${ethers.formatUnits(amountOut, 18)} WMATIC`);
    
    // Apply 0.3% slippage
    const withSlippage = amountOut * 9970n / 10000n;
    console.log(`  With 0.3% slippage: ${ethers.formatUnits(withSlippage, 18)} WMATIC`);
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }
}

main().catch(console.error);
