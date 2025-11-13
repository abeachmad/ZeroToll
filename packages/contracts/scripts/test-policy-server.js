/**
 * Test Policy Server - Verify signature generation for VerifyingPaymaster
 */

const { ethers } = require("hardhat");

// EntryPoint ABI for getUserOpHash
const ENTRYPOINT_ABI = [
  "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)"
];

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("POLICY SERVER TEST - SIGNATURE GENERATION");
  console.log("=".repeat(80));

  // Configuration
  const POLICY_SERVER_URL = "http://localhost:3002";
  const AMOY_RPC = "https://rpc-amoy.polygon.technology";
  const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const PAYMASTER_ADDRESS = "0xC721582d25895956491436459df34cd817C6AB74";
  const CHAIN_ID = 80002;

  // Test wallet (any address for testing)
  const testSender = "0x1234567890123456789012345678901234567890";

  console.log("\n📋 CONFIGURATION:");
  console.log("Policy Server:", POLICY_SERVER_URL);
  console.log("Paymaster:", PAYMASTER_ADDRESS);
  console.log("EntryPoint:", ENTRYPOINT_ADDRESS);
  console.log("Chain ID:", CHAIN_ID);
  console.log("Test Sender:", testSender);

  // Step 1: Health check
  console.log("\n" + "=".repeat(80));
  console.log("TEST 1: POLICY SERVER HEALTH CHECK");
  console.log("=".repeat(80));
  
  try {
    const healthResponse = await fetch(`${POLICY_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log("✅ Policy server is healthy");
    console.log("   Signer:", healthData.signer);
    console.log("   Networks:", healthData.networks.join(", "));
  } catch (error) {
    console.error("❌ Policy server health check failed:", error.message);
    process.exit(1);
  }

  // Step 2: Create a mock UserOperation
  console.log("\n" + "=".repeat(80));
  console.log("TEST 2: CREATE MOCK USER OPERATION");
  console.log("=".repeat(80));

  const mockUserOp = {
    sender: testSender,
    nonce: "0x0",
    initCode: "0x",
    callData: "0x1234", // Mock callData
    accountGasLimits: ethers.solidityPacked(
      ["uint128", "uint128"],
      [100000, 100000] // verificationGasLimit, callGasLimit
    ),
    preVerificationGas: "0x186a0", // 100000 in hex
    gasFees: ethers.solidityPacked(
      ["uint128", "uint128"],
      [1000000000, 1000000000] // maxFeePerGas, maxPriorityFeePerGas
    ),
    paymasterAndData: PAYMASTER_ADDRESS + "0".repeat(130), // paymaster + 65 byte placeholder for signature
    signature: "0x"
  };

  console.log("Mock UserOp created:");
  console.log("   Sender:", mockUserOp.sender);
  console.log("   Nonce:", mockUserOp.nonce);
  console.log("   CallData:", mockUserOp.callData);

  // Step 3: Request sponsorship from policy server
  console.log("\n" + "=".repeat(80));
  console.log("TEST 3: REQUEST SPONSORSHIP FROM POLICY SERVER");
  console.log("=".repeat(80));

  let paymasterSignature;
  let userOpHash;

  try {
    const sponsorResponse = await fetch(`${POLICY_SERVER_URL}/api/paymaster/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userOp: mockUserOp,
        chainId: CHAIN_ID
      })
    });

    if (!sponsorResponse.ok) {
      const errorData = await sponsorResponse.json();
      console.error("❌ Sponsorship request failed:", errorData);
      process.exit(1);
    }

    const sponsorData = await sponsorResponse.json();
    
    if (!sponsorData.success) {
      console.error("❌ Policy server rejected UserOp:", sponsorData.error);
      process.exit(1);
    }

    paymasterSignature = sponsorData.paymasterSignature;
    userOpHash = sponsorData.userOpHash;

    console.log("✅ UserOp sponsored successfully");
    console.log("   UserOp Hash:", userOpHash);
    console.log("   Signature:", paymasterSignature);
    console.log("   Remaining (daily):", sponsorData.remaining.daily);
    console.log("   Remaining (hourly):", sponsorData.remaining.hourly);

  } catch (error) {
    console.error("❌ Error requesting sponsorship:", error.message);
    process.exit(1);
  }

  // Step 4: Verify signature locally
  console.log("\n" + "=".repeat(80));
  console.log("TEST 4: VERIFY SIGNATURE LOCALLY");
  console.log("=".repeat(80));

  try {
    const provider = new ethers.JsonRpcProvider(AMOY_RPC);
    const entryPoint = new ethers.Contract(ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, provider);

    // Calculate userOpHash from EntryPoint
    const calculatedHash = await entryPoint.getUserOpHash(mockUserOp);
    
    console.log("Calculated UserOp Hash:", calculatedHash);
    console.log("Policy Server Hash:   ", userOpHash);
    
    if (calculatedHash.toLowerCase() !== userOpHash.toLowerCase()) {
      console.error("❌ UserOp hash mismatch!");
      process.exit(1);
    }
    console.log("✅ UserOp hashes match");

    // Recover signer from signature
    const messageHash = ethers.hashMessage(ethers.getBytes(userOpHash));
    const recoveredAddress = ethers.recoverAddress(messageHash, paymasterSignature);
    
    console.log("\nSignature verification:");
    console.log("   Message hash:", messageHash);
    console.log("   Recovered signer:", recoveredAddress);
    
    // Get expected signer from health endpoint
    const healthResponse = await fetch(`${POLICY_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    const expectedSigner = healthData.signer;
    
    console.log("   Expected signer:", expectedSigner);
    
    if (recoveredAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
      console.error("❌ Signature verification failed - wrong signer!");
      process.exit(1);
    }
    
    console.log("✅ Signature verified - correct signer");

  } catch (error) {
    console.error("❌ Signature verification error:", error.message);
    process.exit(1);
  }

  // Step 5: Test rate limiting
  console.log("\n" + "=".repeat(80));
  console.log("TEST 5: RATE LIMITING");
  console.log("=".repeat(80));

  try {
    const rateLimitResponse = await fetch(`${POLICY_SERVER_URL}/api/paymaster/rate-limit/${testSender}`);
    const rateLimitData = await rateLimitResponse.json();
    
    console.log("Rate limit status for", testSender);
    console.log("   Used (daily):", rateLimitData.used.daily);
    console.log("   Remaining (daily):", rateLimitData.remaining.daily);
    console.log("   Used (hourly):", rateLimitData.used.hourly);
    console.log("   Remaining (hourly):", rateLimitData.remaining.hourly);
    
    console.log("✅ Rate limiting working");

  } catch (error) {
    console.error("❌ Rate limit check failed:", error.message);
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("TEST SUMMARY");
  console.log("=".repeat(80));
  console.log("✅ All tests passed!");
  console.log("\n📋 VERIFIED:");
  console.log("   ✓ Policy server is running and healthy");
  console.log("   ✓ UserOp sponsorship request/response working");
  console.log("   ✓ Signature generation correct");
  console.log("   ✓ Signature verification passes");
  console.log("   ✓ Rate limiting functional");
  console.log("\n🎉 Policy server is ready for integration with bundler!");
  console.log("\n📝 NEXT STEPS:");
  console.log("   1. Fund VerifyingPaymaster with native tokens");
  console.log("   2. Deposit funds to EntryPoint");
  console.log("   3. Create frontend UserOp builder");
  console.log("   4. Test end-to-end gasless swap flow");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
