const hre = require("hardhat");

async function main() {
    const amoyDeployment = require("../deployments/amoy-v1.3-1762370990290.json");
    const sepoliaConfig = {
        routerHub: "0x1449279761a3e6642B02E82A7be9E5234be00159",
        adapter: "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
    };

    console.log("\n🔍 Checking Adapter Whitelist Status...\n");

    // Check Amoy
    console.log("=== POLYGON AMOY ===");
    console.log("RouterHub:", amoyDeployment.routerHub);
    console.log("Adapter:", amoyDeployment.mockDEXAdapter);
    
    const amoyProvider = new hre.ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology/");
    const amoyRouter = await hre.ethers.getContractAt("RouterHub", amoyDeployment.routerHub, amoyProvider);
    const amoyWhitelisted = await amoyRouter.whitelistedAdapter(amoyDeployment.mockDEXAdapter);
    console.log("Whitelisted:", amoyWhitelisted);
    console.log();

    // Check Sepolia
    console.log("=== ETHEREUM SEPOLIA ===");
    console.log("RouterHub:", sepoliaConfig.routerHub);
    console.log("Adapter:", sepoliaConfig.adapter);
    
    const sepoliaProvider = new hre.ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY);
    const sepoliaRouter = await hre.ethers.getContractAt("RouterHub", sepoliaConfig.routerHub, sepoliaProvider);
    const sepoliaWhitelisted = await sepoliaRouter.whitelistedAdapter(sepoliaConfig.adapter);
    console.log("Whitelisted:", sepoliaWhitelisted);
    console.log();
    
    // Summary
    console.log("=== SUMMARY ===");
    if (!amoyWhitelisted) {
        console.log("❌ Amoy adapter NOT whitelisted - needs whitelist-adapter.js");
    } else {
        console.log("✅ Amoy adapter whitelisted");
    }
    
    if (!sepoliaWhitelisted) {
        console.log("❌ Sepolia adapter NOT whitelisted - needs whitelist-adapter.js");
    } else {
        console.log("✅ Sepolia adapter whitelisted");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
