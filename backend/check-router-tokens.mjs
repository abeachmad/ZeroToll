import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';

const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

// Sepolia
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
const SEPOLIA_ROUTER = '0x577560699EF88e99f15d04df57c9552056d2a10D';
const SEPOLIA_TOKENS = {
  zUSDC: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C',
  zETH: '0x8153FA09Be1689D44C343f119C829F6702A8720b',
  zPOL: '0x63c31C4247f6AA40B676478226d6FEB5707649D6',
  zLINK: '0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C'
};

// Amoy
const amoyClient = createPublicClient({ chain: polygonAmoy, transport: http('https://rpc-amoy.polygon.technology') });
const AMOY_ROUTER = '0xc75df1943d6EFE04b422b9bB45509782609Fc67a';
const AMOY_TOKENS = {
  zUSDC: '0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD',
  zETH: '0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9',
  zPOL: '0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d',
  zLINK: '0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1'
};

async function check() {
  console.log('=== SEPOLIA ROUTER TOKEN BALANCES ===');
  console.log('Router:', SEPOLIA_ROUTER);
  for (const [name, addr] of Object.entries(SEPOLIA_TOKENS)) {
    const bal = await sepoliaClient.readContract({ address: addr, abi, functionName: 'balanceOf', args: [SEPOLIA_ROUTER] });
    console.log(`${name}: ${bal.toString()}`);
  }
  
  console.log('\n=== AMOY ROUTER TOKEN BALANCES ===');
  console.log('Router:', AMOY_ROUTER);
  for (const [name, addr] of Object.entries(AMOY_TOKENS)) {
    const bal = await amoyClient.readContract({ address: addr, abi, functionName: 'balanceOf', args: [AMOY_ROUTER] });
    console.log(`${name}: ${bal.toString()}`);
  }
}

check().catch(console.error);
