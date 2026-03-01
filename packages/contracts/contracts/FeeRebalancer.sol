// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IDEXAdapter.sol";
import "./vaults/FeeVault4626.sol";

/**
 * @title FeeRebalancer
 * @notice Automatically converts collected protocol fees to USDC and deposits to FeeVault
 * @dev Called periodically by relayer job to rebalance fee tokens
 * 
 * Flow:
 * 1. FeeSink accumulates fees in various tokens (ETH, LINK, USDT, etc.)
 * 2. FeeRebalancer swaps these tokens → USDC via DEX adapters
 * 3. USDC deposited to FeeVault4626 (60% LPs, 40% treasury)
 */
contract FeeRebalancer is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Fee source (FeeSink contract)
    address public feeSink;

    // Vault to deposit converted USDC
    FeeVault4626 public feeVault;

    // Target asset (USDC)
    IERC20 public immutable targetAsset;

    // DEX adapters for swapping
    mapping(address => address) public tokenToAdapter; // token → DEX adapter

    // Minimum USD value to trigger rebalance (prevents dust swaps)
    uint256 public minRebalanceUSD = 1000 * 1e8; // $1000 (8 decimals)

    // Max slippage tolerance (in bps, 10000 = 100%)
    uint256 public maxSlippageBPS = 30; // 0.3% default

    // Events
    event FeeTokenSwapped(
        address indexed token,
        uint256 amountIn,
        uint256 usdcOut,
        uint256 timestamp
    );
    event RebalanceExecuted(
        uint256 totalUSDC,
        uint256 tokensProcessed,
        uint256 timestamp
    );
    event AdapterUpdated(
        address indexed token,
        address indexed oldAdapter,
        address indexed newAdapter
    );
    event MinRebalanceUpdated(uint256 oldMin, uint256 newMin);
    event MaxSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);

    /**
     * @param _feeSink Address of FeeSink contract
     * @param _feeVault Address of FeeVault4626 contract
     * @param _targetAsset Address of USDC token
     */
    constructor(
        address _feeSink,
        address _feeVault,
        address _targetAsset
    ) Ownable(msg.sender) {
        require(_feeSink != address(0), "Invalid fee sink");
        require(_feeVault != address(0), "Invalid fee vault");
        require(_targetAsset != address(0), "Invalid target asset");

        feeSink = _feeSink;
        feeVault = FeeVault4626(_feeVault);
        targetAsset = IERC20(_targetAsset);
    }

    /**
     * @notice Rebalance accumulated fees to USDC
     * @param tokens Array of fee token addresses to rebalance
     * @param minOutputs Minimum USDC output for each token (slippage protection)
     * @return totalUSDC Total USDC collected and deposited to vault
     */
    function rebalance(address[] calldata tokens, uint256[] calldata minOutputs)
        external
        nonReentrant
        returns (uint256 totalUSDC)
    {
        require(tokens.length == minOutputs.length, "Length mismatch");
        require(tokens.length > 0, "No tokens provided");

        uint256 tokensProcessed = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 minOutput = minOutputs[i];

            // Skip if token is already USDC
            if (token == address(targetAsset)) {
                uint256 balance = targetAsset.balanceOf(address(this));
                if (balance > 0) {
                    totalUSDC += balance;
                    tokensProcessed++;
                }
                continue;
            }

            // Get adapter for this token
            address adapter = tokenToAdapter[token];
            require(adapter != address(0), "No adapter for token");

            // Get token balance
            uint256 balance = token == address(0)
                ? address(this).balance
                : IERC20(token).balanceOf(address(this));

            if (balance == 0) continue;

            // Execute swap
            uint256 usdcOut = _swapToUSDC(token, balance, adapter, minOutput);
            totalUSDC += usdcOut;
            tokensProcessed++;

            emit FeeTokenSwapped(token, balance, usdcOut, block.timestamp);
        }

        // Deposit USDC to vault
        if (totalUSDC > 0) {
            targetAsset.safeIncreaseAllowance(address(feeVault), totalUSDC);
            feeVault.depositFees(totalUSDC);
        }

        emit RebalanceExecuted(totalUSDC, tokensProcessed, block.timestamp);
        return totalUSDC;
    }

    /**
     * @notice Swap single token to USDC
     * @param token Token address (address(0) for native ETH/POL)
     * @param amount Amount to swap
     * @param adapter DEX adapter to use
     * @param minOutput Minimum USDC output
     * @return usdcOut Actual USDC received
     */
    function _swapToUSDC(
        address token,
        uint256 amount,
        address adapter,
        uint256 minOutput
    ) private returns (uint256 usdcOut) {
        IDEXAdapter dexAdapter = IDEXAdapter(adapter);

        // Approve adapter if needed (for ERC20)
        if (token != address(0)) {
            uint256 allowance = IERC20(token).allowance(address(this), adapter);
            if (allowance < amount) {
                IERC20(token).safeIncreaseAllowance(adapter, type(uint256).max);
            }
        }

        // Execute swap
        usdcOut = dexAdapter.swap{value: token == address(0) ? amount : 0}(
            token,
            address(targetAsset),
            amount,
            minOutput,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );

        return usdcOut;
    }

    /**
     * @notice Calculate minimum output for a swap (for UI estimation)
     * @param token Token address to swap
     * @param amount Amount to swap
     * @return minOutput Minimum USDC output accounting for slippage
     * @dev Cannot be view due to Uniswap V3 quoter limitations
     */
    function calculateMinOutput(address token, uint256 amount)
        external
        returns (uint256 minOutput)
    {
        address adapter = tokenToAdapter[token];
        require(adapter != address(0), "No adapter for token");

        IDEXAdapter dexAdapter = IDEXAdapter(adapter);
        (uint256 quote, ) = dexAdapter.getQuote(token, address(targetAsset), amount);

        // Apply slippage tolerance
        minOutput = (quote * (10000 - maxSlippageBPS)) / 10000;
        return minOutput;
    }

    /**
     * @notice Set DEX adapter for a token
     * @param token Token address
     * @param adapter DEX adapter address
     */
    function setAdapter(address token, address adapter) external onlyOwner {
        require(adapter != address(0), "Invalid adapter");
        emit AdapterUpdated(token, tokenToAdapter[token], adapter);
        tokenToAdapter[token] = adapter;
    }

    /**
     * @notice Set multiple adapters at once
     * @param tokens Array of token addresses
     * @param adapters Array of adapter addresses
     */
    function setAdapters(address[] calldata tokens, address[] calldata adapters)
        external
        onlyOwner
    {
        require(tokens.length == adapters.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            require(adapters[i] != address(0), "Invalid adapter");
            emit AdapterUpdated(tokens[i], tokenToAdapter[tokens[i]], adapters[i]);
            tokenToAdapter[tokens[i]] = adapters[i];
        }
    }

    /**
     * @notice Update minimum rebalance threshold
     */
    function setMinRebalanceUSD(uint256 newMin) external onlyOwner {
        emit MinRebalanceUpdated(minRebalanceUSD, newMin);
        minRebalanceUSD = newMin;
    }

    /**
     * @notice Update max slippage tolerance
     */
    function setMaxSlippageBPS(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 500, "Slippage too high"); // Max 5%
        emit MaxSlippageUpdated(maxSlippageBPS, newSlippage);
        maxSlippageBPS = newSlippage;
    }

    /**
     * @notice Update fee vault address
     */
    function setFeeVault(address newVault) external onlyOwner {
        require(newVault != address(0), "Invalid vault");
        feeVault = FeeVault4626(newVault);
    }

    /**
     * @notice Withdraw tokens (emergency only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @notice Withdraw target asset (USDC) to deposit manually
     */
    function withdrawTargetAsset(uint256 amount) external onlyOwner {
        targetAsset.safeTransfer(owner(), amount);
    }

    // Allow receiving ETH/POL fees
    receive() external payable {}
}
