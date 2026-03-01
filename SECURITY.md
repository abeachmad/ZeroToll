# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Features

### Smart Contracts
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Access control with Ownable pattern
- ✅ Checks-Effects-Interactions pattern
- ✅ Input validation and overflow protection
- ✅ Gas limits on external calls
- ✅ Approval reset after adapter calls

### Backend API
- ✅ Input validation with Pydantic
- ✅ CORS with specific origins (no wildcards)
- ✅ Trusted Host middleware
- ✅ Address format validation
- ✅ Chain ID whitelist
- ✅ Amount bounds checking

### Frontend
- ✅ Input sanitization
- ✅ No dangerouslySetInnerHTML usage
- ✅ Amount bounds validation
- ✅ Environment variable isolation

## Reporting a Vulnerability

If you discover a security vulnerability, please email: security@zerotoll.io

**Please do not open public issues for security vulnerabilities.**

### What to include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### Response Time:
- Initial response: Within 48 hours
- Status update: Within 7 days
- Fix timeline: Depends on severity

## Security Best Practices

### For Developers
1. Never commit `.env` files
2. Use `.env.example` as template
3. Rotate private keys regularly
4. Test on testnet before mainnet
5. Run security audits before production

### For Users
1. Verify contract addresses
2. Check transaction details before signing
3. Use hardware wallets for large amounts
4. Monitor transaction history
5. Report suspicious activity

## Known Limitations

### Testnet Only (Wave-2)
- Mock oracles (not production-ready)
- Mock bridge adapter
- Limited to Amoy and Sepolia testnets
- No formal audit completed yet

### Production Readiness Checklist
- [ ] Professional security audit
- [ ] Mainnet oracle integration
- [ ] Real bridge adapter (Polygon Portal)
- [ ] Rate limiting implementation
- [ ] Monitoring and alerting
- [ ] Bug bounty program
- [ ] Insurance coverage

## Dependencies

### Regular Updates
- Smart contracts: OpenZeppelin ^5.0.2
- Backend: FastAPI, Motor (async MongoDB)
- Frontend: React 19, Radix UI

Run `npm audit` and `pip-audit` regularly to check for vulnerabilities.

## Contact

- Security: security@zerotoll.io
- General: hello@zerotoll.io
- Twitter: @ZeroTollDeFi
