// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDEXAdapter.sol";
import "../interfaces/IUniswapV2.sol";

/**
 * @title UniswapV2Adapter
 * @notice Adapter for Uniswap V2 compatible DEXes (Uniswap V2, QuickSwap, Sushiswap)
 * @dev Used on Sepolia (Uniswap V2) and Amoy (QuickSwap V2)
 */
contract UniswapV2Adapter is IDEXAdapter {
    using SafeERC20 for IERC20;

    IUniswapV2Router public immutable uniswapRouter;
    address public immutable WETH;
    string private _name;

    /**
     * @param _router Address of Uniswap V2 compatible router
     * @param _protocolName Name of the protocol (e.g., "Uniswap V2", "QuickSwap")
     */
    constructor(address _router, string memory _protocolName) {
        require(_router != address(0), "Invalid router address");
        uniswapRouter = IUniswapV2Router(_router);
        WETH = uniswapRouter.WETH();
        _name = _protocolName;
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

        address[] memory path = _buildPath(tokenIn, tokenOut);
        require(path.length > 0, "No path found");

        // Native ETH/POL input
        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "Incorrect ETH amount");
            uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{value: amountIn}(
                minAmountOut,
                path,
                recipient,
                deadline
            );
            return amounts[amounts.length - 1];
        }

        // Transfer tokens from sender
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve router if needed
        uint256 allowance = IERC20(tokenIn).allowance(address(this), address(uniswapRouter));
        if (allowance < amountIn) {
            IERC20(tokenIn).safeIncreaseAllowance(address(uniswapRouter), type(uint256).max);
        }

        // Native ETH/POL output
        if (tokenOut == address(0)) {
            uint256[] memory amounts = uniswapRouter.swapExactTokensForETH(
                amountIn,
                minAmountOut,
                path,
                recipient,
                deadline
            );
            return amounts[amounts.length - 1];
        }

        // Token to token
        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            deadline
        );
        return amounts[amounts.length - 1];
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, address[] memory path) {
        path = _buildPath(tokenIn, tokenOut);
        if (path.length == 0) {
            return (0, path);
        }

        try uniswapRouter.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return (amounts[amounts.length - 1], path);
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
        // Convert native address to WETH
        if (tokenA == address(0)) tokenA = WETH;
        if (tokenB == address(0)) tokenB = WETH;

        address factory = uniswapRouter.factory();
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);

        if (pair == address(0)) return false;

        // Check liquidity (simplified - just check reserves exist)
        (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(pair).getReserves();

        // If minLiquidity is 0, just check reserves > 0
        if (minLiquidity == 0) {
            return reserve0 > 0 && reserve1 > 0;
        }

        // For testnet, accept any liquidity > 0 since minLiquidity check needs price oracle
        // In production, would convert reserves to USD using oracle
        return reserve0 > 0 && reserve1 > 0;
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function router() external view override returns (address) {
        return address(uniswapRouter);
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function protocolName() external view override returns (string memory) {
        return _name;
    }

    /**
     * @dev Build swap path (direct or through WETH)
     */
    function _buildPath(address tokenIn, address tokenOut)
        private
        view
        returns (address[] memory path)
    {
        // Convert native to WETH
        if (tokenIn == address(0)) tokenIn = WETH;
        if (tokenOut == address(0)) tokenOut = WETH;

        address factory = uniswapRouter.factory();

        // Try direct path first
        address directPair = IUniswapV2Factory(factory).getPair(tokenIn, tokenOut);
        if (directPair != address(0)) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            return path;
        }

        // Try path through WETH
        if (tokenIn != WETH && tokenOut != WETH) {
            address pairIn = IUniswapV2Factory(factory).getPair(tokenIn, WETH);
            address pairOut = IUniswapV2Factory(factory).getPair(WETH, tokenOut);

            if (pairIn != address(0) && pairOut != address(0)) {
                path = new address[](3);
                path[0] = tokenIn;
                path[1] = WETH;
                path[2] = tokenOut;
                return path;
            }
        }

        // No path found
        return new address[](0);
    }

    // Allow receiving ETH for swaps
    receive() external payable {}
}
