// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IWETH
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/**
 * @title IZeroTollRouter
 */
interface IZeroTollRouter {
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
    
    function executeSwap(SwapIntent calldata intent, bytes calldata userSignature) external returns (uint256);
}

/**
 * @title ETHSwapRouter
 * @notice Enables gasless ETH swaps by wrapping ETH to WETH automatically
 * @dev User sends ETH + signature, relayer wraps and swaps
 */
contract ETHSwapRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWETH public immutable weth;
    IZeroTollRouter public immutable router;

    // EIP-712 domain
    bytes32 public DOMAIN_SEPARATOR;
    
    bytes32 public constant ETH_SWAP_TYPEHASH = keccak256(
        "ETHSwapIntent(address user,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
    );

    mapping(address => uint256) public nonces;

    event ETHSwapExecuted(
        address indexed user,
        address indexed tokenOut,
        uint256 ethIn,
        uint256 amountOut
    );

    constructor(address _weth, address _router) Ownable(msg.sender) {
        weth = IWETH(_weth);
        router = IZeroTollRouter(_router);

        uint256 chainId;
        assembly { chainId := chainid() }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ETHSwapRouter")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );

        // Approve router to spend WETH
        weth.approve(address(router), type(uint256).max);
    }

    /**
     * @notice Execute ETH swap - user sends ETH, gets tokenOut
     * @dev No approval needed! ETH is wrapped to WETH automatically
     * @param tokenOut Output token address
     * @param minAmountOut Minimum output amount
     * @param deadline Transaction deadline
     * @param userSignature EIP-712 signature from user
     */
    function swapETHForToken(
        address tokenOut,
        uint256 minAmountOut,
        uint256 deadline,
        bytes calldata userSignature
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(msg.value > 0, "No ETH sent");
        require(block.timestamp <= deadline, "Expired");

        // Verify signature
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        ETH_SWAP_TYPEHASH,
                        msg.sender,
                        tokenOut,
                        msg.value,
                        minAmountOut,
                        deadline,
                        nonces[msg.sender],
                        block.chainid
                    )
                )
            )
        );

        address signer = _recover(digest, userSignature);
        require(signer == msg.sender, "Invalid signature");

        nonces[msg.sender]++;

        // Wrap ETH to WETH
        weth.deposit{value: msg.value}();

        // Build swap intent
        IZeroTollRouter.SwapIntent memory intent = IZeroTollRouter.SwapIntent({
            user: address(this), // Router is the user for the underlying swap
            tokenIn: address(weth),
            tokenOut: tokenOut,
            amountIn: msg.value,
            minAmountOut: minAmountOut,
            deadline: deadline,
            nonce: 0, // Not used for internal calls
            chainId: block.chainid
        });

        // Execute swap (this contract has WETH, no approval needed)
        // Note: For this to work, router needs to accept calls from this contract
        // Alternative: Transfer WETH to user, let them sign
        
        // For simplicity, we'll do a direct transfer approach
        // The router will pull WETH from this contract
        amountOut = _executeSwapDirect(tokenOut, msg.value, minAmountOut, msg.sender);

        emit ETHSwapExecuted(msg.sender, tokenOut, msg.value, amountOut);
    }

    /**
     * @notice Direct swap execution (simplified)
     */
    function _executeSwapDirect(
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        // For now, use internal liquidity (simplified)
        // In production, this would call the DEX adapter
        
        uint256 tokenOutBalance = IERC20(tokenOut).balanceOf(address(this));
        require(tokenOutBalance >= minAmountOut, "Insufficient liquidity");
        
        // Simple 1:1 swap minus 0.5% fee
        amountOut = (amountIn * 995) / 1000;
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }

    // Admin functions
    function addLiquidity(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdrawLiquidity(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
