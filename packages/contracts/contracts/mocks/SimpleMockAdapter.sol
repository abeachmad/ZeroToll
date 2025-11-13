// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SimpleMockAdapter
 * @notice Simple mock adapter for testing gasless fee logic
 * @dev Does NOT simulate real DEX behavior - just transfers tokens
 */
contract SimpleMockAdapter {
    using SafeERC20 for IERC20;
    
    mapping(address => uint256) public mockOutputs;
    
    function setMockOutput(address token, uint256 amount) external {
        mockOutputs[token] = amount;
    }
    
    function mockSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    ) external returns (uint256) {
        // Accept tokenIn (already received via prefund from RouterHub)
        // Just verify we have it
        require(IERC20(tokenIn).balanceOf(address(this)) >= amountIn, "Insufficient input");
        
        // Use configured mock output or passed amount
        uint256 actualOut = mockOutputs[tokenOut] > 0 ? mockOutputs[tokenOut] : amountOut;
        
        // Transfer tokenOut to recipient (RouterHub)
        IERC20(tokenOut).safeTransfer(recipient, actualOut);
        
        return actualOut;
    }
}
