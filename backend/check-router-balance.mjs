import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const ROUTER_V2 = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';
const TOKENS = {
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574'
};

const ERC20_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);

const publicClient = createPublicClient({ 
  chain: sepolia, 
  transport: http('https://ethereum-sepolia-rpc.publicnode.com') 
});

console.log('Router V2:', ROUTER_V2);
console.log('\\nToken balances:');

for (const [name, address] of Object.entries(TOKENS)) {
  const balance = await publicClient.readContract({ 
    address, 
    abi: ERC20_ABI, 
    functionName: 'balanceOf', 
    args: [ROUTER_V2] 
  });
  console.log(`${name}: ${balance.toString()}`);
}
