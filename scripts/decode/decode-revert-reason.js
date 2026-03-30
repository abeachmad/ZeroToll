// Decode revert reason from failed transaction
const axios = require('axios');

const FAILED_TX = "0xfed5550d097581531cb4b038b648be8866a332bfa7904a740d17edbdef46c1ba";
const RPC = "https://rpc-amoy.polygon.technology/";

async function main() {
  console.log(`\n=== DECODING REVERT REASON ===\n`);
  console.log(`TX: ${FAILED_TX}`);
  
  try {
    // Get transaction receipt
    const receipt = await axios.post(RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [FAILED_TX]
    });
    
    console.log(`\nStatus: ${receipt.data.result.status === '0x1' ? 'Success' : 'Failed'}`);
    console.log(`Gas used: ${parseInt(receipt.data.result.gasUsed, 16)}`);
    
    // Try to get revert reason via eth_call replay
    const tx = await axios.post(RPC, {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_getTransactionByHash",
      params: [FAILED_TX]
    });
    
    const txData = tx.data.result;
    console.log(`\nReplaying transaction to get revert reason...`);
    
    // Replay with eth_call
    try {
      const call = await axios.post(RPC, {
        jsonrpc: "2.0",
        id: 3,
        method: "eth_call",
        params: [
          {
            from: txData.from,
            to: txData.to,
            data: txData.input,
            value: txData.value
          },
          txData.blockNumber
        ]
      });
      
      console.log(`Call result:`, call.data);
    } catch (err) {
      console.log(`Revert error:`, err.response?.data || err.message);
    }
    
  } catch (error) {
    console.error(`Error:`, error.response?.data || error.message);
  }
}

main().catch(console.error);
