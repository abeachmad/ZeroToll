// Test bundler RPC
const response = await fetch('http://localhost:3000/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_chainId',
    params: []
  })
});

const result = await response.json();
console.log('Bundler response:', result);
