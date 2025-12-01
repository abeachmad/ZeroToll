import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const address = '0x5a87A3c738cf99DB95787D51B627217B6dE12F62';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

async function main() {
  console.log('Checking account on Sepolia:', address);
  
  const code = await publicClient.getCode({ address });
  console.log('Code:', code);
  
  if (code && code !== '0x' && code.startsWith('0xef0100')) {
    const delegator = '0x' + code.substring(8, 48);
    console.log('✅ Smart Account ENABLED on Sepolia');
    console.log('   Delegator:', delegator);
  } else {
    console.log('❌ Smart Account NOT enabled on Sepolia');
    console.log('   Code is:', code || '0x (empty)');
  }
}

main().catch(console.error);
