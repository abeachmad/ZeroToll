import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config();

const RELAYER_ADDRESS = '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const balance = await client.getBalance({ address: RELAYER_ADDRESS });
console.log('Relayer balance:', balance.toString(), 'wei');
console.log('Relayer balance:', Number(balance) / 1e18, 'ETH');
