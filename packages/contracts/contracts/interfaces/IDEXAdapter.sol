// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDEXAdapter
 * @notice Standard interface for DEX adapters (Uniswap V2, V3, QuickSwap, etc.)
 * @dev All DEX integrations must implement this interface for consistent routing
 */
interface IDEXAdapter {
    /**
     * @notice Execute a token swap on the underlying DEX
     * @param tokenIn Address of input token (use address(0) for native ETH/POL)
     * @param tokenOut Address of output token (use address(0) for native ETH/POL)
     * @param amountIn Exact amount of tokenIn to swap
     * @param minAmountOut Minimum acceptable output (slippage protection)
     * @param recipient Address to receive the swapped tokens
     * @param deadline Unix timestamp after which the swap will revert
     * @return amountOut Actual amount of tokenOut received
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external payable returns (uint256 amountOut);

    /**
     * @notice Get quote for a swap without executing
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount to swap
     * @return amountOut Expected output amount (before slippage)
     * @return path Routing path used for the swap
     * @dev Some implementations (like Uniswap V3) cannot be view due to external quoter limitations
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut, address[] memory path);

    /**
     * @notice Check if a trading pair exists with sufficient liquidity
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param minLiquidity Minimum liquidity required (in USD equivalent)
     * @return exists True if pair exists with sufficient liquidity
     */
    function pairExists(
        address tokenA,
        address tokenB,
        uint256 minLiquidity
    ) external view returns (bool exists);

    /**
     * @notice Get the underlying DEX router address
     * @return router Address of the DEX router contract
     */
    function router() external view returns (address router);

    /**
     * @notice Get the DEX protocol name
     * @return name Human-readable protocol name (e.g., "Uniswap V2", "QuickSwap")
     */
    function protocolName() external view returns (string memory name);
}
