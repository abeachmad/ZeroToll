// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZeroTollTreasury
 * @notice Collects fees from gasless swaps for LP rewards distribution
 * @dev Phase 2B: Fee collection. Phase 3: LP reward distribution
 * 
 * Fee Flow:
 *   User Swap → Router deducts fee → Treasury collects → LP Rewards (Phase 3)
 */
contract ZeroTollTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // State Variables
    // ============================================
    
    /// @notice Accumulated fees per token
    mapping(address => uint256) public collectedFees;
    
    /// @notice Authorized fee collectors (routers)
    mapping(address => bool) public authorizedCollectors;
    
    /// @notice Total fees collected in USD (for stats, updated off-chain)
    uint256 public totalFeesUSD;
    
    /// @notice Fee distribution ratios (basis points, total = 10000)
    uint256 public lpRewardsBps = 8000;      // 80% to LP rewards
    uint256 public operationsBps = 1500;     // 15% to operations
    uint256 public reserveBps = 500;         // 5% to reserve
    
    /// @notice Recipient addresses for fee distribution
    address public lpRewardsRecipient;
    address public operationsRecipient;
    address public reserveRecipient;

    // ============================================
    // Events
    // ============================================
    
    event FeeCollected(
        address indexed token, 
        uint256 amount, 
        address indexed from,
        uint256 timestamp
    );
    
    event FeeWithdrawn(
        address indexed token, 
        uint256 amount, 
        address indexed to
    );
    
    event CollectorAuthorized(address indexed collector, bool authorized);
    
    event DistributionRatiosUpdated(
        uint256 lpRewardsBps, 
        uint256 operationsBps, 
        uint256 reserveBps
    );
    
    event RecipientsUpdated(
        address lpRewards, 
        address operations, 
        address reserve
    );
    
    event FeesDistributed(
        address indexed token,
        uint256 lpAmount,
        uint256 opsAmount,
        uint256 reserveAmount
    );

    // ============================================
    // Constructor
    // ============================================
    
    constructor() Ownable(msg.sender) {
        // Default: owner receives all distributions until configured
        lpRewardsRecipient = msg.sender;
        operationsRecipient = msg.sender;
        reserveRecipient = msg.sender;
    }

    // ============================================
    // Fee Collection (called by Router)
    // ============================================
    
    /**
     * @notice Collect fee from a swap (called by authorized router)
     * @param token The token being collected as fee
     * @param amount The fee amount
     * @param from The user who paid the fee (for logging)
     */
    function collectFee(
        address token, 
        uint256 amount, 
        address from
    ) external nonReentrant {
        require(authorizedCollectors[msg.sender], "Not authorized collector");
        require(amount > 0, "Zero amount");
        
        // Transfer fee from router to treasury
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Track accumulated fees
        collectedFees[token] += amount;
        
        emit FeeCollected(token, amount, from, block.timestamp);
    }
    
    /**
     * @notice Direct deposit (for manual fee collection or testing)
     * @param token The token to deposit
     * @param amount The amount to deposit
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        collectedFees[token] += amount;
        emit FeeCollected(token, amount, msg.sender, block.timestamp);
    }

    // ============================================
    // Fee Distribution (Phase 3 preparation)
    // ============================================
    
    /**
     * @notice Distribute collected fees according to ratios
     * @param token The token to distribute
     */
    function distributeFees(address token) external onlyOwner nonReentrant {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to distribute");
        
        uint256 lpAmount = (balance * lpRewardsBps) / 10000;
        uint256 opsAmount = (balance * operationsBps) / 10000;
        uint256 reserveAmount = balance - lpAmount - opsAmount; // Remainder to reserve
        
        if (lpAmount > 0 && lpRewardsRecipient != address(0)) {
            IERC20(token).safeTransfer(lpRewardsRecipient, lpAmount);
        }
        
        if (opsAmount > 0 && operationsRecipient != address(0)) {
            IERC20(token).safeTransfer(operationsRecipient, opsAmount);
        }
        
        if (reserveAmount > 0 && reserveRecipient != address(0)) {
            IERC20(token).safeTransfer(reserveRecipient, reserveAmount);
        }
        
        // Reset tracked fees for this token
        collectedFees[token] = 0;
        
        emit FeesDistributed(token, lpAmount, opsAmount, reserveAmount);
    }

    // ============================================
    // Admin Functions
    // ============================================
    
    /**
     * @notice Authorize or revoke a fee collector (router)
     * @param collector The address to authorize/revoke
     * @param authorized Whether to authorize or revoke
     */
    function setCollector(address collector, bool authorized) external onlyOwner {
        require(collector != address(0), "Invalid collector");
        authorizedCollectors[collector] = authorized;
        emit CollectorAuthorized(collector, authorized);
    }
    
    /**
     * @notice Update fee distribution ratios
     * @param _lpRewardsBps LP rewards percentage (basis points)
     * @param _operationsBps Operations percentage (basis points)
     * @param _reserveBps Reserve percentage (basis points)
     */
    function setDistributionRatios(
        uint256 _lpRewardsBps,
        uint256 _operationsBps,
        uint256 _reserveBps
    ) external onlyOwner {
        require(_lpRewardsBps + _operationsBps + _reserveBps == 10000, "Must total 100%");
        
        lpRewardsBps = _lpRewardsBps;
        operationsBps = _operationsBps;
        reserveBps = _reserveBps;
        
        emit DistributionRatiosUpdated(_lpRewardsBps, _operationsBps, _reserveBps);
    }
    
    /**
     * @notice Update distribution recipients
     * @param _lpRewards LP rewards recipient (PaymasterVault in Phase 3)
     * @param _operations Operations wallet
     * @param _reserve Reserve wallet
     */
    function setRecipients(
        address _lpRewards,
        address _operations,
        address _reserve
    ) external onlyOwner {
        lpRewardsRecipient = _lpRewards;
        operationsRecipient = _operations;
        reserveRecipient = _reserve;
        
        emit RecipientsUpdated(_lpRewards, _operations, _reserve);
    }
    
    /**
     * @notice Emergency withdraw (owner only)
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     * @param to The recipient address
     */
    function emergencyWithdraw(
        address token, 
        uint256 amount, 
        address to
    ) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
        
        // Update tracked fees
        if (collectedFees[token] >= amount) {
            collectedFees[token] -= amount;
        } else {
            collectedFees[token] = 0;
        }
        
        emit FeeWithdrawn(token, amount, to);
    }
    
    /**
     * @notice Update total USD fees (called off-chain for stats)
     * @param _totalUSD The total fees in USD
     */
    function updateTotalFeesUSD(uint256 _totalUSD) external onlyOwner {
        totalFeesUSD = _totalUSD;
    }

    // ============================================
    // View Functions
    // ============================================
    
    /**
     * @notice Get current balance of a token in treasury
     * @param token The token address
     * @return The balance
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @notice Get accumulated fees for a token
     * @param token The token address
     * @return The accumulated fee amount
     */
    function getCollectedFees(address token) external view returns (uint256) {
        return collectedFees[token];
    }
    
    /**
     * @notice Check if an address is an authorized collector
     * @param collector The address to check
     * @return Whether the address is authorized
     */
    function isAuthorizedCollector(address collector) external view returns (bool) {
        return authorizedCollectors[collector];
    }
    
    /**
     * @notice Get distribution ratios
     * @return lpBps LP rewards basis points
     * @return opsBps Operations basis points
     * @return resBps Reserve basis points
     */
    function getDistributionRatios() external view returns (
        uint256 lpBps,
        uint256 opsBps,
        uint256 resBps
    ) {
        return (lpRewardsBps, operationsBps, reserveBps);
    }
}
