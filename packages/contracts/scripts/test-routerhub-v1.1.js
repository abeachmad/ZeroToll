const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const NEW_ROUTER = '0x2cf601a7E93DA17Da28C4F0EA91E769739BA568f';
  const ADAPTER = '0xcf9f209DCED8181937E289E3D68f8B2cEB77A904'; // With defensive checks
  const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const LINK = '0x779877A7B0D9E8603169DdbD7836e478b4624789';
  
  const routerHub = await hre.ethers.getContractAt('RouterHub', NEW_ROUTER);
  
  console.log('🧪 Testing RouterHub v1.1...');
  console.log('Account:', signer.address);
  console.log('');
  
  // Check if adapter is whitelisted
  const isWhitelisted = await routerHub.whitelistedAdapter(ADAPTER);
  console.log('Adapter whitelisted:', isWhitelisted ? '✅' : '❌');
  
  // Approve RouterHub for USDC
  console.log('');
  console.log('📝 Approving RouterHub for USDC...');
  const usdc = await hre.ethers.getContractAt('IERC20', USDC);
  const approveTx = await usdc.approve(NEW_ROUTER, hre.ethers.MaxUint256);
  await approveTx.wait();
  console.log('✅ Approved');
  
  // Build intent
  const intent = {
    user: signer.address,
    tokenIn: USDC,
    amtIn: 10000,
    tokenOut: LINK,
    minOut: 400000000000000n,
    dstChainId: 11155111,
    deadline: Math.floor(Date.now() / 1000) + 600,
    feeToken: USDC,
    feeMode: 1,
    feeCapToken: 0,
    routeHint: '0x',
    nonce: 0
  };
  
  const swapSelector = '0x9908fc8b';
  const routeData = hre.ethers.concat([
    swapSelector,
    hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
      [USDC, LINK, 10000, 400000000000000n, signer.address, intent.deadline]
    )
  ]);
  
  console.log('');
  console.log('🚀 Executing swap...');
  const tx = await routerHub.executeRoute(intent, ADAPTER, routeData, { gasLimit: 800000 });
  console.log('TX:', tx.hash);
  const receipt = await tx.wait();
  
  if (receipt.status === 1) {
    console.log('✅ SUCCESS!');
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Explorer: https://sepolia.etherscan.io/tx/' + tx.hash);
  } else {
    console.log('❌ Transaction reverted');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
