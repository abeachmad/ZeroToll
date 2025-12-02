// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ISwapRouter
 * @notice Uniswap V3 SwapRouter interface
 */
interface ISwapRouter {
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
 * @title UniswapV3Adapter
 * @notice DEX adapter for ZeroTollRouter that routes swaps through Uniswap V3
 */
contract UniswapV3Adapter {
    using SafeERC20 for IERC20;

    // Uniswap V3 SwapRouter on Sepolia
    address public constant UNISWAP_ROUTER = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E;
    
    // Default fee tier (0.3%)
    uint24 public constant DEFAULT_FEE = 3000;

    // Owner for admin functions
    address public owner;

    // Custom fee tiers for specific pairs
    mapping(bytes32 => uint24) public pairFees;

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @notice Execute a swap through Uniswap V3
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @param recipient Address to receive output tokens
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        // Tokens are already transferred to this contract by ZeroTollRouter
        // Just verify we have the tokens
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        require(balance >= amountIn, "Insufficient token balance");
        
        // Approve Uniswap router
        IERC20(tokenIn).approve(UNISWAP_ROUTER, amountIn);

        // Get fee tier for this pair
        uint24 fee = getFee(tokenIn, tokenOut);

        // Execute swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: recipient,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        amountOut = ISwapRouter(UNISWAP_ROUTER).exactInputSingle(params);

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, recipient);
    }

    /**
     * @notice Get fee tier for a token pair
     */
    function getFee(address tokenIn, address tokenOut) public view returns (uint24) {
        bytes32 pairKey = keccak256(abi.encodePacked(tokenIn, tokenOut));
        uint24 fee = pairFees[pairKey];
        
        if (fee == 0) {
            // Check reverse pair
            pairKey = keccak256(abi.encodePacked(tokenOut, tokenIn));
            fee = pairFees[pairKey];
        }
        
        return fee == 0 ? DEFAULT_FEE : fee;
    }

    /**
     * @notice Set custom fee tier for a pair
     */
    function setFee(address tokenA, address tokenB, uint24 fee) external onlyOwner {
        bytes32 pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        pairFees[pairKey] = fee;
    }

    /**
     * @notice Rescue stuck tokens
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner, amount);
    }
}
