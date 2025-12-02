// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IUniswapV3Router
 */
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title IUniswapV3Factory
 */
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

/**
 * @title SmartDexAdapter
 * @notice Tries Uniswap V3 first, falls back to internal liquidity pool
 * @dev Supports any ERC-20 token with intelligent routing
 */
contract SmartDexAdapter is Ownable {
    using SafeERC20 for IERC20;

    // Uniswap V3 on Sepolia
    address public constant UNISWAP_ROUTER = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E;
    address public constant UNISWAP_FACTORY = 0x0227628f3F023bb0B980b67D528571c95c6DaC1c;
    
    // Fee tiers to try
    uint24[] public feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    
    // Internal liquidity pools (token => balance)
    mapping(address => uint256) public liquidity;
    
    // Swap fee for internal pools (0.5%)
    uint256 public internalFeeBps = 50;
    
    // Price oracle for internal swaps (tokenA => tokenB => price in 1e18)
    mapping(address => mapping(address => uint256)) public prices;

    event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, string route);
    event LiquidityAdded(address indexed token, uint256 amount);
    event PriceSet(address indexed tokenA, address indexed tokenB, uint256 price);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Execute swap - tries Uniswap first, then internal pool
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        // Receive tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Try Uniswap first
        (bool uniswapSuccess, uint256 uniswapOut) = _tryUniswap(tokenIn, tokenOut, amountIn, minAmountOut, recipient);
        
        if (uniswapSuccess) {
            emit SwapExecuted(tokenIn, tokenOut, amountIn, uniswapOut, "Uniswap");
            return uniswapOut;
        }
        
        // Fallback to internal pool
        amountOut = _swapInternal(tokenIn, tokenOut, amountIn, minAmountOut, recipient);
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, "Internal");
    }

    /**
     * @notice Try to swap via Uniswap V3
     */
    function _tryUniswap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (bool success, uint256 amountOut) {
        // Find a pool with liquidity
        uint24 fee = _findPool(tokenIn, tokenOut);
        if (fee == 0) return (false, 0);
        
        // Approve router
        IERC20(tokenIn).approve(UNISWAP_ROUTER, amountIn);
        
        try IUniswapV3Router(UNISWAP_ROUTER).exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 out) {
            return (true, out);
        } catch {
            // Uniswap failed, return tokens to this contract for internal swap
            return (false, 0);
        }
    }

    /**
     * @notice Find Uniswap pool for pair
     */
    function _findPool(address tokenIn, address tokenOut) internal view returns (uint24) {
        for (uint i = 0; i < feeTiers.length; i++) {
            address pool = IUniswapV3Factory(UNISWAP_FACTORY).getPool(tokenIn, tokenOut, feeTiers[i]);
            if (pool != address(0)) {
                return feeTiers[i];
            }
        }
        return 0;
    }

    /**
     * @notice Internal swap using liquidity pool
     */
    function _swapInternal(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Calculate output based on price oracle or 1:1 if same decimals
        uint256 price = prices[tokenIn][tokenOut];
        
        if (price > 0) {
            amountOut = (amountIn * price) / 1e18;
        } else if (tokenIn == tokenOut) {
            amountOut = amountIn;
        } else {
            // Default 1:1 for test tokens
            amountOut = amountIn;
        }
        
        // Apply fee
        uint256 fee = (amountOut * internalFeeBps) / 10000;
        amountOut = amountOut - fee;
        
        require(amountOut >= minAmountOut, "Slippage exceeded");
        require(liquidity[tokenOut] >= amountOut, "Insufficient liquidity");
        
        // Update liquidity
        liquidity[tokenIn] += amountIn;
        liquidity[tokenOut] -= amountOut;
        
        // Transfer output
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }

    // ============================================
    // Admin functions
    // ============================================

    function addLiquidity(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        liquidity[token] += amount;
        emit LiquidityAdded(token, amount);
    }

    function setPrice(address tokenA, address tokenB, uint256 price) external onlyOwner {
        prices[tokenA][tokenB] = price;
        // Set reverse price
        if (price > 0) {
            prices[tokenB][tokenA] = (1e36) / price;
        }
        emit PriceSet(tokenA, tokenB, price);
    }

    function setInternalFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high");
        internalFeeBps = _feeBps;
    }

    function withdrawLiquidity(address token, uint256 amount) external onlyOwner {
        require(liquidity[token] >= amount, "Insufficient");
        liquidity[token] -= amount;
        IERC20(token).safeTransfer(owner(), amount);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============================================
    // View functions
    // ============================================

    function hasUniswapPool(address tokenIn, address tokenOut) external view returns (bool, uint24) {
        uint24 fee = _findPool(tokenIn, tokenOut);
        return (fee > 0, fee);
    }

    function getLiquidity(address token) external view returns (uint256) {
        return liquidity[token];
    }

    function getPrice(address tokenIn, address tokenOut) external view returns (uint256) {
        return prices[tokenIn][tokenOut];
    }
}
