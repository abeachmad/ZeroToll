async function checkApprovalHistory() {
  const USER = "0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A";
  const ROUTER_AMOY = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
  const ROUTER_SEPOLIA = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
  
  const AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const AMOY_WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const SEPOLIA_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  
  console.log("=== CHECKING APPROVAL HISTORY ===\n");
  
  // Amoy
  console.log("AMOY - Checking approval events for user");
  console.log("User:", USER);
  console.log("Router:", ROUTER_AMOY);
  console.log("");
  
  console.log("Check manually:");
  console.log(`1. USDC Approvals: https://amoy.polygonscan.com/token/${AMOY_USDC}?a=${USER}#tokenAnalytics`);
  console.log(`2. WMATIC Approvals: https://amoy.polygonscan.com/token/${AMOY_WMATIC}?a=${USER}#tokenAnalytics`);
  console.log("");
  
  console.log("SEPOLIA - Checking approval events for user");
  console.log("User:", USER);
  console.log("Router:", ROUTER_SEPOLIA);
  console.log("");
  
  console.log("Check manually:");
  console.log(`1. USDC Approvals: https://sepolia.etherscan.io/token/${SEPOLIA_USDC}?a=${USER}#tokenAnalytics`);
  console.log(`2. WETH Approvals: https://sepolia.etherscan.io/token/${SEPOLIA_WETH}?a=${USER}#tokenAnalytics`);
  console.log("");
  
  console.log("=== KEY QUESTION ===");
  console.log("Did user approve with INFINITE amount (type(uint256).max)?");
  console.log("Or did user approve with EXACT amount?");
  console.log("");
  console.log("If WMATIC uses EXACT approval → button always appears");
  console.log("If USDC uses INFINITE approval → button never appears (until spent)");
}

checkApprovalHistory();
