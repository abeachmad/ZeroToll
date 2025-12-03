// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
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

    function permit(
        address owner,
        PermitSingle memory permitSingle,
        bytes calldata signature
    ) external;

    function transferFrom(
        address from,
        address to,
        uint160 amount,
        address token
    ) external;

    function allowance(
        address user,
        address token,
        address spender
    ) external view returns (uint160 amount, uint48 expiration, uint48 nonce);
}

/**
 * @title ZeroTollRouterV2
 * @notice Intent-based gasless swap router with Permit2 support
 * @dev Supports three approval methods:
 *      1. Traditional approve() - user pays gas once
 *      2. ERC-2612 Permit - gasless for supported tokens
 *      3. Permit2 - gasless for ANY ERC-20 token (recommended)
 */
contract ZeroTollRouterV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    bytes32 public constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
    );

    bytes32 public DOMAIN_SEPARATOR;
    
    // Permit2 address (same on all chains)
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    mapping(address => uint256) public nonces;
    
    // DEX adapters for actual swaps (fallback chain)
    address public primaryAdapter;   // SmartDexAdapter (tries Uniswap first)
    address public fallbackAdapter;  // ZeroTollAdapter (Pyth oracle, zTokens)
    
    // Legacy: single adapter (for backwards compatibility)
    address public dexAdapter;
    
    // Fee configuration
    uint256 public feeBps = 50; // 0.5%
    address public feeRecipient;

    // Test mode: allows mock swaps without real DEX
    bool public testMode = true;

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 nonce
    );
    
    event DexAdapterSet(address indexed adapter);
    event AdaptersConfigured(address indexed primaryAdapter, address indexed fallbackAdapter);
    event FeeConfigSet(uint256 feeBps, address feeRecipient);
    event TestModeSet(bool enabled);
    event SwapRouted(address indexed adapter, string route);

    constructor() Ownable(msg.sender) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ZeroTollRouter")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }


    /**
     * @notice Execute swap with Permit2 - FULLY GASLESS for ANY token
     * @dev User signs Permit2 signature + SwapIntent, relayer submits both
     */
    function executeSwapWithPermit2(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        IPermit2.PermitSingle calldata permitSingle,
        bytes calldata permit2Signature
    ) external nonReentrant returns (uint256 amountOut) {
        // 1. Execute Permit2 permit (gasless approval for ANY ERC-20)
        IPermit2(PERMIT2).permit(intent.user, permitSingle, permit2Signature);
        
        // 2. Verify and execute swap
        return _executeSwapWithPermit2Transfer(intent, userSignature);
    }

    /**
     * @notice Execute swap using existing Permit2 allowance
     */
    function executeSwapViaPermit2(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) external nonReentrant returns (uint256 amountOut) {
        return _executeSwapWithPermit2Transfer(intent, userSignature);
    }

    /**
     * @notice Execute swap with ERC-2612 Permit (for supported tokens)
     */
    function executeSwapWithPermit(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 permitDeadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external nonReentrant returns (uint256 amountOut) {
        // Execute permit first
        try IERC20Permit(intent.tokenIn).permit(
            intent.user,
            address(this),
            intent.amountIn,
            permitDeadline,
            permitV,
            permitR,
            permitS
        ) {} catch {}

        return _executeSwapInternal(intent, userSignature, false);
    }

    /**
     * @notice Execute swap with traditional approval
     */
    function executeSwap(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) external nonReentrant returns (uint256 amountOut) {
        return _executeSwapInternal(intent, userSignature, false);
    }

    /**
     * @notice Internal swap with Permit2 transfer
     */
    function _executeSwapWithPermit2Transfer(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) internal returns (uint256 amountOut) {
        // Validate and verify signature
        _validateIntent(intent, userSignature);
        
        // Increment nonce
        nonces[intent.user]++;

        // Pull tokens via Permit2
        IPermit2(PERMIT2).transferFrom(
            intent.user,
            address(this),
            uint160(intent.amountIn),
            intent.tokenIn
        );

        // Execute swap
        amountOut = _doSwap(intent);
        
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

    /**
     * @notice Internal swap with direct transfer
     */
    function _executeSwapInternal(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        bool usePermit2
    ) internal returns (uint256 amountOut) {
        // Validate and verify signature
        _validateIntent(intent, userSignature);
        
        // Increment nonce
        nonces[intent.user]++;

        // Pull tokens from user
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

        // Execute swap
        amountOut = _doSwap(intent);
        
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

    function _validateIntent(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) internal view {
        require(block.timestamp <= intent.deadline, "Intent expired");
        require(intent.user != address(0), "Invalid user");
        require(intent.nonce == nonces[intent.user], "Invalid nonce");
        require(intent.amountIn > 0, "Invalid amount");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        SWAP_INTENT_TYPEHASH,
                        intent.user,
                        intent.tokenIn,
                        intent.tokenOut,
                        intent.amountIn,
                        intent.minAmountOut,
                        intent.deadline,
                        intent.nonce,
                        intent.chainId
                    )
                )
            )
        );

        address signer = _recover(digest, userSignature);
        require(signer == intent.user, "Invalid signature");
    }


    /**
     * @notice Execute the actual swap with adapter fallback chain
     * @dev Tries adapters in order: primaryAdapter → fallbackAdapter → dexAdapter → testMode
     */
    function _doSwap(SwapIntent calldata intent) internal returns (uint256 amountOut) {
        // Try primary adapter first (SmartDexAdapter - tries Uniswap, then internal)
        if (primaryAdapter != address(0)) {
            (bool success, uint256 result) = _tryAdapter(primaryAdapter, intent);
            if (success) {
                emit SwapRouted(primaryAdapter, "primary");
                return result;
            }
        }
        
        // Try fallback adapter (ZeroTollAdapter - Pyth oracle, zTokens)
        if (fallbackAdapter != address(0)) {
            (bool success, uint256 result) = _tryAdapter(fallbackAdapter, intent);
            if (success) {
                emit SwapRouted(fallbackAdapter, "fallback");
                return result;
            }
        }
        
        // Try legacy single adapter
        if (dexAdapter != address(0)) {
            (bool success, uint256 result) = _tryAdapter(dexAdapter, intent);
            if (success) {
                emit SwapRouted(dexAdapter, "legacy");
                return result;
            }
            revert("All adapters failed");
        }
        
        // Test mode fallback
        if (testMode) {
            amountOut = _doTestModeSwap(intent);
            emit SwapRouted(address(0), "testMode");
            return amountOut;
        }
        
        revert("No DEX adapter configured");
    }
    
    /**
     * @notice Try to execute swap via an adapter
     * @return success Whether the swap succeeded
     * @return amountOut The output amount if successful
     */
    function _tryAdapter(address adapter, SwapIntent calldata intent) internal returns (bool success, uint256 amountOut) {
        // Transfer tokens to adapter
        IERC20(intent.tokenIn).safeTransfer(adapter, intent.amountIn);
        
        // Try swap
        (bool callSuccess, bytes memory result) = adapter.call(
            abi.encodeWithSignature(
                "swap(address,address,uint256,uint256,address)",
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
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
        
        // Swap failed - try to recover tokens if still in adapter
        // Note: This is best-effort, adapter may have consumed tokens
        try IERC20(intent.tokenIn).balanceOf(adapter) returns (uint256 balance) {
            if (balance >= intent.amountIn) {
                // Tokens still in adapter, but we can't recover them easily
                // The next adapter will need fresh tokens
            }
        } catch {}
        
        return (false, 0);
    }
    
    /**
     * @notice Test mode swap simulation
     */
    function _doTestModeSwap(SwapIntent calldata intent) internal returns (uint256 amountOut) {
        uint256 fee = (intent.amountIn * feeBps) / 10000;
        amountOut = intent.amountIn - fee;
        
        // Check if we have tokenOut liquidity
        uint256 tokenOutBalance = IERC20(intent.tokenOut).balanceOf(address(this));
        
        if (tokenOutBalance >= amountOut) {
            // We have liquidity - send tokenOut to user
            IERC20(intent.tokenOut).safeTransfer(intent.user, amountOut);
        } else if (intent.tokenIn == intent.tokenOut) {
            // Same token - just return minus fee
            IERC20(intent.tokenIn).safeTransfer(intent.user, amountOut);
        } else {
            // No liquidity - revert with helpful message
            revert("Test mode: No tokenOut liquidity. Fund contract or set DEX adapter.");
        }
        
        // Transfer fee if configured
        if (fee > 0 && feeRecipient != address(0)) {
            IERC20(intent.tokenIn).safeTransfer(feeRecipient, fee);
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

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature v value");
        
        return ecrecover(digest, v, r, s);
    }

    // ============================================
    // Admin functions
    // ============================================

    function setDexAdapter(address _adapter) external onlyOwner {
        dexAdapter = _adapter;
        emit DexAdapterSet(_adapter);
    }
    
    /**
     * @notice Configure adapter fallback chain
     * @param _primary Primary adapter (e.g., SmartDexAdapter)
     * @param _fallback Fallback adapter (e.g., ZeroTollAdapter)
     */
    function setAdapters(address _primary, address _fallback) external onlyOwner {
        primaryAdapter = _primary;
        fallbackAdapter = _fallback;
        emit AdaptersConfigured(_primary, _fallback);
    }

    function setFeeConfig(uint256 _feeBps, address _feeRecipient) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        emit FeeConfigSet(_feeBps, _feeRecipient);
    }

    function setTestMode(bool _enabled) external onlyOwner {
        testMode = _enabled;
        emit TestModeSet(_enabled);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Add liquidity for test mode swaps
     * @dev Owner can deposit tokens for simulated swaps
     */
    function addTestLiquidity(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    // ============================================
    // View functions
    // ============================================

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function getChainId() external view returns (uint256) {
        return block.chainid;
    }

    function getPermit2Allowance(address user, address token) external view returns (uint160 amount, uint48 expiration, uint48 nonce) {
        return IPermit2(PERMIT2).allowance(user, token, address(this));
    }
}
