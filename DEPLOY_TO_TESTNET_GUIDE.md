# Deploy RelayerRegistry to Testnet

**Date**: 2026-03-01  
**Status**: Ready to Deploy  
**Tests**: 25/25 passing ✅

---

## 📋 Pre-Deployment Checklist

### 1. Check Environment Variables

```bash
cd ~/ZeroToll/packages/contracts

# Check if .env exists
ls .env

# If not exists, create it
nano .env
```

Required variables:
```env
# Deployer private key (without 0x prefix)
PRIVATE_KEY_DEPLOYER=your_private_key_here

# RPC URLs (optional, will use public RPCs if not set)
RPC_AMOY=https://rpc-amoy.polygon.technology/
RPC_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com

# Block explorer API keys (for verification)
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 2. Get Testnet Tokens

**Amoy (Polygon Testnet)**:
- Faucet: https://faucet.polygon.technology/
- Required: ~0.1 POL for deployment
- Network: Polygon Amoy
- Chain ID: 80002

**Sepolia (Ethereum Testnet)**:
- Faucet: https://sepoliafaucet.com/
- Alternative: https://www.alchemy.com/faucets/ethereum-sepolia
- Required: ~0.01 ETH for deployment
- Network: Ethereum Sepolia
- Chain ID: 11155111

### 3. Check Deployer Balance

```bash
# Check balance on Amoy
npx hardhat console --network amoy
> const [deployer] = await ethers.getSigners()
> const balance = await ethers.provider.getBalance(deployer.address)
> console.log("Balance:", ethers.formatEther(balance), "POL")
> .exit

# Check balance on Sepolia
npx hardhat console --network sepolia
> const [deployer] = await ethers.getSigners()
> const balance = await ethers.provider.getBalance(deployer.address)
> console.log("Balance:", ethers.formatEther(balance), "ETH")
> .exit
```

---

## 🚀 Deployment Steps

### Step 1: Deploy to Amoy Testnet

```bash
cd ~/ZeroToll/packages/contracts

# Deploy RelayerRegistry to Amoy
npx hardhat run scripts/deploy-relayer-registry.js --network amoy
```

**Expected Output**:
```
=== Deploying RelayerRegistry ===
Network: amoy
Chain ID: 80002
Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Balance: 1.5 POL

Configuration:
Executor: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Min Stake: 10 ETH/POL
Max Relayers: 100
Slash Percentage: 10%

Deploying RelayerRegistry...
✅ RelayerRegistry deployed to: 0x...

Contract Configuration:
Min Stake: 10.0 POL
Max Relayers: 100
Slash Percentage: 10%
Owner: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Executor: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

✅ Deployment info saved to: relayer-registry-amoy-1234567890.json

Waiting for block confirmations...
Verifying contract on block explorer...
✅ Contract verified

=== Deployment Summary ===
RelayerRegistry: 0x...
Network: amoy
Chain ID: 80002

=== Next Steps ===
1. Update backend relayer with registry address
2. Register first relayer
3. Update executor address if needed
4. Monitor relayer registrations

✅ Deployment complete!
```

**Save the contract address!** You'll need it for the next steps.

---

### Step 2: Deploy to Sepolia Testnet

```bash
# Deploy RelayerRegistry to Sepolia
npx hardhat run scripts/deploy-relayer-registry.js --network sepolia
```

**Expected Output**: Similar to Amoy deployment

**Save the contract address!**

---

### Step 3: Verify Deployments

**Amoy (PolygonScan)**:
- Explorer: https://amoy.polygonscan.com/
- Search for your contract address
- Check: Contract is verified ✅
- Check: Source code is visible ✅

**Sepolia (Etherscan)**:
- Explorer: https://sepolia.etherscan.io/
- Search for your contract address
- Check: Contract is verified ✅
- Check: Source code is visible ✅

---

## 🧪 Post-Deployment Testing

### Test 1: Register First Relayer (Amoy)

```bash
# Connect to Amoy
npx hardhat console --network amoy
```

In console:
```javascript
// Get contract instance
const registryAddress = "0x_YOUR_DEPLOYED_ADDRESS";
const registry = await ethers.getContractAt("RelayerRegistry", registryAddress);

// Check initial state
await registry.getRelayerCount();
// Should return: 0n

// Register as relayer (stake 10 POL)
const tx = await registry.registerRelayer({ value: ethers.parseEther("10") });
await tx.wait();
console.log("Registered!");

// Check relayer count
await registry.getRelayerCount();
// Should return: 1n

// Check if active
const [deployer] = await ethers.getSigners();
await registry.isRelayerActive(deployer.address);
// Should return: true

// Get relayer info
const info = await registry.getRelayerInfo(deployer.address);
console.log("Stake:", ethers.formatEther(info.stake), "POL");
console.log("Reputation:", info.reputation.toString());
console.log("Active:", info.active);

// Get active relayers
const activeRelayers = await registry.getActiveRelayers();
console.log("Active relayers:", activeRelayers);

// Exit
.exit
```

### Test 2: Register First Relayer (Sepolia)

Same steps as Amoy, but use `--network sepolia`

---

## 📝 Save Deployment Info

Create deployment summary file:

```bash
nano DEPLOYMENT_ADDRESSES.md
```

Content:
```markdown
# RelayerRegistry Deployment Addresses

**Date**: 2026-03-01  
**Deployer**: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

## Amoy (Polygon Testnet)

- **Network**: Polygon Amoy
- **Chain ID**: 80002
- **RelayerRegistry**: 0x_YOUR_AMOY_ADDRESS
- **Explorer**: https://amoy.polygonscan.com/address/0x_YOUR_AMOY_ADDRESS
- **Verified**: ✅ Yes
- **Executor**: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- **Min Stake**: 10 POL
- **Registered Relayers**: 1

## Sepolia (Ethereum Testnet)

- **Network**: Ethereum Sepolia
- **Chain ID**: 11155111
- **RelayerRegistry**: 0x_YOUR_SEPOLIA_ADDRESS
- **Explorer**: https://sepolia.etherscan.io/address/0x_YOUR_SEPOLIA_ADDRESS
- **Verified**: ✅ Yes
- **Executor**: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- **Min Stake**: 10 ETH
- **Registered Relayers**: 1

## Configuration

- **Max Relayers**: 100
- **Slash Percentage**: 10%
- **Min Reputation**: 500
```

---

## 🔄 Update Configuration Files

### 1. Update Backend Config

```bash
nano backend/config/contracts.json
```

Add:
```json
{
  "relayerRegistry": {
    "80002": "0x_YOUR_AMOY_ADDRESS",
    "11155111": "0x_YOUR_SEPOLIA_ADDRESS"
  }
}
```

### 2. Update Frontend Config

```bash
nano frontend/src/config/contracts.json
```

Add RelayerRegistry addresses to existing config.

---

## 🐛 Troubleshooting

### Error: "Insufficient funds"

**Solution**: Get more testnet tokens from faucets

### Error: "ENOENT: no such file or directory, open '.env'"

**Solution**: Create `.env` file with required variables

### Error: "Invalid API Key"

**Solution**: Get API keys from:
- PolygonScan: https://polygonscan.com/myapikey
- Etherscan: https://etherscan.io/myapikey

### Error: "Verification failed"

**Solution**: Verify manually:
```bash
npx hardhat verify --network amoy 0x_CONTRACT_ADDRESS "0x_EXECUTOR_ADDRESS"
```

### Error: "Transaction underpriced"

**Solution**: Increase gas price in hardhat.config.js or wait and retry

---

## ✅ Deployment Checklist

- [ ] Environment variables configured
- [ ] Testnet tokens obtained (Amoy + Sepolia)
- [ ] Deployed to Amoy testnet
- [ ] Deployed to Sepolia testnet
- [ ] Contracts verified on block explorers
- [ ] First relayer registered on Amoy
- [ ] First relayer registered on Sepolia
- [ ] Deployment addresses saved
- [ ] Backend config updated
- [ ] Frontend config updated
- [ ] Documentation updated

---

## 🎯 Success Criteria

✅ RelayerRegistry deployed to both networks  
✅ Contracts verified on block explorers  
✅ At least 1 relayer registered on each network  
✅ All configuration files updated  
✅ Deployment addresses documented  

---

## 📊 Deployment Costs

**Estimated Gas Costs**:
- Amoy: ~0.05 POL (deployment + verification)
- Sepolia: ~0.005 ETH (deployment + verification)

**Actual costs will vary based on network congestion**

---

## 🚀 Next Steps After Deployment

1. **Week 6**: Implement reputation & reward system
2. **Week 7**: Add slashing mechanism
3. **Week 8**: Integrate with backend relayer
4. **Week 9-12**: Threshold encryption
5. **Week 13-16**: Onboard 10+ independent relayers

---

**Status**: Ready to deploy  
**Confidence**: 🔥 High (all tests passing)

🚀 **Let's deploy!**
