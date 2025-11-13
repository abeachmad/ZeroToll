# 🚀 ZeroToll - Quick Reference

## Services

```bash
# Start all services
./start-services.sh

# Check status
curl http://localhost:3002/health
curl -X POST http://localhost:3000/rpc -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}'
```

## Key Addresses

### Amoy (Polygon Testnet)
- **VerifyingPaymaster:** `0xC721582d25895956491436459df34cd817C6AB74`
- **RouterHub:** `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881`
- **Smart Account:** `0x5a87a3c738cf99db95787d51b627217b6de12f62`

### Sepolia (Ethereum Testnet)
- **VerifyingPaymaster:** `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9`
- **RouterHub:** `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84`
- **Smart Account:** `0x5a87a3c738cf99db95787d51b627217b6de12f62`

### Common
- **EntryPoint v0.7:** `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- **Policy Signer:** `0x84d44b412CeA92064B5441fB7CfC354Ec1750eb2`

## Test Commands

```bash
cd packages/contracts

# Test policy server
node scripts/test-policy-server.js

# Test end-to-end
node scripts/test-e2e-integration.js

# Test real swap (needs Odos API)
node scripts/test-real-swap.js
```

## Status

✅ **Phase 1:** RouterHub with fee collection  
✅ **Phase 2:** Bundler infrastructure  
✅ **Phase 3:** VerifyingPaymaster + Policy Server  
⏳ **Phase 4:** Frontend integration

**All infrastructure operational and ready!** 🎉
