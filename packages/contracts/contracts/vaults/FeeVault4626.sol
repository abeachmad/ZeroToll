// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeVault4626
 * @notice ERC-4626 compliant vault for protocol fee distribution
 * @dev LPs deposit stablecoins (USDC) and receive yield from ZeroToll protocol fees
 * 
 * Architecture:
 * - FeeRebalancer converts collected fees (various tokens) → USDC
 * - USDC deposited to this vault increases share value
 * - LPs earn yield proportional to their vault shares
 * - Fee split: 60% to LPs (via vault), 40% to treasury
 */
contract FeeVault4626 is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Deposit asset (e.g., USDC on each chain)
    IERC20 private immutable _asset;

    // Fee collector (FeeRebalancer contract)
    address public feeCollector;

    // Treasury address (receives 40% of fees)
    address public treasury;

    // Fee split (in basis points, 10000 = 100%)
    uint256 public constant LP_FEE_SHARE_BPS = 6000; // 60% to LPs
    uint256 public constant TREASURY_FEE_SHARE_BPS = 4000; // 40% to treasury

    // Minimum deposit to prevent dust attacks
    uint256 public minDeposit = 1e6; // 1 USDC (assuming 6 decimals)

    // Total fees collected (for APR calculation)
    uint256 public totalFeesCollected;

    // Timestamp of vault creation (for APR calculation)
    uint256 public immutable vaultCreationTime;

    // Events
    event FeeDeposited(uint256 lpShare, uint256 treasuryShare, uint256 timestamp);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event MinDepositUpdated(uint256 oldMinDeposit, uint256 newMinDeposit);

    /**
     * @param asset_ Address of deposit asset (USDC)
     * @param name_ Name of vault token (e.g., "ZeroToll Vault USDC")
     * @param symbol_ Symbol of vault token (e.g., "ztUSDC")
     * @param treasury_ Treasury address
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address treasury_
    ) ERC20(name_, symbol_) ERC4626(asset_) Ownable(msg.sender) {
        require(address(asset_) != address(0), "Invalid asset");
        require(treasury_ != address(0), "Invalid treasury");

        _asset = asset_;
        treasury = treasury_;
        vaultCreationTime = block.timestamp;
    }

    /**
     * @notice Deposit protocol fees (called by FeeRebalancer)
     * @param amount Amount of USDC fees to deposit
     */
    function depositFees(uint256 amount) external nonReentrant {
        require(msg.sender == feeCollector, "Only fee collector");
        require(amount > 0, "Amount must be > 0");

        // Calculate split
        uint256 lpShare = (amount * LP_FEE_SHARE_BPS) / 10000;
        uint256 treasuryShare = amount - lpShare;

        // Transfer from fee collector
        _asset.safeTransferFrom(msg.sender, address(this), lpShare);
        _asset.safeTransferFrom(msg.sender, treasury, treasuryShare);

        // Update total fees
        totalFeesCollected += amount;

        emit FeeDeposited(lpShare, treasuryShare, block.timestamp);
    }

    /**
     * @notice Calculate current APR based on fees collected
     * @dev APR = (totalFeesCollected / totalAssets) / timeElapsed * 365 days
     * @return apr Annual Percentage Rate in basis points (10000 = 100%)
     */
    function currentAPR() external view returns (uint256 apr) {
        uint256 totalAsset = totalAssets();
        if (totalAsset == 0 || totalFeesCollected == 0) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - vaultCreationTime;
        if (timeElapsed == 0) {
            return 0;
        }

        // APR = (fees / assets) * (365 days / timeElapsed) * 10000
        apr = (totalFeesCollected * 365 days * 10000) / (totalAsset * timeElapsed);
        return apr;
    }

    /**
     * @notice Get vault metrics for frontend display
     * @return tvl Total Value Locked in vault
     * @return apr Current APR in basis points
     * @return totalShares Total vault shares outstanding
     * @return sharePrice Price of 1 vault share in asset terms
     */
    function getVaultMetrics()
        external
        view
        returns (
            uint256 tvl,
            uint256 apr,
            uint256 totalShares,
            uint256 sharePrice
        )
    {
        tvl = totalAssets();
        apr = this.currentAPR();
        totalShares = totalSupply();
        sharePrice = totalShares > 0 ? convertToAssets(1e18) : 1e18; // 1e18 = 1 share
    }

    /**
     * @notice Override deposit to enforce minimum
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        require(assets >= minDeposit, "Below minimum deposit");
        return super.deposit(assets, receiver);
    }

    /**
     * @notice Override mint to enforce minimum
     */
    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        assets = super.mint(shares, receiver);
        require(assets >= minDeposit, "Below minimum deposit");
        return assets;
    }

    /**
     * @notice Override withdraw with reentrancy guard
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 shares) {
        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @notice Override redeem with reentrancy guard
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 assets) {
        return super.redeem(shares, receiver, owner);
    }

    /**
     * @notice Update fee collector address
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid collector");
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /**
     * @notice Update minimum deposit amount
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        emit MinDepositUpdated(minDeposit, newMinDeposit);
        minDeposit = newMinDeposit;
    }

    /**
     * @notice Emergency withdraw (only owner, for migration/bugs)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        _asset.safeTransfer(owner(), amount);
    }
}
