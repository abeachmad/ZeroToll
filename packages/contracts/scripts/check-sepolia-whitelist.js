const hre = require("hardhat");

async function main() {
    const sepoliaConfig = {
        routerHub: "0x1449279761a3e6642B02E82A7be9E5234be00159",
        adapter: "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
    };

    console.log("\n🔍 Checking Sepolia Adapter Whitelist...\n");
    console.log("RouterHub:", sepoliaConfig.routerHub);
    console.log("Adapter:", sepoliaConfig.adapter);
    
    // Use public Sepolia RPC
    const sepoliaProvider = new hre.ethers.JsonRpcProvider("https://rpc.sepolia.org");
    const sepoliaRouter = await hre.ethers.getContractAt("RouterHub", sepoliaConfig.routerHub, sepoliaProvider);
    const sepoliaWhitelisted = await sepoliaRouter.whitelistedAdapter(sepoliaConfig.adapter);
    console.log("Whitelisted:", sepoliaWhitelisted);
    
    if (!sepoliaWhitelisted) {
        console.log("\n❌ ADAPTER NOT WHITELISTED!");
        console.log("Need to run: npx hardhat run scripts/whitelist-adapter.js --network sepolia");
    } else {
        console.log("\n✅ Adapter is whitelisted");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
