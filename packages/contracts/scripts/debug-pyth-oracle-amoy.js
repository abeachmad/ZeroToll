const hre = require('hardhat');

/**
 * Debug Pyth oracle - check why prices failing
 */

async function main() {
  console.log('🔍 Debugging Pyth Oracle on Amoy...\n');
  
  const PYTH_AMOY = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729';
  const ORACLE = '0x88eb5eEACEF27C3B824fC891b4C37C819332d0b1';
  const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
  const USDC = '0x642Ec30B4a41169770246d594621332eE60a28f0';
  
  const PRICE_IDS = {
    POL_USD: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  };
  
  // Check oracle config
  console.log('1️⃣  Checking oracle configuration...');
  const oracle = await hre.ethers.getContractAt('MultiTokenPythOracle', ORACLE);
  
  const wpolPriceId = await oracle.tokenToPriceId(WPOL);
  const usdcPriceId = await oracle.tokenToPriceId(USDC);
  
  console.log(`  WPOL price ID: ${wpolPriceId}`);
  console.log(`  USDC price ID: ${usdcPriceId}`);
  console.log(`  Expected POL: ${PRICE_IDS.POL_USD}`);
  console.log(`  Expected USDC: ${PRICE_IDS.USDC_USD}`);
  console.log('');
  
  // Check Pyth contract directly
  console.log('2️⃣  Querying Pyth contract directly...');
  const pythABI = [
    {
      "inputs": [{"internalType": "bytes32", "name": "id", "type": "bytes32"}],
      "name": "getPriceUnsafe",
      "outputs": [{
        "components": [
          {"internalType": "int64", "name": "price", "type": "int64"},
          {"internalType": "uint64", "name": "conf", "type": "uint64"},
          {"internalType": "int32", "name": "expo", "type": "int32"},
          {"internalType": "uint256", "name": "publishTime", "type": "uint256"}
        ],
        "internalType": "struct PythStructs.Price",
        "name": "price",
        "type": "tuple"
      }],
      "stateMutability": "view",
      "type": "function"
    }
  ];
  
  const pyth = await hre.ethers.getContractAt(pythABI, PYTH_AMOY);
  
  try {
    console.log('  Querying POL/USD price feed...');
    const polPrice = await pyth.getPriceUnsafe(PRICE_IDS.POL_USD);
    console.log(`  ✅ POL Price: ${polPrice.price} (expo: ${polPrice.expo})`);
    console.log(`     Published: ${new Date(Number(polPrice.publishTime) * 1000).toISOString()}`);
    
    const priceUSD = Number(polPrice.price) / (10 ** Math.abs(Number(polPrice.expo)));
    console.log(`     USD Value: $${priceUSD.toFixed(4)}`);
  } catch (error) {
    console.log(`  ❌ POL Price failed: ${error.message}`);
    console.log(`     Error data: ${error.data}`);
  }
  console.log('');
  
  try {
    console.log('  Querying USDC/USD price feed...');
    const usdcPrice = await pyth.getPriceUnsafe(PRICE_IDS.USDC_USD);
    console.log(`  ✅ USDC Price: ${usdcPrice.price} (expo: ${usdcPrice.expo})`);
    console.log(`     Published: ${new Date(Number(usdcPrice.publishTime) * 1000).toISOString()}`);
    
    const priceUSD = Number(usdcPrice.price) / (10 ** Math.abs(Number(usdcPrice.expo)));
    console.log(`     USD Value: $${priceUSD.toFixed(4)}`);
  } catch (error) {
    console.log(`  ❌ USDC Price failed: ${error.message}`);
    console.log(`     Error data: ${error.data}`);
  }
  console.log('');
  
  // Try oracle getPrice
  console.log('3️⃣  Testing oracle.getPrice()...');
  try {
    const wpolPrice = await oracle.getPrice(WPOL);
    console.log(`  ✅ WPOL: $${(Number(wpolPrice) / 1e8).toFixed(4)}`);
  } catch (error) {
    console.log(`  ❌ WPOL failed: ${error.message}`);
    if (error.data) {
      console.log(`     Error data: ${error.data}`);
    }
  }
  
  try {
    const usdcPrice = await oracle.getPrice(USDC);
    console.log(`  ✅ USDC: $${(Number(usdcPrice) / 1e8).toFixed(4)}`);
  } catch (error) {
    console.log(`  ❌ USDC failed: ${error.message}`);
    if (error.data) {
      console.log(`     Error data: ${error.data}`);
    }
  }
  
  console.log('');
  console.log('📋 Diagnosis:');
  console.log('  If Pyth queries fail: Price feeds may not be available on Amoy testnet');
  console.log('  If oracle queries fail: Check price ID configuration');
  console.log('  Solution: Pyth testnets may have stale/missing data - this is NORMAL');
  console.log('');
  console.log('💡 For production: Use mainnet where Pyth has live price updates');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
