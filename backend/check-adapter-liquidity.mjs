import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const ADAPTER = '0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa';
const ZTA = '0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf';
const ZTB = '0x8fb844251af76AF090B005643D966FC52852100a';

const client = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });

const abi = parseAbi([
  'function getLiquidity(address) view returns (uint256)',
  'function liquidity(address) view returns (uint256)'
]);

const ztaLiq = await client.readContract({ address: ADAPTER, abi, functionName: 'liquidity', args: [ZTA] });
const ztbLiq = await client.readContract({ address: ADAPTER, abi, functionName: 'liquidity', args: [ZTB] });

console.log('SmartDexAdapter:', ADAPTER);
console.log('ZTA liquidity:', (Number(ztaLiq) / 1e18).toFixed(2));
console.log('ZTB liquidity:', (Number(ztbLiq) / 1e18).toFixed(2));
