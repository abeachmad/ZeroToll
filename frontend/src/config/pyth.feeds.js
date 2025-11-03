export const PYTH_FEEDS = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    priceId: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    logo: '💵'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    priceId: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    logo: '💵'
  },
  POL: {
    symbol: 'POL',
    name: 'Polygon',
    priceId: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    logo: '🔷'
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    priceId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    logo: '⭐'
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    priceId: '0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33',
    logo: '₿'
  },
  WAVAX: {
    symbol: 'WAVAX',
    name: 'Wrapped AVAX',
    priceId: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    logo: '🔺'
  },
  DOGE: {
    symbol: 'wDOGE',
    name: 'Wrapped DOGE',
    priceId: '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
    logo: '🐕'
  },
  ATOM: {
    symbol: 'WATOM',
    name: 'Wrapped ATOM',
    priceId: '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
    logo: '⚛️'
  },
  PEPE: {
    symbol: 'WPEPE',
    name: 'Wrapped PEPE',
    priceId: '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
    logo: '🐸'
  },
  TON: {
    symbol: 'WTON',
    name: 'Wrapped TON',
    priceId: '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
    logo: '💎'
  },
  BNB: {
    symbol: 'WBNB',
    name: 'Wrapped BNB',
    priceId: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
    logo: '🟡'
  }
};

export const PYTH_HERMES_URL = process.env.REACT_APP_PYTH_HERMES_URL || 'https://hermes.pyth.network';
