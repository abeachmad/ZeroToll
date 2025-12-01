import { createPublicClient, http, formatUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology'),
});

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function check() {
  const USDC = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
  const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
  const ADAPTER = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';
  const SMART_ACCOUNT = '0xEef74EB6f5eA5f869115846E9771A8551f9e4323';

  console.log('=== Amoy Balances ===');
  
  // Adapter balances
  const adapterUsdc = await client.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [ADAPTER],
  });
  console.log('Adapter USDC:', formatUnits(adapterUsdc, 6));

  const adapterWpol = await client.readContract({
    address: WPOL,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [ADAPTER],
  });
  console.log('Adapter WPOL:', formatUnits(adapterWpol, 18));

  // Smart account balances
  const saUsdc = await client.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('Smart Account USDC:', formatUnits(saUsdc, 6));

  const saWpol = await client.readContract({
    address: WPOL,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('Smart Account WPOL:', formatUnits(saWpol, 18));
}

check().catch(console.error);
