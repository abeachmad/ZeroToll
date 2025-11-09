const hre = require("hardhat");

// All old adapters from deployment history
const OLD_ADAPTERS = {
  sepolia: [
    { addr: "0x86D1AA2228F3ce649d415F19fC71134264D0E84B", desc: "Old MockDEX v1" },
    { addr: "0x3522D5F996a506374c33835a985Bf7ec775403B2", desc: "Old MockDEX v2 (pre-Pyth)" },
  ],
  amoy: [
    { addr: "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301", desc: "Very old adapter" },
    { addr: "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7", desc: "Old adapter v2" },
    { addr: "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec", desc: "Most recent (pre-Pyth)" },
  ]
};

const TOKENS = {
  sepolia: {
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  },
  amoy: {
    WPOL: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
    USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    LINK: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
  }
};

async function checkBalance(tokenAddr, adapterAddr, symbol) {
  try {
    const token = await hre.ethers.getContractAt("IERC20", tokenAddr);
    const decimals = symbol === "USDC" ? 6 : 18;
    const balance = await token.balanceOf(adapterAddr);
    const formatted = hre.ethers.formatUnits(balance, decimals);
    
    if (parseFloat(formatted) > 0) {
      return { symbol, balance: balance.toString(), formatted, hasBalance: true };
    }
    return { symbol, balance: "0", formatted: "0", hasBalance: false };
  } catch (e) {
    return { symbol, balance: "0", formatted: "0", hasBalance: false, error: e.message };
  }
}

async function checkNativeBalance(adapterAddr) {
  try {
    const balance = await hre.ethers.provider.getBalance(adapterAddr);
    const formatted = hre.ethers.formatEther(balance);
    if (parseFloat(formatted) > 0) {
      return { balance: balance.toString(), formatted, hasBalance: true };
    }
    return { balance: "0", formatted: "0", hasBalance: false };
  } catch (e) {
    return { balance: "0", formatted: "0", hasBalance: false, error: e.message };
  }
}

async function main() {
  const network = hre.network.name;
  console.log(`🔍 Checking old adapter balances on ${network}\n`);
  
  const adapters = OLD_ADAPTERS[network];
  const tokens = TOKENS[network];
  
  if (!adapters) {
    console.log(`No old adapters configured for ${network}`);
    return;
  }
  
  const nativeSymbol = network === "sepolia" ? "ETH" : "POL";
  let totalAdaptersWithFunds = 0;
  const rescueList = [];
  
  for (const adapter of adapters) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Adapter: ${adapter.addr}`);
    console.log(`Description: ${adapter.desc}`);
    console.log();
    
    let hasAnyBalance = false;
    const balances = {};
    
    // Check native balance
    const nativeBalance = await checkNativeBalance(adapter.addr);
    if (nativeBalance.hasBalance) {
      console.log(`  💰 ${nativeSymbol}: ${nativeBalance.formatted} (${nativeBalance.balance} wei)`);
      hasAnyBalance = true;
      balances[nativeSymbol] = nativeBalance;
    }
    
    // Check token balances
    for (const [symbol, address] of Object.entries(tokens)) {
      const balance = await checkBalance(address, adapter.addr, symbol);
      if (balance.hasBalance) {
        console.log(`  💰 ${symbol}: ${balance.formatted} (${balance.balance})`);
        hasAnyBalance = true;
        balances[symbol] = balance;
      }
    }
    
    if (hasAnyBalance) {
      console.log(`  ⚠️  HAS FUNDS - NEED TO RESCUE!`);
      totalAdaptersWithFunds++;
      rescueList.push({ adapter, balances });
    } else {
      console.log(`  ✅ Empty - safe to ignore`);
    }
    console.log();
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 SUMMARY`);
  console.log(`Total old adapters: ${adapters.length}`);
  console.log(`Adapters with funds: ${totalAdaptersWithFunds}`);
  console.log(`Empty adapters: ${adapters.length - totalAdaptersWithFunds}`);
  
  if (rescueList.length > 0) {
    console.log(`\n⚠️  RESCUE NEEDED FOR ${rescueList.length} ADAPTER(S):`);
    rescueList.forEach(({ adapter, balances }) => {
      console.log(`\n  ${adapter.desc}`);
      console.log(`  Address: ${adapter.addr}`);
      Object.entries(balances).forEach(([symbol, bal]) => {
        console.log(`    - ${symbol}: ${bal.formatted}`);
      });
    });
  } else {
    console.log(`\n✅ All old adapters are empty - no rescue needed!`);
  }
}

main().catch(console.error);
