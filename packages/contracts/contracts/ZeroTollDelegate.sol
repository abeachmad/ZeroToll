// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface IZeroTollRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256);
}

/**
 * @title ZeroTollDelegate
 * @notice Delegate contract for EIP-7702 gasless swaps
 * @dev User's EOA temporarily delegates to this contract for a single transaction
 * 
 * Key Features:
 * - Gasless swaps via EIP-7702 delegation
 * - Native token output support (unwraps WETH/WPOL)
 * - EIP-712 intent verification
 * - Nonce-based replay protection
 * - 50% gas savings vs ERC-4337
 */
contract ZeroTollDelegate {
    using ECDSA for bytes32;
    
    // Special address for native token output
    address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    // Immutable addresses (set at deployment)
    address public immutable router;
    address public immutable treasury;
    address public immutable weth;  // WETH on Sepolia, WPOL on Amoy
    
    // Domain separator for EIP-712
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    // TypeHash for swap intent
    bytes32 public constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
    );
    
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
    
    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
    
    // Nonces for replay protection (per user)
    mapping(address => uint256) public nonces;
    
    // Events
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    
    event NonceIncremented(address indexed user, uint256 newNonce);
    
    constructor(address _router, address _treasury, address _weth) {
        require(_router != address(0), "Invalid router");
        require(_treasury != address(0), "Invalid treasury");
        require(_weth != address(0), "Invalid WETH");
        
        router = _router;
        treasury = _treasury;
        weth = _weth;
        
        // Build EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("ZeroTollDelegate"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }
    
    /**
     * @notice Execute gasless swap with permit
     * @dev Called via EIP-7702 delegation on user's EOA
     * 
     * Flow:
     * 1. Verify this is being called on the user's EOA via 7702
     * 2. Verify deadline and nonce
     * 3. Verify intent signature
     * 4. Execute permit (gasless approval)
     * 5. Transfer fee to treasury
     * 6. Execute swap via router
     * 7. If native output, unwrap WETH/WPOL
     * 
     * @param intent Swap intent signed by user
     * @param intentSignature User's signature on intent
     * @param permit Permit data for token approval
     * @param fee Fee amount to send to treasury
     * @return amountOut Amount of output token received
     */
    function execute(
        SwapIntent calldata intent,
        bytes calldata intentSignature,
        PermitData calldata permit,
        uint256 fee
    ) external returns (uint256 amountOut) {
        // 1. Verify this is being called on the user's EOA via 7702
        // When EIP-7702 is active, address(this) == user's EOA
        require(address(this) == intent.user, "Invalid delegation");
        
        // 2. Verify deadline
        require(block.timestamp <= intent.deadline, "Intent expired");
        
        // 3. Verify and increment nonce
        require(nonces[intent.user] == intent.nonce, "Invalid nonce");
        nonces[intent.user]++;
        emit NonceIncremented(intent.user, nonces[intent.user]);
        
        // 4. Verify intent signature (EIP-712)
        bytes32 structHash = keccak256(abi.encode(
            SWAP_INTENT_TYPEHASH,
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            intent.minAmountOut,
            intent.deadline,
            intent.nonce,
            intent.chainId
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = digest.recover(intentSignature);
        require(signer == intent.user, "Invalid signature");
        
        // 5. Execute permit (gasless approval)
        IERC20Permit(intent.tokenIn).permit(
            intent.user,
            address(this),
            intent.amountIn,
            permit.deadline,
            permit.v,
            permit.r,
            permit.s
        );
        
        // 6. Transfer tokens from user to this contract
        IERC20(intent.tokenIn).transferFrom(intent.user, address(this), intent.amountIn);
        
        // 7. Transfer fee to treasury
        if (fee > 0) {
            require(fee < intent.amountIn, "Fee too high");
            IERC20(intent.tokenIn).transfer(treasury, fee);
        }
        
        // 8. Approve router for swap amount
        uint256 swapAmount = intent.amountIn - fee;
        IERC20(intent.tokenIn).approve(router, swapAmount);
        
        // 9. Execute swap
        bool isNativeOut = intent.tokenOut == NATIVE || intent.tokenOut == weth;
        address actualTokenOut = isNativeOut ? weth : intent.tokenOut;
        
        amountOut = IZeroTollRouter(router).swap(
            intent.tokenIn,
            actualTokenOut,
            swapAmount,
            intent.minAmountOut
        );
        
        // 10. If native output, unwrap WETH/WPOL and keep in EOA
        if (isNativeOut && intent.tokenOut == NATIVE) {
            IWETH(weth).withdraw(amountOut);
            // Native token now in user's EOA (this contract via delegation)
            // No need to transfer - it's already here!
        } else {
            // Transfer ERC20 output to user
            IERC20(actualTokenOut).transfer(intent.user, amountOut);
        }
        
        emit SwapExecuted(
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut,
            fee
        );
        
        return amountOut;
    }
    
    /**
     * @notice Get current nonce for a user
     * @param user User address
     * @return Current nonce
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
    
    /**
     * @notice Compute EIP-712 digest for an intent
     * @param intent Swap intent
     * @return digest EIP-712 digest
     */
    function getIntentDigest(SwapIntent calldata intent) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            SWAP_INTENT_TYPEHASH,
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            intent.minAmountOut,
            intent.deadline,
            intent.nonce,
            intent.chainId
        ));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
    
    /**
     * @notice Receive native token (for WETH/WPOL unwrap)
     */
    receive() external payable {}
}
