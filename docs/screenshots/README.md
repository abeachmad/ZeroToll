# Screenshots for User Manual

This folder should contain screenshots for the User Manual (`docs/USER_MANUAL.md`).

## Required Screenshots

Please capture the following screenshots and save them in this folder:

### Setup & Connection
- [ ] `metamask-setup.png` - MetaMask wallet with testnet configured
- [ ] `connect-button.png` - Connect Wallet button in header
- [ ] `wallet-modal.png` - Wallet selection modal
- [ ] `metamask-approve.png` - MetaMask connection approval popup
- [ ] `wallet-connected.png` - Header showing connected wallet address

### Home Page
- [ ] `home-page.png` - Full home page view

### Swap Page
- [ ] `swap-page-overview.png` - Full swap page view
- [ ] `gasless-mode-selector.png` - Gasless mode buttons (Relayer/Pimlico)
- [ ] `pimlico-selected.png` - Pimlico mode selected (green border)
- [ ] `relayer-selected.png` - Relayer mode selected (green border)
- [ ] `token-selection.png` - Token dropdown with indicators
- [ ] `select-gasless-tokens.png` - Selecting zUSDC or other gasless token
- [ ] `amount-input.png` - Amount input field with value
- [ ] `quote-display.png` - Quote result showing expected output
- [ ] `get-quote.png` - Get Quote button
- [ ] `sign-permit.png` - MetaMask permit signature request
- [ ] `sign-intent.png` - MetaMask swap intent signature request
- [ ] `swap-pending.png` - Swap in progress status
- [ ] `swap-success.png` - Successful swap confirmation
- [ ] `traditional-swap.png` - Traditional swap (no gasless mode)
- [ ] `wrong-network-warning.png` - Network mismatch warning banner

### Faucet Page
- [ ] `faucet-page.png` - Full faucet page view
- [ ] `faucet-claim.png` - Claiming tokens from faucet

### Other Pages
- [ ] `pool-page.png` - Pool landing page
- [ ] `pool-dashboard.png` - Pool dashboard
- [ ] `market-page.png` - Market page with prices
- [ ] `history-page.png` - Transaction history page

## Screenshot Guidelines

1. **Resolution:** Use 1920x1080 or similar widescreen resolution
2. **Format:** PNG format preferred
3. **Content:** Make sure wallet is connected and shows realistic data
4. **Privacy:** Blur or use test addresses only
5. **Theme:** Use the default dark theme

## How to Capture

### Windows
- `Win + Shift + S` for Snipping Tool
- Or use browser DevTools (F12) → Device toolbar for consistent sizing

### Mac
- `Cmd + Shift + 4` for selection
- `Cmd + Shift + 3` for full screen

### Linux
- `gnome-screenshot` or `flameshot`

## After Adding Screenshots

Once all screenshots are added, the User Manual will display them automatically.
The markdown image references are already in place:

```markdown
![Home Page](./screenshots/home-page.png)
```
