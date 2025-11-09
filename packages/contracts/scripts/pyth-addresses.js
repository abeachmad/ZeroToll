// Pyth Network Contract Addresses (Official)
// Source: https://docs.pyth.network/price-feeds/contract-addresses/evm

module.exports = {
  // Mainnets
  ethereum: '0x4305FB66699C3B2702D4d05CF36551390A4c69C6',
  polygon: '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C',
  arbitrum: '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C',
  optimism: '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C',
  
  // Testnets
  sepolia: '0xDd24F84d36BF92C65F92307595335bdFab5Bbd21',  // Ethereum Sepolia
  amoy: '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729',     // Polygon Amoy
  arbitrumSepolia: '0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF',
  optimismSepolia: '0x0708325268dF9F66270F1401206434524814508b',
  
  // Price Feed IDs (same across all chains)
  priceIds: {
    // Crypto pairs
    'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'POL/USD': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472', // MATIC/POL
    'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
    'OP/USD': '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
    
    // Additional tokens
    'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    'DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
    'ATOM/USD': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
    'PEPE/USD': '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
    'TON/USD': '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
    'BNB/USD': '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
  }
};
