// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDEXAdapter.sol";

/**
 * @title MockDEXAdapter
 * @notice Fallback adapter for testnet scenarios with insufficient liquidity
 * @dev Simulates swaps using oracle prices - FOR TESTNET DEMO ONLY, NOT PRODUCTION
 * 
 * WARNING: This adapter does NOT use real liquidity pools. It's designed for
 * testnet demonstrations where DEX liquidity is sparse. In production, only
 * real DEX adapters should be used.
 */

// Price oracle interface (simplified) - extracted to avoid nested interface error
interface IMockPriceOracle {
    function getPrice(address token) external view returns (uint256 priceUSD);
}

contract MockDEXAdapter is IDEXAdapter {
    using SafeERC20 for IERC20;

    IMockPriceOracle public immutable priceOracle;
    address public immutable owner;
    mapping(address => bool) public supportedTokens;

    // Simulated slippage (in bps, e.g., 30 = 0.3%)
    uint256 public constant SIMULATED_SLIPPAGE_BPS = 30;

    // Custom errors
    error InsufficientPrefund(uint256 have, uint256 need);

    event MockSwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @param _priceOracle Address of price oracle (Pyth, Chainlink, etc.)
     */
    constructor(address _priceOracle) {
        require(_priceOracle != address(0), "Invalid oracle");
        priceOracle = IMockPriceOracle(_priceOracle);
        owner = msg.sender;
    }

    /**
     * @notice Add supported token
     * @param token Token address to support
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove supported token
     * @param token Token address to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @inheritdoc IDEXAdapter
     * @dev Simulates swap using oracle prices with synthetic slippage
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
        require(
            tokenIn == address(0) || supportedTokens[tokenIn],
            "TokenIn not supported"
        );
        require(
            tokenOut == address(0) || supportedTokens[tokenOut],
            "TokenOut not supported"
        );

        // Calculate output using oracle prices
        (amountOut, ) = this.getQuote(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "Insufficient output");

        // Handle input
        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "Incorrect ETH amount");
        } else {
            // PUSH PATTERN: Check that RouterHub has prefunded this adapter
            // RouterHub transfers tokens BEFORE calling swap, so we check our balance
            uint256 adapterBalance = IERC20(tokenIn).balanceOf(address(this));
            if (adapterBalance < amountIn) {
                revert InsufficientPrefund(adapterBalance, amountIn);
            }
            // No transferFrom needed - tokens are already here from RouterHub's safeTransfer
        }

        // Handle output
        if (tokenOut == address(0)) {
            (bool success, ) = recipient.call{value: amountOut}("");
            require(success, "ETH transfer failed");
        } else {
            // In real scenario, this adapter would hold reserve tokens
            // For testnet demo, we assume tokens are available
            IERC20(tokenOut).safeTransfer(recipient, amountOut);
        }

        emit MockSwapExecuted(tokenIn, tokenOut, amountIn, amountOut, recipient);
        return amountOut;
    }

    /**
     * @inheritdoc IDEXAdapter
     * @dev Returns quote based on oracle prices with simulated slippage
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, address[] memory path) {
        // Get prices (USD, 8 decimals)
        uint256 priceIn;
        uint256 priceOut;
        
        // Use hardcoded prices (oracle at 0x1 is just a placeholder)
        priceIn = tokenIn == address(0) ? 2000 * 1e8 : getHardcodedPrice(tokenIn);
        priceOut = tokenOut == address(0) ? 2000 * 1e8 : getHardcodedPrice(tokenOut);

        require(priceIn > 0 && priceOut > 0, "Price not available");

        // Get decimals for both tokens
        uint8 decimalsIn = tokenIn == address(0) ? 18 : IERC20Metadata(tokenIn).decimals();
        uint8 decimalsOut = tokenOut == address(0) ? 18 : IERC20Metadata(tokenOut).decimals();

        // Calculate output with decimal adjustment
        // Formula: amountOut = (amountIn * priceIn * 10^decimalsOut) / (priceOut * 10^decimalsIn)
        // Example: 0.01 USDC (10000 with 6 decimals) at $1 to LINK at $15 (18 decimals)
        //        = (10000 * 1e8 * 1e18) / (15e8 * 1e6) = (10000 * 1e18) / 15 = 666.67e15
        
        if (decimalsOut >= decimalsIn) {
            amountOut = (amountIn * priceIn * (10 ** (decimalsOut - decimalsIn))) / priceOut;
        } else {
            amountOut = (amountIn * priceIn) / (priceOut * (10 ** (decimalsIn - decimalsOut)));
        }

        // Apply simulated slippage (reduce output)
        amountOut = (amountOut * (10000 - SIMULATED_SLIPPAGE_BPS)) / 10000;

        // Build simple path
        path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        return (amountOut, path);
    }

    /**
     * @inheritdoc IDEXAdapter
     * @dev Always returns true for supported tokens (mock behavior)
     */
    function pairExists(
        address tokenA,
        address tokenB,
        uint256 /* minLiquidity */
    ) external view override returns (bool exists) {
        bool aSupported = tokenA == address(0) || supportedTokens[tokenA];
        bool bSupported = tokenB == address(0) || supportedTokens[tokenB];
        return aSupported && bSupported;
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function router() external view override returns (address) {
        return address(this); // Mock router is this contract
    }

    /**
     * @inheritdoc IDEXAdapter
     */
    function protocolName() external view override returns (string memory) {
        return "MockDEX (Testnet Only)";
    }

    /**
     * @notice Fund adapter with tokens for testnet demo
     * @param token Token address
     * @param amount Amount to fund
     */
    function fundAdapter(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = address(this).call{value: amount}("");
            require(success, "ETH funding failed");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    /**
     * @notice Withdraw tokens from adapter
     * @param token Token address (address(0) for native)
     * @param amount Amount to withdraw
     */
    function withdrawFunds(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner.call{value: amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }
    /**
     * @notice Get hardcoded price for common testnet tokens (fallback)
     * @param token Token address
     * @return price Price in USD (8 decimals)
     */
    function getHardcodedPrice(address token) internal pure returns (uint256 price) {
        // Sepolia testnet token addresses
        if (token == 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) {
            return 1 * 1e8; // USDC = $1
        } else if (token == 0x779877A7B0D9E8603169DdbD7836e478b4624789) {
            return 15 * 1e8; // LINK = $15 (approx)
        } else if (token == 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14) {
            return 2000 * 1e8; // WETH = $2000 (approx)
        } else if (token == 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9) {
            return 1 * 1e8; // PYUSD = $1
        } else {
            return 1 * 1e8; // Default: $1
        }
    }

    // Allow receiving ETH
    receive() external payable {}
}
