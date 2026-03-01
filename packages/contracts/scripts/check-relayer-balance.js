const hre = require("hardhat");

async function main() {
  const RELAYER_KEY = "0x470e31d6cb154d9c5fe824241d57689665869db3df390278570aeecd2318116c";
  
  const networks = [
    { name: "Amoy", rpc: "https://rpc-amoy.polygon.technology" },
    { name: "Sepolia", rpc: "https://eth-sepolia.g.alchemy.com/v2/demo" }
  ];
  
  for (const net of networks) {
    console.log(`\n=== ${net.name} ===`);
    const provider = new hre.ethers.JsonRpcProvider(net.rpc);
    const relayer = new hre.ethers.Wallet(RELAYER_KEY, provider);
    
    console.log(`Relayer: ${relayer.address}`);
    
    const balance = await provider.getBalance(relayer.address);
    console.log(`Native: ${hre.ethers.formatEther(balance)}`);
    
    // Check USDC
    const usdcAddr = net.name === "Amoy" 
      ? "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
      : "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    
    const usdc = await hre.ethers.getContractAt("IERC20", usdcAddr, provider);
    const usdcBal = await usdc.balanceOf(relayer.address);
    console.log(`USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
  }
}

main().catch(console.error);
