// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FeeEscrow is Ownable, ReentrancyGuard {
    mapping(bytes32 => mapping(address => uint256)) public deposits;  // intentId => token => amount
    
    event Deposited(bytes32 indexed intentId, address indexed user, address token, uint256 amount);
    event Released(bytes32 indexed intentId, address indexed to, address token, uint256 amount);
    event Refunded(bytes32 indexed intentId, address indexed to, address token, uint256 amount);
    
    constructor() Ownable(msg.sender) {}
    
    function depositFromUserPermit2(
        bytes32 intentId,
        address user,
        address token,
        uint256 amount,
        bytes calldata permitData
    ) external onlyOwner nonReentrant {
        // For Permit2, would call Permit2 contract here
        // For Wave-2, using EIP-2612 fallback
        
        if (permitData.length > 0) {
            (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = 
                abi.decode(permitData, (uint8, bytes32, bytes32, uint256));
            
            IERC20Permit(token).permit(
                user,
                address(this),
                amount,
                deadline,
                v, r, s
            );
        }
        
        require(
            IERC20(token).transferFrom(user, address(this), amount),
            "Transfer failed"
        );
        
        deposits[intentId][token] += amount;
        emit Deposited(intentId, user, token, amount);
    }
    
    function release(
        bytes32 intentId,
        address to,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(deposits[intentId][token] >= amount, "Insufficient deposit");
        
        deposits[intentId][token] -= amount;
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        
        emit Released(intentId, to, token, amount);
    }
    
    function refund(
        bytes32 intentId,
        address to,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(deposits[intentId][token] >= amount, "Insufficient deposit");
        
        deposits[intentId][token] -= amount;
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        
        emit Refunded(intentId, to, token, amount);
    }
    
    function getDeposit(bytes32 intentId, address token) external view returns (uint256) {
        return deposits[intentId][token];
    }
}
