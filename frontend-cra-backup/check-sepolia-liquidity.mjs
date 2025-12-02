import { createPublicClient, http, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';
const ROUTER = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';
const DEPLOYER = '0x330A86eE67bA0Da0043EaD201866A32d362C394c';
const EOA = '0x8F322fAF976F5F584f6574a5b217E5443f2CD848';
const SMART_ACCOUNT = '0xEef74EB6f5eA5f869115846E9771A8551f9e4323';

async function check() {
  const client = createPublicClient({ 
    chain: sepolia, 
    transport: http('https://ethereum-sepolia-rpc.publicnode.com') 
  });
  
  console.log('=== SEPOLIA LIQUIDITY CHECK ===\n');
  
  console.log('Adapter:', ADAPTER);
  console.log('  USDC:', formatUnits(await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [ADAPTER] }), 6));
  console.log('  WETH:', formatUnits(await client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [ADAPTER] }), 18));
  
  console.log('\nRouter:', ROUTER);
  console.log('  USDC:', formatUnits(await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [ROUTER] }), 6));
  console.log('  WETH:', formatUnits(await client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [ROUTER] }), 18));
  
  console.log('\nDeployer:', DEPLOYER);
  console.log('  ETH:', formatUnits(await client.getBalance({ address: DEPLOYER }), 18));
  console.log('  USDC:', formatUnits(await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [DEPLOYER] }), 6));
  console.log('  WETH:', formatUnits(await client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [DEPLOYER] }), 18));
  
  console.log('\nEOA (Test User):', EOA);
  console.log('  ETH:', formatUnits(await client.getBalance({ address: EOA }), 18));
  console.log('  USDC:', formatUnits(await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [EOA] }), 6));
  console.log('  WETH:', formatUnits(await client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [EOA] }), 18));
  
  console.log('\nSmart Account:', SMART_ACCOUNT);
  console.log('  ETH:', formatUnits(await client.getBalance({ address: SMART_ACCOUNT }), 18));
  console.log('  USDC:', formatUnits(await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [SMART_ACCOUNT] }), 6));
  console.log('  WETH:', formatUnits(await client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [SMART_ACCOUNT] }), 18));
}

check().catch(console.error);
