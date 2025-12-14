# ZeroToll User Manual

> **Version:** 1.0  
> **Last Updated:** December 4, 2025

Welcome to ZeroToll - the gasless DEX where you can swap tokens without paying any gas fees!

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Connecting Your Wallet](#2-connecting-your-wallet)
3. [Home Page](#3-home-page)
4. [Swap Page](#4-swap-page)
5. [How to Perform a Gasless Swap](#5-how-to-perform-a-gasless-swap)
6. [Faucet Page](#6-faucet-page)
7. [Pool Page](#7-pool-page)
8. [Market Page](#8-market-page)
9. [History Page](#9-history-page)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting Started

### Prerequisites

Before using ZeroToll, you need:

1. **MetaMask Wallet** - Install from [metamask.io](https://metamask.io)
2. **Testnet Tokens** - Get free test tokens from faucets
3. **Supported Networks** - Ethereum Sepolia or Polygon Amoy testnets

### Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum Sepolia | 11155111 | ETH |
| Polygon Amoy | 80002 | POL |

### Getting Testnet Tokens

- **Sepolia ETH**: [sepoliafaucet.com](https://sepoliafaucet.com)
- **Amoy POL**: [faucet.polygon.technology](https://faucet.polygon.technology)
- **zTokens (for gasless)**: Use the in-app Faucet page

<!-- Screenshot: metamask-setup.png -->
![MetaMask Setup](./screenshots/metamask-setup.png)

---

## 2. Connecting Your Wallet

### Step 1: Click "Connect Wallet"

Look for the **Connect Wallet** button in the top-right corner of any page.

<!-- Screenshot: connect-button.png -->
![Connect Button](./screenshots/connect-button.png)

### Step 2: Select MetaMask

A modal will appear with wallet options. Click **MetaMask**.

<!-- Screenshot: wallet-modal.png -->
![Wallet Selection Modal](./screenshots/wallet-modal.png)

### Step 3: Approve Connection

MetaMask will open and ask you to approve the connection. Click **Connect**.

<!-- Screenshot: metamask-approve.png -->
![MetaMask Approval](./screenshots/metamask-approve.png)

### Step 4: Connected!

Once connected, you'll see your wallet address in the top-right corner.

<!-- Screenshot: wallet-connected.png -->
![Wallet Connected](./screenshots/wallet-connected.png)

---

## 3. Home Page

The Home page provides an overview of ZeroToll's features and quick access to all functionality.

**URL:** `http://localhost:3000/`

<!-- Screenshot: home-page.png -->
![Home Page](./screenshots/home-page.png)

### Features on Home Page

| Element | Description |
|---------|-------------|
| **Hero Section** | Welcome message and main call-to-action |
| **Feature Cards** | Highlights of gasless swaps, multi-chain support |
| **Quick Links** | Buttons to Swap, Pool, and Faucet pages |
| **Navigation** | Access to all pages from the header |

---

## 4. Swap Page

The Swap page is where you perform token swaps - either traditional (you pay gas) or gasless (we pay gas for you).

**URL:** `http://localhost:3000/swap`

<!-- Screenshot: swap-page-overview.png -->
![Swap Page Overview](./screenshots/swap-page-overview.png)

### Swap Page Elements

#### 4.1 Gasless Mode Selector

At the top of the swap form, you'll see two gasless mode options:

| Mode | Description | Who Pays Gas? |
|------|-------------|---------------|
| **None Selected** | Traditional swap | You pay gas |
| **Relayer** | Our backend relayer pays | Relayer pays |
| **Pimlico** | ERC-4337 paymaster | Pimlico pays |

<!-- Screenshot: gasless-mode-selector.png -->
![Gasless Mode Selector](./screenshots/gasless-mode-selector.png)

#### 4.2 Token Selection

- **From Section**: Select source chain and input token
- **To Section**: Select destination chain and output token
- **Swap Button**: Click the ↕️ button to swap input/output

<!-- Screenshot: token-selection.png -->
![Token Selection](./screenshots/token-selection.png)

#### 4.3 Token Indicators

Tokens have indicators showing their gasless compatibility:

| Icon | Meaning | Experience |
|------|---------|------------|
| ⚡ | ERC-2612 Permit | Fully gasless |
| 🔄 | Permit2 | Gasless after approval |
| ⚠️ | Standard | Requires approval tx |
| 🪙 | Native | Cannot use gasless |

#### 4.4 Amount Input

Enter the amount you want to swap in the input field.

<!-- Screenshot: amount-input.png -->
![Amount Input](./screenshots/amount-input.png)

#### 4.5 Quote Display

After entering an amount, click **Get Quote** to see the expected output.

<!-- Screenshot: quote-display.png -->
![Quote Display](./screenshots/quote-display.png)

---

## 5. How to Perform a Gasless Swap

### Method 1: Pimlico Gasless (Recommended)

This method uses Pimlico's ERC-4337 paymaster to sponsor your gas fees.

#### Step 1: Connect Wallet
Make sure your wallet is connected (see Section 2).

#### Step 2: Select Pimlico Mode
Click the **Pimlico** button in the Gasless Mode selector. It will turn green when active.

<!-- Screenshot: pimlico-selected.png -->
![Pimlico Mode Selected](./screenshots/pimlico-selected.png)

#### Step 3: Select Tokens
- Choose your source chain (Sepolia or Amoy)
- Select an input token with ⚡ indicator (e.g., zUSDC, zETH)
- Select an output token

**Best tokens for gasless:**
- zUSDC ⚡
- zETH ⚡
- zPOL ⚡
- zLINK ⚡

<!-- Screenshot: select-gasless-tokens.png -->
![Select Gasless Tokens](./screenshots/select-gasless-tokens.png)

#### Step 4: Enter Amount
Type the amount you want to swap.

#### Step 5: Get Quote
Click **Get Quote** to see the expected output amount.

<!-- Screenshot: get-quote.png -->
![Get Quote](./screenshots/get-quote.png)

#### Step 6: Execute Swap
Click **Execute Swap**. MetaMask will open asking you to sign TWO messages:

1. **Permit Signature** - Authorizes token transfer (NO GAS)
2. **Swap Intent Signature** - Authorizes the swap (NO GAS)

<!-- Screenshot: sign-permit.png -->
![Sign Permit](./screenshots/sign-permit.png)

<!-- Screenshot: sign-intent.png -->
![Sign Intent](./screenshots/sign-intent.png)

#### Step 7: Wait for Confirmation
The swap will be submitted to the blockchain. Wait for confirmation.

<!-- Screenshot: swap-pending.png -->
![Swap Pending](./screenshots/swap-pending.png)

#### Step 8: Success!
Once confirmed, you'll see a success message with the transaction hash.

<!-- Screenshot: swap-success.png -->
![Swap Success](./screenshots/swap-success.png)

---

### Method 2: Relayer Gasless

This method uses our backend relayer to pay gas from its own wallet.

#### Steps:
1. Click **Relayer** button instead of Pimlico
2. Follow the same steps as Pimlico mode
3. Sign the permit and intent messages
4. Our relayer submits the transaction and pays gas

<!-- Screenshot: relayer-selected.png -->
![Relayer Mode Selected](./screenshots/relayer-selected.png)

---

### Method 3: Traditional Swap (You Pay Gas)

If you don't select any gasless mode, you'll perform a traditional swap.

#### Steps:
1. Leave both Relayer and Pimlico unselected
2. Select tokens and enter amount
3. Click **Get Quote**
4. If needed, click **Approve** first (one-time per token)
5. Click **Execute Swap**
6. Confirm the transaction in MetaMask (you pay gas)

<!-- Screenshot: traditional-swap.png -->
![Traditional Swap](./screenshots/traditional-swap.png)

---

## 6. Faucet Page

The Faucet page lets you claim free zTokens for testing gasless swaps.

**URL:** `http://localhost:3000/faucet`

<!-- Screenshot: faucet-page.png -->
![Faucet Page](./screenshots/faucet-page.png)

### Available Tokens

| Token | Amount per Claim | Network |
|-------|------------------|---------|
| zUSDC | 1000 | Sepolia & Amoy |
| zETH | 1000 | Sepolia & Amoy |
| zPOL | 1000 | Sepolia & Amoy |
| zLINK | 1000 | Sepolia & Amoy |

### How to Claim

1. Connect your wallet
2. Select the network (Sepolia or Amoy)
3. Click **Claim** next to the token you want
4. Confirm the transaction in MetaMask
5. Wait for confirmation

> **Note:** Claiming from the faucet requires a small amount of native token (ETH/POL) for gas.

<!-- Screenshot: faucet-claim.png -->
![Faucet Claim](./screenshots/faucet-claim.png)

---

## 7. Pool Page

The Pool page shows information about liquidity pools (coming soon).

**URL:** `http://localhost:3000/pool`

<!-- Screenshot: pool-page.png -->
![Pool Page](./screenshots/pool-page.png)

### Pool Dashboard

Access the full pool dashboard at `http://localhost:3000/pool/dashboard`

<!-- Screenshot: pool-dashboard.png -->
![Pool Dashboard](./screenshots/pool-dashboard.png)

---

## 8. Market Page

The Market page displays token prices and market data.

**URL:** `http://localhost:3000/market`

<!-- Screenshot: market-page.png -->
![Market Page](./screenshots/market-page.png)

### Features

- Real-time token prices from Pyth Oracle
- Price charts
- 24h volume and change

---

## 9. History Page

The History page shows your past transactions.

**URL:** `http://localhost:3000/history`

<!-- Screenshot: history-page.png -->
![History Page](./screenshots/history-page.png)

### Transaction Details

Each transaction shows:
- Date and time
- Token pair (e.g., zUSDC → zPOL)
- Amount swapped
- Transaction hash (click to view on explorer)
- Status (Success/Failed/Pending)

---

## 10. Troubleshooting

### Common Issues

#### "Wallet not connected"
**Solution:** Click the Connect Wallet button and approve the connection in MetaMask.

#### "Wrong network"
**Solution:** Switch to Sepolia or Amoy in MetaMask. The app will show a warning banner if you're on the wrong network.

<!-- Screenshot: wrong-network-warning.png -->
![Wrong Network Warning](./screenshots/wrong-network-warning.png)

#### "Token doesn't support gasless"
**Solution:** Use zTokens (zUSDC, zETH, zPOL, zLINK) which have the ⚡ indicator. Get them from the Faucet page.

#### "Insufficient balance"
**Solution:** Make sure you have enough tokens. Use the Faucet to get free zTokens.

#### "Transaction failed"
**Solution:** 
1. Check if you have enough tokens
2. Try increasing slippage tolerance
3. Make sure the relayer is running (for gasless mode)

#### "Slippage exceeded"
**Solution:** The price moved too much during the swap. Try again or increase slippage tolerance.

#### "execution reverted" in explorer
**Note:** This is normal for ERC-4337 transactions! If your tokens were transferred correctly, the swap succeeded. The "execution reverted" refers to the EntryPoint's internal accounting, not your swap.

---

## Quick Reference

### Gasless Swap Checklist

- [ ] Wallet connected
- [ ] On correct network (Sepolia or Amoy)
- [ ] Gasless mode selected (Relayer or Pimlico)
- [ ] Using gasless-compatible token (⚡ or 🔄)
- [ ] Have sufficient token balance
- [ ] Quote received

### Token Addresses

#### Sepolia
| Token | Address |
|-------|---------|
| zUSDC | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` |
| zETH | `0x8153FA09Be1689D44C343f119C829F6702A8720b` |
| zPOL | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` |
| zLINK | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` |

#### Amoy
| Token | Address |
|-------|---------|
| zUSDC | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` |
| zETH | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` |
| zPOL | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` |
| zLINK | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` |

---

## Need Help?

- **Documentation:** Check the `/docs` folder for technical details
- **GitHub Issues:** Report bugs or request features
- **Contract Addresses:** See `docs/CURRENT_CONTRACTS.md`

---

*Happy Swapping! 🚀*
