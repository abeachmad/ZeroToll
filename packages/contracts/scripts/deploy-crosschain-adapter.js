/**
 * Deploy MockLayerZeroAdapter for cross-chain swaps
 * 
 * This deploys the mock adapter on both Amoy and Sepolia
 * and configures them as peers
 */

const { ethers } = require("hardhat");

// Contract addresses
const CONTRACTS = {
  amoy: {
    chainId: 80002,
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
    mockDexAdapter: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1',
    priceOracle: '0x729fBc26977F8df79B45c1c5789A483640E89b4A',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    link: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
    weth: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9', // WPOL
  },
  sepolia: {
    chainId: 11155111,
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
    priceOracle: '0x729fBc26977F8df79B45c1c5789A483640E89b4A',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  }
};

async function main() {
  const network = hre.network.name;
  console.log(`\n🌉 Deploying MockLayerZeroAdapter on ${network}\n`);
  
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);
  
  const config = network === 'amoy' ? CONTRACTS.amoy : CONTRACTS.sepolia;
  
  // Deploy MockLayerZeroAdapter
  console.log("\n📦 Deploying MockLayerZeroAdapter...");
  const MockLayerZeroAdapter = await ethers.getContractFactory("MockLayerZeroAdapter");
  const adapter = await MockLayerZeroAdapter.deploy(
    config.mockDexAdapter,
    config.priceOracle
  );
  await adapter.waitForDeployment();
  
  const adapterAddress = await adapter.getAddress();
  console.log("✅ MockLayerZeroAdapter deployed to:", adapterAddress);
  
  // Whitelist in RouterHub
  console.log("\n🔧 Whitelisting adapter in RouterHub...");
  const RouterHub = await ethers.getContractFactory("RouterHub");
  const routerHub = RouterHub.attach(config.routerHub);
  
  const whitelistTx = await routerHub.whitelistAdapter(adapterAddress, true);
  await whitelistTx.wait();
  console.log("✅ Adapter whitelisted in RouterHub");
  
  // Fund adapter with destination tokens for testing
  console.log("\n💰 Funding adapter with tokens...");
  
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function transfer(address, uint256) returns (bool)"
  ];
  
  // Fund with WETH/WPOL
  const weth = new ethers.Contract(config.weth, ERC20_ABI, deployer);
  const wethBalance = await weth.balanceOf(deployer.address);
  console.log("   Deployer WETH balance:", ethers.formatEther(wethBalance));
  if (wethBalance > ethers.parseEther("0.01")) {
    const fundAmount = ethers.parseEther("0.01");
    await weth.approve(adapterAddress, fundAmount);
    await adapter.fundAdapter(config.weth, fundAmount);
    console.log("✅ Funded with 0.01 WETH/WPOL");
  }
  
  // Fund with USDC
  const usdc = new ethers.Contract(config.usdc, ERC20_ABI, deployer);
  const usdcBalance = await usdc.balanceOf(deployer.address);
  console.log("   Deployer USDC balance:", ethers.formatUnits(usdcBalance, 6));
  if (usdcBalance > ethers.parseUnits("10", 6)) {
    const fundAmount = ethers.parseUnits("10", 6);
    await usdc.approve(adapterAddress, fundAmount);
    await adapter.fundAdapter(config.usdc, fundAmount);
    console.log("✅ Funded with 10 USDC");
  }
  
  console.log("\n📋 Deployment Summary:");
  console.log("   Network:", network);
  console.log("   Chain ID:", config.chainId);
  console.log("   MockLayerZeroAdapter:", adapterAddress);
  console.log("   RouterHub:", config.routerHub);
  
  console.log("\n📝 Next Steps:");
  console.log("   1. Deploy on the other network");
  console.log("   2. Set peers on both adapters");
  console.log("   3. Run cross-chain test");
  
  // Return address for scripting
  return adapterAddress;
}

main()
  .then((address) => {
    console.log("\n✅ Deployment complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
