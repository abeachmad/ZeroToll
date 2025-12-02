import { ethers } from 'ethers';

const adapters = {
  'Amoy MockDEX': { 
    address: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1', 
    rpc: 'https://rpc-amoy.polygon.technology', 
    tokens: { 
      USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', 
      WPOL: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9' 
    }
  },
  'Sepolia MockDEX': { 
    address: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B', 
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com', 
    tokens: { 
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' 
    }
  }
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)', 
  'function decimals() view returns (uint8)'
];

async function check() {
  for (const [name, config] of Object.entries(adapters)) {
    console.log('\n' + name + ' (' + config.address + ')');
    const provider = new ethers.JsonRpcProvider(config.rpc);
    
    // Native balance
    const native = await provider.getBalance(config.address);
    console.log('  Native: ' + ethers.formatEther(native));
    
    // Token balances
    for (const [symbol, addr] of Object.entries(config.tokens)) {
      try {
        const token = new ethers.Contract(addr, ERC20_ABI, provider);
        const bal = await token.balanceOf(config.address);
        const dec = await token.decimals();
        console.log('  ' + symbol + ': ' + ethers.formatUnits(bal, dec));
      } catch(e) { 
        console.log('  ' + symbol + ': error - ' + e.message); 
      }
    }
  }
}

check();
