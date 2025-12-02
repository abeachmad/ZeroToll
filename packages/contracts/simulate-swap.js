/**
 * Simulate a swap call to debug why it's failing
 */

const { ethers } = require('ethers');

const AMOY_RPC = 'https://rpc-amoy.polygon.technology';

const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

const TOKENS = {
  WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
  USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
};

// Test user address (the fresh account that failed)
const TEST_USER = '0x7E98e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8373E2'; // Replace with actual address

const ROUTER_HUB_ABI = [
  'function executeRoute(tuple(address user, address tokenIn, uint256 amtIn, address tokenOut, uint256 minOut, uint64 dstChainId, uint64 deadline, address feeToken, uint8 feeMode, uint256 feeCapToken, bytes routeHint, uint256 nonce) intent, address adapter, bytes routeData) external returns (uint256)'
];

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

async function main() {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  
  console.log('Swap Simulation Debug (Amoy)');
  console.log('============================\n');
  
  // Check user's USDC balance and allowance
  const usdc = new ethers.Contract(TOKENS.USDC, ERC20_ABI, provider);
  
  const userBalance = await usdc.balanceOf(TEST_USER);
  const userAllowance = await usdc.allowance(TEST_USER, ROUTER_HUB);
  
  console.log('User:', TEST_USER);
  console.log('  USDC Balance:', ethers.formatUnits(userBalance, 6));
  console.log('  USDC Allowance to RouterHub:', ethers.formatUnits(userAllowance, 6));
  
  // Build the intent
  const amountIn = 100000n; // 0.1 USDC
  const minOut = ethers.parseUnits('0.5', 18); // 0.5 WMATIC minimum
  const deadline = Math.floor(Date.now() / 1000) + 600;
  
  const intent = {
    user: TEST_USER,
    tokenIn: TOKENS.USDC,
    amtIn: amountIn,
    tokenOut: TOKENS.WMATIC,
    minOut: minOut,
    dstChainId: 80002n,
    deadline: BigInt(deadline),
    feeToken: TOKENS.USDC,
    feeMode: 1, // TOKEN_INPUT_SOURCE
    feeCapToken: ethers.parseUnits('1', 18),
    routeHint: '0x',
    nonce: BigInt(Date.now())
  };
  
  console.log('\nIntent:');
  console.log('  tokenIn:', intent.tokenIn);
  console.log('  amtIn:', intent.amtIn.toString(), '(0.1 USDC)');
  console.log('  tokenOut:', intent.tokenOut);
  console.log('  minOut:', ethers.formatUnits(intent.minOut, 18), 'WMATIC');
  
  // Build routeData for MockDEXAdapter
  const adapterInterface = new ethers.Interface([
    'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) external payable returns (uint256)'
  ]);
  
  const routeData = adapterInterface.encodeFunctionData('swap', [
    TOKENS.USDC,
    TOKENS.WMATIC,
    amountIn,
    minOut,
    ROUTER_HUB, // RouterHub receives output
    deadline
  ]);
  
  console.log('\nRouteData:', routeData.substring(0, 66) + '...');
  
  // Build the full executeRoute call
  const routerHubInterface = new ethers.Interface(ROUTER_HUB_ABI);
  const callData = routerHubInterface.encodeFunctionData('executeRoute', [
    intent,
    MOCK_DEX,
    routeData
  ]);
  
  console.log('\nFull CallData:', callData.substring(0, 66) + '...');
  console.log('CallData length:', callData.length, 'bytes');
  
  // Try to estimate gas (this will fail if the call would revert)
  console.log('\n============================');
  console.log('Attempting to estimate gas...');
  
  try {
    const gasEstimate = await provider.estimateGas({
      from: TEST_USER,
      to: ROUTER_HUB,
      data: callData
    });
    console.log('✅ Gas estimate:', gasEstimate.toString());
  } catch (err) {
    console.log('❌ Gas estimation failed!');
    console.log('Error:', err.message);
    
    // Try to decode the revert reason
    if (err.data) {
      console.log('Revert data:', err.data);
    }
    
    // Check common issues
    console.log('\n============================');
    console.log('Debugging common issues:');
    
    // 1. Check allowance
    if (userAllowance < amountIn) {
      console.log('❌ ISSUE: Insufficient allowance!');
      console.log(`   Need: ${ethers.formatUnits(amountIn, 6)} USDC`);
      console.log(`   Have: ${ethers.formatUnits(userAllowance, 6)} USDC`);
    } else {
      console.log('✅ Allowance OK');
    }
    
    // 2. Check balance
    if (userBalance < amountIn) {
      console.log('❌ ISSUE: Insufficient balance!');
      console.log(`   Need: ${ethers.formatUnits(amountIn, 6)} USDC`);
      console.log(`   Have: ${ethers.formatUnits(userBalance, 6)} USDC`);
    } else {
      console.log('✅ Balance OK');
    }
  }
}

main().catch(console.error);
