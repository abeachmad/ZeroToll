const hre = require("hardhat");

async function main() {
  const networks = [
    {
      name: "Amoy",
      rpc: "https://rpc-amoy.polygon.technology",
      routerHub: "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b",
      adapter: "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7"
    },
    {
      name: "Sepolia",
      rpc: "https://eth-sepolia.g.alchemy.com/v2/demo",
      routerHub: "0x1449279761a3e6642B02E82A7be9E5234be00159",
      adapter: "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
    }
  ];

  for (const net of networks) {
    console.log(`\n=== ${net.name} ===`);
    const provider = new hre.ethers.JsonRpcProvider(net.rpc);
    const routerHub = await hre.ethers.getContractAt("RouterHub", net.routerHub, provider);
    
    try {
      const isWhitelisted = await routerHub.whitelistedAdapter(net.adapter);
      console.log(`RouterHub: ${net.routerHub}`);
      console.log(`Adapter: ${net.adapter}`);
      console.log(`Whitelisted: ${isWhitelisted ? "✅ YES" : "❌ NO"}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

main().catch(console.error);
