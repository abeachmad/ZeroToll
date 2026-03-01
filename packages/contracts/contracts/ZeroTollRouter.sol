// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZeroTollRouter
 * @notice Intent-based gasless swap router following Solution.md architecture
 * @dev User signs EIP-712 SwapIntent + optional Permit, relayer submits, contract verifies
 */
contract ZeroTollRouter is Ownable, ReentrancyGuard {
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
    
    mapping(address => uint256) public nonces;
    
    // DEX adapter for actual swaps
    address public dexAdapter;
    
    // Fee configuration
    uint256 public feeBps = 50; // 0.5%
    address public feeRecipient;

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 nonce
    );
    
    event DexAdapterSet(address indexed adapter);
    event FeeConfigSet(uint256 feeBps, address feeRecipient);

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
     * @notice Execute a swap with permit (fully gasless for user)
     * @param intent The swap intent signed by the user
     * @param userSignature The EIP-712 signature for the intent
     * @param permitDeadline Deadline for the permit
     * @param permitV V component of permit signature
     * @param permitR R component of permit signature
     * @param permitS S component of permit signature
     */
    function executeSwapWithPermit(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 permitDeadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external nonReentrant returns (uint256 amountOut) {
        // Execute permit first (gasless approval)
        try IERC20Permit(intent.tokenIn).permit(
            intent.user,
            address(this),
            intent.amountIn,
            permitDeadline,
            permitV,
            permitR,
            permitS
        ) {} catch {
            // Permit may have already been used or token doesn't support it
            // Continue anyway - will fail at transferFrom if no allowance
        }

        // Then execute the swap
        return _executeSwapInternal(intent, userSignature);
    }

    /**
     * @notice Execute a swap based on a signed intent (requires prior approval)
     * @param intent The swap intent signed by the user
     * @param userSignature The EIP-712 signature from the user
     */
    function executeSwap(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) external nonReentrant returns (uint256 amountOut) {
        return _executeSwapInternal(intent, userSignature);
    }

    /**
     * @notice Internal swap execution logic
     */
    function _executeSwapInternal(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) internal returns (uint256 amountOut) {
        // Validate intent
        require(block.timestamp <= intent.deadline, "Intent expired");
        require(intent.user != address(0), "Invalid user");
        require(intent.nonce == nonces[intent.user], "Invalid nonce");
        require(intent.amountIn > 0, "Invalid amount");

        // Verify signature
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

        // Increment nonce to prevent replay
        nonces[intent.user]++;

        // Pull tokens from user
        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);

        // Execute swap
        amountOut = _doSwap(intent);
        
        require(amountOut >= intent.minAmountOut, "Slippage exceeded");

        emit SwapExecuted(
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut,
            intent.nonce - 1
        );
    }

    /**
     * @notice Internal swap logic - uses DEX adapter or mock swap
     */
    function _doSwap(SwapIntent calldata intent) internal returns (uint256 amountOut) {
        if (dexAdapter != address(0)) {
            // Use DEX adapter
            IERC20(intent.tokenIn).safeTransfer(dexAdapter, intent.amountIn);
            
            // Call adapter swap function
            (bool success, bytes memory result) = dexAdapter.call(
                abi.encodeWithSignature(
                    "swap(address,address,uint256,uint256,address)",
                    intent.tokenIn,
                    intent.tokenOut,
                    intent.amountIn,
                    intent.minAmountOut,
                    intent.user
                )
            );
            
            if (success && result.length >= 32) {
                amountOut = abi.decode(result, (uint256));
            } else {
                revert("Adapter swap failed");
            }
        } else {
            // Mock swap for testing: 1:1 ratio minus fee
            uint256 fee = (intent.amountIn * feeBps) / 10000;
            amountOut = intent.amountIn - fee;
            
            // Transfer fee if configured
            if (fee > 0 && feeRecipient != address(0)) {
                IERC20(intent.tokenIn).safeTransfer(feeRecipient, fee);
            }
            
            // For mock: assume we have tokenOut liquidity or it's same token
            // In production, this would go through a real DEX
            // For demo, just transfer tokenIn back as tokenOut (simulated swap)
            IERC20(intent.tokenIn).safeTransfer(intent.user, amountOut);
        }
    }

    /**
     * @notice Recover signer from signature
     */
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

    function setFeeConfig(uint256 _feeBps, address _feeRecipient) external onlyOwner {
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        emit FeeConfigSet(_feeBps, _feeRecipient);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
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
}
