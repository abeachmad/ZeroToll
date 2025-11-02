// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VaultStableFloat is Ownable, ReentrancyGuard {
    IERC20 public immutable stableToken;
    
    uint256 public totalShares;
    mapping(address => uint256) public balanceOf;
    
    uint256 public feesAccrued;
    uint256 public lpFeeBps = 6000; // 60%
    uint256 public relayerFeeBps = 3000; // 30%
    uint256 public treasuryFeeBps = 1000; // 10%
    
    address public treasury;
    
    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 amount);
    event FeesAccrued(uint256 amount);
    event FeesDistributed(uint256 lpAmount, uint256 relayerAmount, uint256 treasuryAmount);
    
    constructor(IERC20 _stableToken, address _treasury) Ownable(msg.sender) {
        stableToken = _stableToken;
        treasury = _treasury;
    }
    
    function totalAssets() public view returns (uint256) {
        return stableToken.balanceOf(address(this)) - feesAccrued;
    }
    
    function deposit(uint256 amount) external nonReentrant returns (uint256 shares) {
        require(amount > 0, "Zero amount");
        
        uint256 _totalAssets = totalAssets();
        shares = totalShares == 0 ? amount : (amount * totalShares) / _totalAssets;
        require(shares > 0, "Invalid shares");
        
        // Effects before interactions
        balanceOf[msg.sender] += shares;
        totalShares += shares;
        
        // Interactions last
        require(stableToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        emit Deposit(msg.sender, amount, shares);
    }
    
    function withdraw(uint256 shares) external nonReentrant returns (uint256 amount) {
        require(shares > 0 && shares <= balanceOf[msg.sender], "Invalid shares");
        
        amount = (shares * totalAssets()) / totalShares;
        require(amount > 0, "Invalid amount");
        
        // Effects before interactions
        balanceOf[msg.sender] -= shares;
        totalShares -= shares;
        
        // Interactions last
        require(stableToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Withdraw(msg.sender, shares, amount);
    }
    
    function accrueFees(uint256 amount) external onlyOwner {
        feesAccrued += amount;
        emit FeesAccrued(amount);
    }
    
    function claimFees() external onlyOwner {
        uint256 fees = feesAccrued;
        require(fees > 0, "No fees");
        
        feesAccrued = 0;
        
        uint256 lpAmount = (fees * lpFeeBps) / 10000;
        uint256 relayerAmount = (fees * relayerFeeBps) / 10000;
        uint256 treasuryAmount = fees - lpAmount - relayerAmount;
        
        // LP amount stays in vault (increases totalAssets)
        require(stableToken.transfer(treasury, treasuryAmount + relayerAmount), "Transfer failed");
        
        emit FeesDistributed(lpAmount, relayerAmount, treasuryAmount);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
}
