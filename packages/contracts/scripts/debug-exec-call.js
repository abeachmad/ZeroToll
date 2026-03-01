const ethers = require('ethers');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const RPC = process.env.RPC_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com';
const ROUTER = process.env.SEPOLIA_ROUTERHUB || '0x19091A6c655704c8fb55023635eE3298DcDf66FF';
const FROM = process.env.RELAYER_ADDRESS || '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node debug-exec-call.js <input_hex>');
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(RPC);

  let dataArg = args[0];
  // If user passed a tx hash (0x... with length 66), fetch the tx and use its data
  let data;
  if (dataArg.startsWith('0x') && dataArg.length === 66) {
    console.log('Fetching transaction by hash:', dataArg);
    const onchainTx = await provider.getTransaction(dataArg);
    if (!onchainTx) {
      console.error('Transaction not found on RPC');
      process.exit(2);
    }
    data = onchainTx.data;
    console.log('Using data from on-chain tx:', data.slice(0, 200), '...');
  } else {
    data = dataArg.startsWith('0x') ? dataArg : '0x' + dataArg;
  }

  const tx = { to: ROUTER, from: FROM, data };

  try {
    const res = await provider.call(tx, 'latest');
    console.log('eth_call returned:', res);
  } catch (err) {
    console.error('Provider call threw error:');
    // err may contain error.body or error.error
    try {
      console.error(err);
      if (err.error && err.error.data) {
        console.error('err.error.data =', err.error.data);
      }
      if (err.data) console.error('err.data =', err.data);
      if (err.body) console.error('err.body =', err.body);
      // try to extract revert reason from err.error.data
      const dataHex = (err.error && err.error.data) || err.data || null;
      if (dataHex && dataHex.startsWith('0x')) {
        // decode revert reason if standard
        if (dataHex.startsWith('0x08c379a0')) {
          // remove selector and decode
          const reasonHex = '0x' + dataHex.slice(10 + 64*2); // crude
          // Better decode: slice after the offset word
          try {
            const buf = Buffer.from(dataHex.slice(2), 'hex');
            // 4 bytes selector, then ABI encoded string -> skip 4 + 32 + 32 = 68 bytes
            const reasonBuf = buf.slice(4 + 32 + 32);
            // first 32 bytes of reasonBuf is length, then string
            // find first zero from the end
            const reason = reasonBuf.toString('utf8').replace(/\x00/g, '');
            console.log('Decoded revert message (best-effort):', reason);
          } catch (e) {
            console.error('Failed to decode reason:', e);
          }
        } else {
          console.log('Non-standard revert data:', dataHex);
        }
      }
    } catch (e) {
      console.error('Failed to inspect error:', e);
    }
  }
}

main();
