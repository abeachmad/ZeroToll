// Test the direct execution endpoint
const response = await fetch('http://localhost:3002/api/gasless/execute-direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chainId: 80002,
    privateKey: '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04',
    calls: [{
      to: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // USDC
      data: '0x095ea7b300000000000000000000000049ade5fbc18b1d2471e6001725c6ba3fe190488100000000000000000000000000000000000000000000000000000000000f4240', // approve 1 USDC
      value: '0'
    }]
  })
});

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
