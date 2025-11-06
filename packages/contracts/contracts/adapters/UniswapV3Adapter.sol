// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDEXAdapter.sol";
import "../interfaces/IUniswapV3.sol";

/**
 * @title UniswapV3Adapter
 * @notice Adapter for Uniswap V3
 * @dev Used on Arbitrum Sepolia and Optimism Sepolia
 */
contract UniswapV3Adapter is IDEXAdapter {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable swapRouter;
    IQuoter public immutable quoter;
    IUniswapV3Factory public immutable factory;
    address public immutable WETH9;

    // Common fee tiers (in hundredths of a bip, so 3000 = 0.3%)
    uint24[] public feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

    /**
     * @param _swapRouter Address of Uniswap V3 SwapRouter
     * @param _quoter Address of Uniswap V3 Quoter
     * @param _factory Address of Uniswap V3 Factory
     */
    constructor(
        address _swapRouter,
        address _quoter,
        address _factory
    ) {
        require(_swapRouter != address(0), "Invalid swap router");
        require(_quoter != address(0), "Invalid quoter");
        require(_factory != address(0), "Invalid factory");

        swapRouter = ISwapRouter(_swapRouter);
        quoter = IQuoter(_quoter);
        factory = IUniswapV3Factory(_factory);
        WETH9 = swapRouter.WETH9();
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external payable override returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        require(deadline >= block.timestamp, "Deadline expired");

        // Convert native to WETH9
        bool isNativeIn = tokenIn == address(0);
        bool isNativeOut = tokenOut == address(0);
        if (isNativeIn) tokenIn = WETH9;
        if (isNativeOut) tokenOut = WETH9;

        // Find best fee tier
        uint24 bestFee = _findBestPool(tokenIn, tokenOut);
        require(bestFee > 0, "No pool found");

        // Handle native ETH input
        if (isNativeIn) {
            require(msg.value == amountIn, "Incorrect ETH amount");
        } else {
            // Transfer tokens from sender
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

            // Approve router
            uint256 allowance = IERC20(tokenIn).allowance(address(this), address(swapRouter));
            if (allowance < amountIn) {
                IERC20(tokenIn).safeIncreaseAllowance(address(swapRouter), type(uint256).max);
            }
        }

        // Execute swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: bestFee,
            recipient: isNativeOut ? address(this) : recipient,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0 // No price limit
        });

        amountOut = swapRouter.exactInputSingle{value: isNativeIn ? msg.value : 0}(params);

        // Unwrap WETH9 to native ETH if needed
        if (isNativeOut) {
            IWETH9(WETH9).withdraw(amountOut);
            (bool success, ) = recipient.call{value: amountOut}("");
            require(success, "ETH transfer failed");
        }

        return amountOut;
    }

    /**
     * @inheritdoc IDEXAdapter
     * @dev Note: Uniswap V3 quoter is not actually a view function, so this cannot be view
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external override returns (uint256 amountOut, address[] memory path) {
        // Convert native to WETH9
        if (tokenIn == address(0)) tokenIn = WETH9;
        if (tokenOut == address(0)) tokenOut = WETH9;

        // Find best pool
        uint24 bestFee = _findBestPool(tokenIn, tokenOut);
        if (bestFee == 0) {
            path = new address[](0);
            return (0, path);
        }

        // Build path array for return
        path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Get quote
        try quoter.quoteExactInputSingle(tokenIn, tokenOut, bestFee, amountIn, 0) returns (
            uint256 quote
        ) {
            return (quote, path);
        } catch {
            return (0, path);
        }
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function pairExists(
        address tokenA,
        address tokenB,
        uint256 minLiquidity
    ) external view override returns (bool exists) {
        // Convert native to WETH9
        if (tokenA == address(0)) tokenA = WETH9;
        if (tokenB == address(0)) tokenB = WETH9;

        // Check all fee tiers
        for (uint256 i = 0; i < feeTiers.length; i++) {
            address pool = factory.getPool(tokenA, tokenB, feeTiers[i]);
            if (pool != address(0)) {
                // Check liquidity
                uint128 liquidity = IUniswapV3Pool(pool).liquidity();

                // For testnet, accept any liquidity > 0
                if (minLiquidity == 0 || liquidity > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function router() external view override returns (address) {
        return address(swapRouter);
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function protocolName() external view override returns (string memory) {
        return "Uniswap V3";
    }

    /**
     * @dev Find pool with best liquidity across fee tiers
     */
    function _findBestPool(address tokenIn, address tokenOut) private view returns (uint24 bestFee) {
        uint128 bestLiquidity = 0;

        for (uint256 i = 0; i < feeTiers.length; i++) {
            address pool = factory.getPool(tokenIn, tokenOut, feeTiers[i]);
            if (pool != address(0)) {
                uint128 liquidity = IUniswapV3Pool(pool).liquidity();
                if (liquidity > bestLiquidity) {
                    bestLiquidity = liquidity;
                    bestFee = feeTiers[i];
                }
            }
        }

        return bestFee;
    }

    // Allow receiving ETH
    receive() external payable {}
}
