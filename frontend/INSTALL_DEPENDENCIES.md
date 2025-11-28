# Frontend Dependencies Installation

Due to WSL path issues with npm, please install frontend dependencies manually:

## Option 1: Install from WSL/Linux Terminal

```bash
cd /home/abeachmad/ZeroToll/frontend
npm install @metamask/smart-accounts-kit@latest viem@latest
```

## Option 2: Install from Windows (if WSL fails)

```bash
# Navigate to the frontend folder in Windows
cd C:\path\to\ZeroToll\frontend

# Install dependencies
npm install @metamask/smart-accounts-kit@latest viem@latest
```

## Required Dependencies

- `@metamask/smart-accounts-kit@latest` - MetaMask Smart Accounts Kit for EIP-7702
- `viem@latest` - Ethereum library (must be latest version for EIP-7702 support)

## Verify Installation

After installation, verify the packages are installed:

```bash
npm list @metamask/smart-accounts-kit viem
```

You should see both packages listed with their versions.

## Next Steps

Once dependencies are installed, the EIP-7702 implementation will be ready to use!
