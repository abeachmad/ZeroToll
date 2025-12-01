// Test the prepare endpoint
const response = await fetch('http://localhost:3002/api/gasless/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '0x5a87A3c738cf99DB95787D51B627217B6dE12F62',
    chainId: 80002,
    calls: [{
      to: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      data: '0x095ea7b300000000000000000000000049ade5fbc18b1d2471e6001725c6ba3fe190488100000000000000000000000000000000000000000000000000000000000f4240',
      value: '0'
    }]
  })
});

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
