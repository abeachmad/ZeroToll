// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * MockBridgeAdapter - Simulates cross-chain bridge for testnet demo
 * In production, replace with real Polygon PoS Portal adapter
 */
contract MockBridgeAdapter {
    event BridgeInitiated(address indexed token, uint256 amount, uint256 dstChainId, address recipient);
    
    function bridge(
        address token,
        uint256 amount,
        uint256 dstChainId,
        address recipient
    ) external returns (uint256) {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // In real implementation, this would call Portal bridge
        // For mock, we just emit event and return amount (simulating 1:1 bridge)
        emit BridgeInitiated(token, amount, dstChainId, recipient);
        
        return amount; // Mock assumes no bridge fee
    }
    
    // Mock claim function for destination chain
    function claim(bytes32 bridgeId, address recipient) external returns (uint256) {
        // Mock implementation
        return 0;
    }
}
