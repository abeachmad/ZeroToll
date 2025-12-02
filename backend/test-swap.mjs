const response = await fetch('http://localhost:3001/api/intents/swap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chainId: 11155111,
    intent: {
      user: '0x7E98e08FbD9c6250Bc6b6649A09268C2500373E2',
      tokenIn: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      tokenOut: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      amountIn: '1000000000000000000',
      minAmountOut: '900000000000000000',
      deadline: '1733200000',
      nonce: '0',
      chainId: '11155111'
    },
    userSignature: '0x9321accac7a4bd6d3967a96a4a7ed402ea6c10c498b93c8027651e4df0635cc6091ef38f45e1e87e4f55e49ed17eead3b53a8ad161e0996c027b660400559e3f1c'
  })
});

const result = await response.json();
console.log('Status:', response.status);
console.log('Result:', JSON.stringify(result, null, 2));
