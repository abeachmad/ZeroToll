// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISwapRouter
 * @notice Uniswap V3 SwapRouter interface (simplified)
 */
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    function WETH9() external view returns (address);
}

/**
 * @title IQuoter
 * @notice Uniswap V3 Quoter interface
 */
interface IQuoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);

    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        returns (uint256 amountOut);
}

/**
 * @title IUniswapV3Factory
 * @notice Uniswap V3 Factory interface
 */
interface IUniswapV3Factory {
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);
}

/**
 * @title IUniswapV3Pool
 * @notice Uniswap V3 Pool interface
 */
interface IUniswapV3Pool {
    function liquidity() external view returns (uint128);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/**
 * @title IWETH9
 * @notice WETH9 interface for unwrapping
 */
interface IWETH9 {
    function withdraw(uint256) external;
}
