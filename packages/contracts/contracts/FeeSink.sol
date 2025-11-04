// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FeeSink is Ownable, ReentrancyGuard {
    address public vault;
    address public treasury;
    
    uint256 public vaultFeeBps = 6000;    // 60%
    uint256 public treasuryFeeBps = 4000; // 40%
    
    event FeeDeducted(
        bytes32 indexed intentId,
        address indexed user,
        address token,
        uint256 feeAmount,
        uint256 netToUser
    );
    
    event WrappedFeeDeducted(
        bytes32 indexed intentId,
        address indexed wrappedToken,
        uint256 feeAmount,
        uint256 vaultAmount,
        uint256 treasuryAmount
    );
    
    constructor(address _vault, address _treasury) Ownable(msg.sender) {
        vault = _vault;
        treasury = _treasury;
    }
    
    function deductAndForward(
        bytes32 intentId,
        address user,
        address token,
        uint256 totalAmount,
        uint256 feeAmount
    ) external onlyOwner nonReentrant returns (uint256 netToUser) {
        require(totalAmount >= feeAmount, "Fee exceeds total");
        
        netToUser = totalAmount - feeAmount;
        
        // Split fee
        uint256 vaultFee = (feeAmount * vaultFeeBps) / 10000;
        uint256 treasuryFee = feeAmount - vaultFee;
        
        // Transfer fee portions
        if (vaultFee > 0) {
            require(IERC20(token).transfer(vault, vaultFee), "Vault transfer failed");
        }
        if (treasuryFee > 0) {
            require(IERC20(token).transfer(treasury, treasuryFee), "Treasury transfer failed");
        }
        
        // Transfer net to user
        if (netToUser > 0) {
            require(IERC20(token).transfer(user, netToUser), "User transfer failed");
        }
        
        emit FeeDeducted(intentId, user, token, feeAmount, netToUser);
    }
    
    function deductWrappedAndForward(
        bytes32 intentId,
        address wrappedToken,
        uint256 amountToDeduct
    ) external onlyOwner nonReentrant returns (uint256 vaultAmount, uint256 treasuryAmount) {
        require(amountToDeduct > 0, "Zero deduction");
        
        // Split fee from wrapped token
        vaultAmount = (amountToDeduct * vaultFeeBps) / 10000;
        treasuryAmount = amountToDeduct - vaultAmount;
        
        // Transfer wrapped tokens to vault and treasury
        if (vaultAmount > 0) {
            require(IERC20(wrappedToken).transferFrom(msg.sender, vault, vaultAmount), "Vault transfer failed");
        }
        if (treasuryAmount > 0) {
            require(IERC20(wrappedToken).transferFrom(msg.sender, treasury, treasuryAmount), "Treasury transfer failed");
        }
        
        emit WrappedFeeDeducted(intentId, wrappedToken, amountToDeduct, vaultAmount, treasuryAmount);
    }
    
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
    
    function setFeeSplit(uint256 _vaultFeeBps, uint256 _treasuryFeeBps) external onlyOwner {
        require(_vaultFeeBps + _treasuryFeeBps == 10000, "Must sum to 10000");
        vaultFeeBps = _vaultFeeBps;
        treasuryFeeBps = _treasuryFeeBps;
    }
}
