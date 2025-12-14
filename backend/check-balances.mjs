import { createPublicClient, http, formatEther, parseAbi } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';

const ADDRESSES = {
  deployer: '0x330A86eE67bA0Da0043EaD201866A32d362C394c',
  relayer: '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A',
  bundlerWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  sepoliaPaymaster: '0xB9F49b6d8e7af756dE755C254683B4aAAaCF27cF',
  amoyPaymaster: '0xe28fdf6B360235B2195f73C756aE3E051A7fA1Ed'
};

const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const amoyClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

async function main() {
  console.log('\n=== SEPOLIA ===');
  const deployerSepolia = await sepoliaClient.getBalance({ address: ADDRESSES.deployer });
  const relayerSepolia = await sepoliaClient.getBalance({ address: ADDRESSES.relayer });
  const bundlerSepolia = await sepoliaClient.getBalance({ address: ADDRESSES.bundlerWallet });
  console.log('Deployer:', formatEther(deployerSepolia), 'ETH');
  console.log('Relayer:', formatEther(relayerSepolia), 'ETH');
  console.log('Bundler Wallet:', formatEther(bundlerSepolia), 'ETH');
  
  try {
    const paymasterDeposit = await sepoliaClient.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [ADDRESSES.sepoliaPaymaster]
    });
    console.log('Paymaster Deposit:', formatEther(paymasterDeposit), 'ETH');
  } catch (e) {
    console.log('Paymaster Deposit: 0 ETH (not funded yet)');
  }

  console.log('\n=== AMOY ===');
  const deployerAmoy = await amoyClient.getBalance({ address: ADDRESSES.deployer });
  const relayerAmoy = await amoyClient.getBalance({ address: ADDRESSES.relayer });
  console.log('Deployer:', formatEther(deployerAmoy), 'POL');
  console.log('Relayer:', formatEther(relayerAmoy), 'POL');
  
  try {
    const paymasterDeposit = await amoyClient.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [ADDRESSES.amoyPaymaster]
    });
    console.log('Paymaster Deposit:', formatEther(paymasterDeposit), 'POL');
  } catch (e) {
    console.log('Paymaster Deposit: Error -', e.message);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('Sepolia Paymaster:', ADDRESSES.sepoliaPaymaster);
  console.log('Amoy Paymaster:', ADDRESSES.amoyPaymaster);
}

main();
