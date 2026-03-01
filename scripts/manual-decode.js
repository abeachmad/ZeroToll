// Function selector: 0xe60269c6
// This is the first 4 bytes of keccak256 of the function signature

// FAILED TX
const failedData = "0xe60269c600000000000000000000000000000000000000000000000000000000000000600000000000000000000000007cafe27c7367fa0e929d4e83578cec838e3ceec700000000000000000000000000000000000000000000000000000000000002000000000000000000000000005a87a3c738cf99db95787d51b627217b6de12f6200000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e758200000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9000000000000000000000000000000000000000000000000004d1c6bba68300000000000000000000000000000000000000000000000000000000000001388200000000000000000000000000000000000000000000000000000000690f7deb00000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e75820000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000690f7b93";

// SUCCESS TX  
const successData = "0xe60269c600000000000000000000000000000000000000000000000000000000000000600000000000000000000000007cafe27c7367fa0e929d4e83578cec838e3ceec700000000000000000000000000000000000000000000000000000000000002000000000000000000000000005a87a3c738cf99db95787d51b627217b6de12f62000000000000000000000000360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf90000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e7582000000000000000000000000000000000000000000000000000000000008554a000000000000000000000000000000000000000000000000000000000001388200000000000000000000000000000000000000000000000000000000690f7e6b000000000000000000000000360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf90000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000690f7c13";

function decodeTransaction(data, label) {
  console.log(`=== ${label} ===\n`);
  
  // Skip function selector (8 chars)
  let txData = data.slice(10);

  // Parse each 32-byte parameter
  function parse32ByteParam(data, offset, type = 'address') {
    const hex = '0x' + data.slice(offset * 64, (offset + 1) * 64);
    if (type === 'address') {
      return '0x' + hex.slice(-40); // Last 20 bytes
    } else if (type === 'uint256') {
      return BigInt(hex);
    }
    return hex;
  }

  console.log("Parameters:");
  console.log(`[0] Offset: ${parse32ByteParam(txData, 0, 'uint256')}`);
  console.log(`[1] Adapter: ${parse32ByteParam(txData, 1, 'address')}`);
  console.log(`[2] Fee mode: ${parse32ByteParam(txData, 2, 'uint256')}`);
  console.log("");

  const user = parse32ByteParam(txData, 3, 'address');
  const tokenIn = parse32ByteParam(txData, 4, 'address');
  const amtIn = parse32ByteParam(txData, 5, 'uint256');
  const tokenOut = parse32ByteParam(txData, 6, 'address');
  const minOut = parse32ByteParam(txData, 7, 'uint256');
  
  console.log("RouteInstruction:");
  console.log(`  User: ${user}`);
  console.log(`  TokenIn: ${tokenIn}`);
  console.log(`  TokenOut: ${tokenOut}`);
  console.log("");
  
  // Detect token decimals from address
  const USDC_AMOY = '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582';
  const WMATIC = '0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9';
  
  const decimalsIn = tokenIn.toLowerCase() === USDC_AMOY.toLowerCase() ? 6 : 18;
  const decimalsOut = tokenOut.toLowerCase() === USDC_AMOY.toLowerCase() ? 6 : 18;
  
  const amtInValue = Number(amtIn) / Math.pow(10, decimalsIn);
  const minOutValue = Number(minOut) / Math.pow(10, decimalsOut);
  
  console.log(`  AmtIn: ${amtInValue} (decimals: ${decimalsIn})`);
  console.log(`  MinOut: ${minOutValue} (decimals: ${decimalsOut})`);
  console.log("");
  
  return { amtInValue, minOutValue, decimalsIn, decimalsOut };
}

const failed = decodeTransaction(failedData, "FAILED TX (USDC → WMATIC)");
const success = decodeTransaction(successData, "SUCCESS TX (WMATIC → USDC)");

console.log("=== COMPARISON ===\n");
console.log("FAILED:");
console.log(`  Swap: ${failed.amtInValue} USDC → ${failed.minOutValue.toFixed(4)} WMATIC minimum`);
console.log(`  Expected: ~5.55 WMATIC`);
console.log(`  Actual minOut: ${failed.minOutValue.toFixed(4)} WMATIC`);
console.log(`  ERROR: minOut is ${(5.55 / failed.minOutValue).toFixed(1)}x TOO LOW!`);
console.log("");

console.log("SUCCESS:");
console.log(`  Swap: ${success.amtInValue} WMATIC → ${success.minOutValue} USDC minimum`);
console.log(`  Expected: ~0.547 USDC (WMATIC worth $0.18, with slippage)`);
console.log(`  Actual minOut: ${success.minOutValue} USDC`);
console.log(`  ✅ Looks correct!`);
console.log("");

console.log("=== ROOT CAUSE ===");
console.log("Frontend calculates minOut dengan WRONG DECIMALS untuk USDC → WMATIC!");
console.log("Menggunakan decimals 10 atau 11 instead of 18 untuk output WMATIC!");
console.log("");
console.log("FIX REQUIRED: Check backend server.py line yang convert min_out ke wei");
