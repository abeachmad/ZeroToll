// Fund RouterV3 with zToken liquidity for test swaps
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = await hre.ethers.provider.getNetwork().then(n => n.chainId);
  
  console.log("=".repeat(60));
  console.log("FUND ROUTERV3 WITH ZTOKEN LIQUIDITY");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", chainId);
  
  // RouterV3 addresses
  const routerV3Addresses = {
    80002: "0xD83D377E4698317731b2953854c01d39C60815d7",
    11155111: "0xB54e95a30E4Aa355380798313E0791833C7F0BFF"
  };
  
  // zToken addresses
  const zTokens = {
    80002: {
      zUSDC: { address: "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD", decimals: 6 },
      zETH: { address: "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9", decimals: 18 },
      zPOL: { address: "0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d", decimals: 18 },
      zLINK: { address: "0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1", decimals: 18 },
    },
    11155111: {
      zUSDC: { address: "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C", decimals: 6 },
      zETH: { address: "0x8153FA09Be1689D44C343f119C829F6702A8720b", decimals: 18 },
      zPOL: { address: "0x63c31C4247f6AA40B676478226d6FEB5707649D6", decimals: 18 },
      zLINK: { address: "0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C", decimals: 18 },
    }
  };
  
  const routerV3 = routerV3Addresses[chainId];
  if (!routerV3) {
    console.log("RouterV3 not deployed on this chain yet");
    return;
  }
  
  const tokens = zTokens[chainId];
  if (!tokens) {
    console.log("No zTokens configured for this chain");
    return;
  }
  
  console.log("\nRouterV3:", routerV3);
  console.log("");
  
  // ERC20 ABI for faucet and transfer
  const ERC20_ABI = [
    "function faucet() external",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];
  
  // RouterV3 ABI for addTestLiquidity
  const ROUTER_ABI = [
    "function addTestLiquidity(address token, uint256 amount) external"
  ];
  
  const router = new hre.ethers.Contract(routerV3, ROUTER_ABI, deployer);
  
  for (const [symbol, tokenInfo] of Object.entries(tokens)) {
    console.log(`\n📦 Processing ${symbol}...`);
    
    const token = new hre.ethers.Contract(tokenInfo.address, ERC20_ABI, deployer);
    
    // Check current balance
    let balance = await token.balanceOf(deployer.address);
    const formattedBalance = hre.ethers.formatUnits(balance, tokenInfo.decimals);
    console.log(`   Deployer balance: ${formattedBalance} ${symbol}`);
    
    // If balance is low, call faucet
    const minBalance = hre.ethers.parseUnits("100", tokenInfo.decimals);
    if (balance < minBalance) {
      console.log(`   Calling faucet...`);
      try {
        const tx = await token.faucet();
        await tx.wait();
        balance = await token.balanceOf(deployer.address);
        console.log(`   ✅ Faucet claimed! New balance: ${hre.ethers.formatUnits(balance, tokenInfo.decimals)}`);
      } catch (e) {
        console.log(`   ⚠️ Faucet failed: ${e.message}`);
      }
    }
    
    // Check router balance
    const routerBalance = await token.balanceOf(routerV3);
    console.log(`   Router balance: ${hre.ethers.formatUnits(routerBalance, tokenInfo.decimals)} ${symbol}`);
    
    // Transfer to router if needed
    const targetLiquidity = hre.ethers.parseUnits("500", tokenInfo.decimals);
    if (routerBalance < targetLiquidity && balance > 0n) {
      const transferAmount = balance > targetLiquidity ? targetLiquidity : balance / 2n;
      console.log(`   Transferring ${hre.ethers.formatUnits(transferAmount, tokenInfo.decimals)} to router...`);
      
      try {
        // Approve first
        const approveTx = await token.approve(routerV3, transferAmount);
        await approveTx.wait();
        
        // Add liquidity
        const addTx = await router.addTestLiquidity(tokenInfo.address, transferAmount);
        await addTx.wait();
        
        const newRouterBalance = await token.balanceOf(routerV3);
        console.log(`   ✅ Router now has: ${hre.ethers.formatUnits(newRouterBalance, tokenInfo.decimals)} ${symbol}`);
      } catch (e) {
        console.log(`   ⚠️ Transfer failed: ${e.message}`);
        
        // Try direct transfer as fallback
        try {
          console.log(`   Trying direct transfer...`);
          const directTx = await token.transfer(routerV3, transferAmount);
          await directTx.wait();
          const newRouterBalance = await token.balanceOf(routerV3);
          console.log(`   ✅ Direct transfer success! Router: ${hre.ethers.formatUnits(newRouterBalance, tokenInfo.decimals)} ${symbol}`);
        } catch (e2) {
          console.log(`   ❌ Direct transfer also failed: ${e2.message}`);
        }
      }
    } else {
      console.log(`   ✅ Router already has sufficient liquidity`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("FUNDING COMPLETE");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
