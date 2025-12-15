import { readFileSync, writeFileSync } from 'fs';

const file = 'backend/phase2-relayer.mjs';
let content = readFileSync(file, 'utf8');

// Fix the Pyth API URL - use the simpler endpoint
const oldUrl = 'https://hermes.pyth.network/v2/updates/price/latest?ids[]=${priceId}';
const newUrl = 'https://hermes.pyth.network/api/latest_price_feeds?ids[]=${priceId}';

content = content.replace(oldUrl, newUrl);

writeFileSync(file, content);
console.log('Fixed Pyth API URL');
