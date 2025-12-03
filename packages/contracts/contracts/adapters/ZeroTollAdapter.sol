// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IPyth
 * @notice Interface for Pyth Network price oracle
 */
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
    function getPriceNoOlderThan(bytes32 id, uint age) external view returns (Price memory);
}

/**
 * @title IZeroTollToken
 * @notice Interface for ZeroToll tokens with Pyth price ID
 */
interface IZeroTollToken {
    function pythPriceId() external view returns (bytes32);
}

/**
 * @title ZeroTollAdapter
 * @notice DEX adapter for ZeroToll tokens using Pyth oracle for pricing
 * @dev Replaces MockDexAdapter with real oracle-based pricing
 * 
 * Features:
 * - Uses Pyth Network for real-time price feeds
 * - Supports zTokens (zUSDC, zETH, zPOL, zLINK) and real tokens
 * - Configurable swap fee
 * - Liquidity pool management
 */
contract ZeroTollAdapter is Ownable {
    using SafeERC20 for IERC20;

    // Pyth oracle contract
    IPyth public pyth;
    
    // Token to Pyth price feed ID mapping
    mapping(address => bytes32) public tokenPriceIds;
    
    // Internal liquidity pools (token => balance)
    mapping(address => uint256) public liquidity;
    
    // Swap fee in basis points (default 0.3%)
    uint256 public swapFeeBps = 30;
    
    // Maximum price staleness (default 1 hour)
    uint256 public maxPriceAge = 3600;
    
    // Whitelisted tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Events
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    event LiquidityAdded(address indexed token, uint256 amount);
    event LiquidityRemoved(address indexed token, uint256 amount);
    event TokenConfigured(address indexed token, bytes32 priceId);
    event PythUpdated(address indexed newPyth);
    event SwapFeeUpdated(uint256 newFeeBps);

    constructor(address _pyth) Ownable(msg.sender) {
        require(_pyth != address(0), "Invalid Pyth address");
        pyth = IPyth(_pyth);
    }

    // ============================================
    // Swap Functions
    // ============================================

    /**
     * @notice Execute a swap using Pyth oracle prices
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @param recipient Address to receive output tokens
     * @return amountOut Actual output amount
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        require(supportedTokens[tokenIn], "TokenIn not supported");
        require(supportedTokens[tokenOut], "TokenOut not supported");
        require(amountIn > 0, "Zero amount");
        
        // Verify tokens received
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        require(balance >= amountIn, "Tokens not received");
        
        // Calculate output amount using Pyth prices
        amountOut = getQuote(tokenIn, tokenOut, amountIn);
        
        // Apply swap fee
        uint256 fee = (amountOut * swapFeeBps) / 10000;
        amountOut = amountOut - fee;
        
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        // Check liquidity
        uint256 tokenOutBalance = IERC20(tokenOut).balanceOf(address(this));
        require(tokenOutBalance >= amountOut, "Insufficient liquidity");
        
        // Update liquidity tracking
        liquidity[tokenIn] += amountIn;
        if (liquidity[tokenOut] >= amountOut) {
            liquidity[tokenOut] -= amountOut;
        }
        
        // Transfer output tokens
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
        
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, recipient);
    }

    /**
     * @notice Get swap quote using Pyth oracle prices
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return amountOut Expected output amount (before fees)
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        if (tokenIn == tokenOut) {
            return amountIn;
        }
        
        // Get prices in USD (normalized to 18 decimals)
        uint256 priceIn = getTokenPriceUSD(tokenIn);
        uint256 priceOut = getTokenPriceUSD(tokenOut);
        
        require(priceIn > 0 && priceOut > 0, "Invalid prices");
        
        // Get token decimals
        uint8 decimalsIn = IERC20Metadata(tokenIn).decimals();
        uint8 decimalsOut = IERC20Metadata(tokenOut).decimals();
        
        // Calculate: amountOut = amountIn * priceIn / priceOut
        // Adjust for decimal differences
        uint256 valueUSD = (amountIn * priceIn) / (10 ** decimalsIn);
        amountOut = (valueUSD * (10 ** decimalsOut)) / priceOut;
    }

    /**
     * @notice Get token price in USD from Pyth (normalized to 18 decimals)
     * @param token Token address
     * @return price Price in USD with 18 decimals
     */
    function getTokenPriceUSD(address token) public view returns (uint256 price) {
        bytes32 priceId = tokenPriceIds[token];
        
        // Try to get price ID from token contract if not configured
        if (priceId == bytes32(0)) {
            try IZeroTollToken(token).pythPriceId() returns (bytes32 id) {
                priceId = id;
            } catch {
                revert("No price feed configured");
            }
        }
        
        require(priceId != bytes32(0), "No price feed");
        
        // Get price from Pyth
        IPyth.Price memory priceData = pyth.getPriceUnsafe(priceId);
        require(priceData.price > 0, "Invalid price from Pyth");
        require(block.timestamp - priceData.publishTime <= maxPriceAge, "Price too stale");
        
        // Convert to 18 decimals
        price = _normalizePythPrice(priceData);
    }

    /**
     * @notice Normalize Pyth price to 18 decimals
     */
    function _normalizePythPrice(IPyth.Price memory priceData) internal pure returns (uint256) {
        uint256 price = uint256(uint64(priceData.price));
        int32 expo = priceData.expo;
        
        // Pyth prices typically have negative exponents (e.g., -8 for 8 decimal places)
        if (expo < 0) {
            uint32 absExpo = uint32(-expo);
            if (absExpo < 18) {
                // Scale up to 18 decimals
                price = price * (10 ** (18 - absExpo));
            } else {
                // Scale down if more than 18 decimals
                price = price / (10 ** (absExpo - 18));
            }
        } else {
            // Positive exponent (rare)
            price = price * (10 ** (18 + uint32(expo)));
        }
        
        return price;
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice Configure a token with its Pyth price feed
     * @param token Token address
     * @param priceId Pyth price feed ID
     */
    function configureToken(address token, bytes32 priceId) external onlyOwner {
        require(token != address(0), "Invalid token");
        
        if (!supportedTokens[token]) {
            supportedTokens[token] = true;
            tokenList.push(token);
        }
        
        tokenPriceIds[token] = priceId;
        emit TokenConfigured(token, priceId);
    }

    /**
     * @notice Add liquidity for a token
     * @param token Token address
     * @param amount Amount to add
     */
    function addLiquidity(address token, uint256 amount) external {
        require(supportedTokens[token], "Token not supported");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        liquidity[token] += amount;
        emit LiquidityAdded(token, amount);
    }

    /**
     * @notice Remove liquidity (owner only)
     * @param token Token address
     * @param amount Amount to remove
     */
    function removeLiquidity(address token, uint256 amount) external onlyOwner {
        require(liquidity[token] >= amount, "Insufficient liquidity");
        liquidity[token] -= amount;
        IERC20(token).safeTransfer(owner(), amount);
        emit LiquidityRemoved(token, amount);
    }

    /**
     * @notice Update Pyth oracle address
     */
    function setPyth(address _pyth) external onlyOwner {
        require(_pyth != address(0), "Invalid address");
        pyth = IPyth(_pyth);
        emit PythUpdated(_pyth);
    }

    /**
     * @notice Update swap fee
     * @param _feeBps Fee in basis points (max 1000 = 10%)
     */
    function setSwapFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high");
        swapFeeBps = _feeBps;
        emit SwapFeeUpdated(_feeBps);
    }

    /**
     * @notice Update max price staleness
     */
    function setMaxPriceAge(uint256 _maxAge) external onlyOwner {
        maxPriceAge = _maxAge;
    }

    /**
     * @notice Emergency token rescue
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @notice Get liquidity for a token
     */
    function getLiquidity(address token) external view returns (uint256) {
        return liquidity[token];
    }

    /**
     * @notice Check if token is supported
     */
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }

    /**
     * @notice Get token's Pyth price feed ID
     */
    function getTokenPriceId(address token) external view returns (bytes32) {
        bytes32 priceId = tokenPriceIds[token];
        if (priceId == bytes32(0)) {
            try IZeroTollToken(token).pythPriceId() returns (bytes32 id) {
                return id;
            } catch {
                return bytes32(0);
            }
        }
        return priceId;
    }
}
