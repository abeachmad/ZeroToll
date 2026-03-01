// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPermit2
 * @notice Interface for Uniswap's Permit2 contract
 */
interface IPermit2 {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    function permit(address owner, PermitSingle memory permitSingle, bytes calldata signature) external;
    function transferFrom(address from, address to, uint160 amount, address token) external;
    function allowance(address user, address token, address spender) external view returns (uint160, uint48, uint48);
}

/**
 * @title IZeroTollTreasury
 * @notice Interface for fee collection
 */
interface IZeroTollTreasury {
    function collectFee(address token, uint256 amount, address from) external;
}

/**
 * @title ZeroTollRouterV3
 * @notice Intent-based gasless swap router with dynamic fee support
 * @dev V3 adds: Dynamic fee collection (2x gas cost) sent to Treasury
 * 
 * Fee Flow:
 *   1. Relayer calculates fee = 2x gas cost in input token
 *   2. Router transfers fee to Treasury
 *   3. Remaining amount is swapped
 *   4. User receives output tokens
 */
contract ZeroTollRouterV3 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // Structs
    // ============================================

    struct SwapIntent {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
        uint256 chainId;
    }

    // ============================================
    // Constants
    // ============================================

    bytes32 public constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
    );
    
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ============================================
    // State Variables
    // ============================================

    bytes32 public DOMAIN_SEPARATOR;
    
    mapping(address => uint256) public nonces;
    
    // DEX adapters
    address public primaryAdapter;
    address public fallbackAdapter;
    address public dexAdapter; // Legacy
    
    // Fee configuration
    uint256 public swapFeeBps = 50; // 0.5% swap fee (existing)
    address public feeRecipient;    // Legacy fee recipient
    
    // NEW: Treasury for gasless fee collection
    address public treasury;
    uint256 public maxGaslessFeePercent = 100; // 1% max fee cap (in basis points)
    bool public gaslessFeeEnabled = true;

    // Test mode
    bool public testMode = true;

    // ============================================
    // Events
    // ============================================

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 nonce
    );
    
    event GaslessFeeCollected(
        address indexed user,
        address indexed token,
        uint256 feeAmount,
        uint256 swapAmount
    );
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event GaslessFeeConfigUpdated(uint256 maxFeePercent, bool enabled);
    event AdaptersConfigured(address indexed primaryAdapter, address indexed fallbackAdapter);
    event SwapRouted(address indexed adapter, string route);

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ZeroTollRouter")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ============================================
    // Swap Functions (with gasless fee support)
    // ============================================

    /**
     * @notice Execute swap with ERC-2612 Permit + Gasless Fee
     * @param intent The swap intent signed by user
     * @param userSignature The user's signature
     * @param permitDeadline Permit deadline
     * @param permitV Permit signature v
     * @param permitR Permit signature r
     * @param permitS Permit signature s
     * @param gaslessFee Fee amount in input token (calculated by relayer as 2x gas cost)
     */
    function executeSwapWithPermitAndFee(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 permitDeadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS,
        uint256 gaslessFee
    ) external nonReentrant returns (uint256 amountOut) {
        // Validate fee doesn't exceed cap
        _validateGaslessFee(intent.amountIn, gaslessFee);
        
        // Execute permit for FULL amount (including fee)
        uint256 currentAllowance = IERC20(intent.tokenIn).allowance(intent.user, address(this));
        if (currentAllowance < intent.amountIn) {
            IERC20Permit(intent.tokenIn).permit(
                intent.user,
                address(this),
                intent.amountIn,
                permitDeadline,
                permitV,
                permitR,
                permitS
            );
        }
        
        // Verify allowance
        require(
            IERC20(intent.tokenIn).allowance(intent.user, address(this)) >= intent.amountIn,
            "Permit failed"
        );

        return _executeSwapWithFee(intent, userSignature, gaslessFee);
    }

    /**
     * @notice Execute swap with Permit2 + Gasless Fee
     */
    function executeSwapWithPermit2AndFee(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        IPermit2.PermitSingle calldata permitSingle,
        bytes calldata permit2Signature,
        uint256 gaslessFee
    ) external nonReentrant returns (uint256 amountOut) {
        _validateGaslessFee(intent.amountIn, gaslessFee);
        
        // Execute Permit2
        IPermit2(PERMIT2).permit(intent.user, permitSingle, permit2Signature);
        
        return _executeSwapWithFeePermit2(intent, userSignature, gaslessFee);
    }

    /**
     * @notice Legacy: Execute swap with permit (no gasless fee)
     */
    function executeSwapWithPermit(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 permitDeadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external nonReentrant returns (uint256 amountOut) {
        uint256 currentAllowance = IERC20(intent.tokenIn).allowance(intent.user, address(this));
        if (currentAllowance < intent.amountIn) {
            IERC20Permit(intent.tokenIn).permit(
                intent.user,
                address(this),
                intent.amountIn,
                permitDeadline,
                permitV,
                permitR,
                permitS
            );
        }
        
        return _executeSwapInternal(intent, userSignature, false);
    }

    /**
     * @notice Legacy: Execute swap with traditional approval
     */
    function executeSwap(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) external nonReentrant returns (uint256 amountOut) {
        return _executeSwapInternal(intent, userSignature, false);
    }

    // ============================================
    // Internal Functions
    // ============================================

    function _validateGaslessFee(uint256 amountIn, uint256 fee) internal view {
        if (!gaslessFeeEnabled || fee == 0) return;
        
        // Cap fee at maxGaslessFeePercent of amountIn
        uint256 maxFee = (amountIn * maxGaslessFeePercent) / 10000;
        require(fee <= maxFee, "Fee exceeds cap");
    }

    function _executeSwapWithFee(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 gaslessFee
    ) internal returns (uint256 amountOut) {
        _validateIntent(intent, userSignature);
        nonces[intent.user]++;

        // Pull FULL amount from user
        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);

        // Collect gasless fee to treasury
        uint256 swapAmount = intent.amountIn;
        if (gaslessFee > 0 && treasury != address(0) && gaslessFeeEnabled) {
            // Transfer fee directly to treasury (simpler than collectFee)
            IERC20(intent.tokenIn).safeTransfer(treasury, gaslessFee);
            swapAmount = intent.amountIn - gaslessFee;
            
            emit GaslessFeeCollected(intent.user, intent.tokenIn, gaslessFee, swapAmount);
        }

        // Execute swap with remaining amount
        amountOut = _doSwapWithAmount(intent, swapAmount);
        require(amountOut >= intent.minAmountOut, "Slippage exceeded");

        emit SwapExecuted(
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut,
            intent.nonce
        );
    }

    function _executeSwapWithFeePermit2(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 gaslessFee
    ) internal returns (uint256 amountOut) {
        _validateIntent(intent, userSignature);
        nonces[intent.user]++;

        // Pull FULL amount via Permit2
        IPermit2(PERMIT2).transferFrom(
            intent.user,
            address(this),
            uint160(intent.amountIn),
            intent.tokenIn
        );

        // Collect gasless fee
        uint256 swapAmount = intent.amountIn;
        if (gaslessFee > 0 && treasury != address(0) && gaslessFeeEnabled) {
            // Transfer fee directly to treasury
            IERC20(intent.tokenIn).safeTransfer(treasury, gaslessFee);
            swapAmount = intent.amountIn - gaslessFee;
            
            emit GaslessFeeCollected(intent.user, intent.tokenIn, gaslessFee, swapAmount);
        }

        amountOut = _doSwapWithAmount(intent, swapAmount);
        require(amountOut >= intent.minAmountOut, "Slippage exceeded");

        emit SwapExecuted(
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut,
            intent.nonce
        );
    }

    function _executeSwapInternal(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        bool usePermit2
    ) internal returns (uint256 amountOut) {
        _validateIntent(intent, userSignature);
        nonces[intent.user]++;

        if (usePermit2) {
            IPermit2(PERMIT2).transferFrom(
                intent.user,
                address(this),
                uint160(intent.amountIn),
                intent.tokenIn
            );
        } else {
            IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);
        }

        amountOut = _doSwapWithAmount(intent, intent.amountIn);
        require(amountOut >= intent.minAmountOut, "Slippage exceeded");

        emit SwapExecuted(
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut,
            intent.nonce
        );
    }

    function _validateIntent(SwapIntent calldata intent, bytes calldata userSignature) internal view {
        require(block.timestamp <= intent.deadline, "Intent expired");
        require(intent.user != address(0), "Invalid user");
        require(intent.nonce == nonces[intent.user], "Invalid nonce");
        require(intent.amountIn > 0, "Invalid amount");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(
                    SWAP_INTENT_TYPEHASH,
                    intent.user,
                    intent.tokenIn,
                    intent.tokenOut,
                    intent.amountIn,
                    intent.minAmountOut,
                    intent.deadline,
                    intent.nonce,
                    intent.chainId
                ))
            )
        );

        address signer = _recover(digest, userSignature);
        require(signer == intent.user, "Invalid signature");
    }

    function _doSwapWithAmount(SwapIntent calldata intent, uint256 amount) internal returns (uint256 amountOut) {
        // Try adapters in order
        if (primaryAdapter != address(0)) {
            (bool success, uint256 result) = _tryAdapter(primaryAdapter, intent, amount);
            if (success) {
                emit SwapRouted(primaryAdapter, "primary");
                return result;
            }
        }
        
        if (fallbackAdapter != address(0)) {
            (bool success, uint256 result) = _tryAdapter(fallbackAdapter, intent, amount);
            if (success) {
                emit SwapRouted(fallbackAdapter, "fallback");
                return result;
            }
        }
        
        if (dexAdapter != address(0)) {
            (bool success, uint256 result) = _tryAdapter(dexAdapter, intent, amount);
            if (success) {
                emit SwapRouted(dexAdapter, "legacy");
                return result;
            }
            revert("All adapters failed");
        }
        
        if (testMode) {
            amountOut = _doTestModeSwap(intent, amount);
            emit SwapRouted(address(0), "testMode");
            return amountOut;
        }
        
        revert("No DEX adapter configured");
    }

    function _tryAdapter(
        address adapter, 
        SwapIntent calldata intent,
        uint256 amount
    ) internal returns (bool success, uint256 amountOut) {
        IERC20(intent.tokenIn).safeTransfer(adapter, amount);
        
        (bool callSuccess, bytes memory result) = adapter.call(
            abi.encodeWithSignature(
                "swap(address,address,uint256,uint256,address)",
                intent.tokenIn,
                intent.tokenOut,
                amount,
                intent.minAmountOut,
                intent.user
            )
        );
        
        if (callSuccess && result.length >= 32) {
            amountOut = abi.decode(result, (uint256));
            if (amountOut >= intent.minAmountOut) {
                return (true, amountOut);
            }
        }
        
        return (false, 0);
    }

    function _doTestModeSwap(SwapIntent calldata intent, uint256 amount) internal returns (uint256 amountOut) {
        uint256 fee = (amount * swapFeeBps) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        uint8 decimalsIn = _getDecimals(intent.tokenIn);
        uint8 decimalsOut = _getDecimals(intent.tokenOut);
        
        if (decimalsOut >= decimalsIn) {
            amountOut = amountAfterFee * (10 ** (decimalsOut - decimalsIn));
        } else {
            amountOut = amountAfterFee / (10 ** (decimalsIn - decimalsOut));
        }
        
        uint256 tokenOutBalance = IERC20(intent.tokenOut).balanceOf(address(this));
        
        if (tokenOutBalance >= amountOut) {
            IERC20(intent.tokenOut).safeTransfer(intent.user, amountOut);
        } else if (intent.tokenIn == intent.tokenOut) {
            IERC20(intent.tokenIn).safeTransfer(intent.user, amountAfterFee);
            amountOut = amountAfterFee;
        } else {
            revert("Test mode: No tokenOut liquidity");
        }
        
        if (fee > 0 && feeRecipient != address(0)) {
            IERC20(intent.tokenIn).safeTransfer(feeRecipient, fee);
        }
    }

    function _getDecimals(address token) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            return 18;
        }
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature v");
        
        return ecrecover(digest, v, r, s);
    }

    // ============================================
    // Admin Functions
    // ============================================

    function setTreasury(address _treasury) external onlyOwner {
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setGaslessFeeConfig(uint256 _maxFeePercent, bool _enabled) external onlyOwner {
        require(_maxFeePercent <= 500, "Max 5%"); // Safety cap
        maxGaslessFeePercent = _maxFeePercent;
        gaslessFeeEnabled = _enabled;
        emit GaslessFeeConfigUpdated(_maxFeePercent, _enabled);
    }

    function setAdapters(address _primary, address _fallback) external onlyOwner {
        primaryAdapter = _primary;
        fallbackAdapter = _fallback;
        emit AdaptersConfigured(_primary, _fallback);
    }

    function setDexAdapter(address _adapter) external onlyOwner {
        dexAdapter = _adapter;
    }

    function setFeeConfig(uint256 _feeBps, address _feeRecipient) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        swapFeeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    function setTestMode(bool _enabled) external onlyOwner {
        testMode = _enabled;
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function addTestLiquidity(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    // ============================================
    // View Functions
    // ============================================

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function getChainId() external view returns (uint256) {
        return block.chainid;
    }

    function getGaslessFeeConfig() external view returns (uint256 maxPercent, bool enabled, address treasuryAddr) {
        return (maxGaslessFeePercent, gaslessFeeEnabled, treasury);
    }
}
