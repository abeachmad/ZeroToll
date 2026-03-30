// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RouterV3NativeAdapterMock {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public mockOutputs;

    function setMockOutput(address tokenOut, uint256 amountOut) external {
        mockOutputs[tokenOut] = amountOut;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        require(IERC20(tokenIn).balanceOf(address(this)) >= amountIn, "Insufficient input");

        amountOut = mockOutputs[tokenOut];
        require(amountOut > 0, "Mock output not configured");
        require(amountOut >= minAmountOut, "Insufficient output");

        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}
