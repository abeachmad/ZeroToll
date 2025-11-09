const hre = require("hardhat");

/**
 * Analyze burn transactions
 */

const TX1 = "0xd6d73fb8d2db67873de5da2ad82198fed26fbb44a9d9ebaea216655db645319c";
const TX2 = "0x3b807f70208af8ae75a1a3f6df58b219eea7e33dba58bfa8c300b26064957b64";

async function analyzeTx(txHash) {
    console.log(`\n🔍 Analyzing transaction: ${txHash}`);
    console.log("═".repeat(70));
    
    const tx = await hre.ethers.provider.getTransaction(txHash);
    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
    
    if (!tx || !receipt) {
        console.log("❌ Transaction not found");
        return;
    }
    
    console.log("📋 Basic Info:");
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${hre.ethers.formatEther(tx.value)} ETH`);
    console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    
    // Decode method
    if (tx.data && tx.data.length > 10) {
        const methodId = tx.data.slice(0, 10);
        console.log(`\n📝 Method ID: ${methodId}`);
        
        // Common CCTP method signatures
        const methods = {
            "0x6fd3504e": "depositForBurn(uint256,uint32,bytes32,address)",
            "0x557d2e92": "depositForBurnWithCaller(uint256,uint32,bytes32,address,bytes32)",
        };
        
        if (methods[methodId]) {
            console.log(`   Method: ${methods[methodId]}`);
            console.log(`   🔥 This is a CCTP BURN transaction!`);
        }
    }
    
    // Analyze logs
    console.log(`\n📜 Logs (${receipt.logs.length} events):`);
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`   [${i}] Address: ${log.address}`);
        console.log(`       Topics: ${log.topics.length}`);
        
        // Check for Transfer event (topic0 = keccak256("Transfer(address,address,uint256)"))
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
            const from = "0x" + log.topics[1].slice(26);
            const to = "0x" + log.topics[2].slice(26);
            const value = BigInt(log.data);
            
            console.log(`       Event: Transfer`);
            console.log(`       From: ${from}`);
            console.log(`       To: ${to}`);
            console.log(`       Amount: ${hre.ethers.formatUnits(value, 6)} USDC`);
            
            // Check if to address is zero (burn)
            if (to.toLowerCase() === "0x0000000000000000000000000000000000000000") {
                console.log(`       🔥 BURNED to 0x0000...0000`);
            }
        }
        
        // Check for MessageSent event (CCTP)
        if (log.topics[0] === "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036") {
            console.log(`       Event: MessageSent (CCTP)`);
        }
    }
}

async function main() {
    console.log("🔥 ANALYZING CCTP BURN TRANSACTIONS");
    console.log("═".repeat(70));
    
    await analyzeTx(TX1);
    await analyzeTx(TX2);
    
    console.log("\n" + "═".repeat(70));
    console.log("📊 SUMMARY");
    console.log("═".repeat(70));
    console.log("\n❌ CAN BURNED TOKENS BE REVERTED?");
    console.log("\n   NO - Tokens burned via CCTP (Circle's Cross-Chain Transfer Protocol)");
    console.log("   are PERMANENTLY DESTROYED on the source chain.");
    console.log("\n💡 HOW CCTP WORKS:");
    console.log("   1. User calls depositForBurn() on source chain (Sepolia)");
    console.log("   2. USDC is BURNED (sent to 0x0000...0000) ← IRREVERSIBLE!");
    console.log("   3. Attestation service signs the burn event");
    console.log("   4. User submits attestation to destination chain (Amoy)");
    console.log("   5. USDC is MINTED on destination chain");
    console.log("\n⚠️  IF STEP 4-5 FAILED:");
    console.log("   - Tokens are LOST on source chain (already burned)");
    console.log("   - Tokens NOT received on destination chain (mint failed)");
    console.log("   - NO WAY to revert burn on source chain");
    console.log("\n🔧 POSSIBLE RECOVERY (if attestation exists):");
    console.log("   1. Get burn transaction hash");
    console.log("   2. Request attestation from Circle API");
    console.log("   3. Submit attestation to destination chain");
    console.log("   4. Complete the mint on destination chain");
    console.log("\n📞 CONTACT CIRCLE SUPPORT:");
    console.log("   If attestation service failed, only Circle can help.");
    console.log("   Visit: https://www.circle.com/en/cross-chain-transfer-protocol");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
