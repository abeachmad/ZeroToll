// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockLayerZeroAdapter
 * @notice Mock cross-chain bridge adapter for testnet demonstration
 * @dev Simulates LayerZero cross-chain messaging pattern
 * 
 * This adapter demonstrates the cross-chain swap architecture:
 * 1. Source chain: Locks tokens and emits CrossChainSwapInitiated event
 * 2. Off-chain relayer: Monitors events and calls receiveMessage on dst chain
 * 3. Destination chain: Executes swap and delivers tokens to user
 * 
 * For production, replace with actual LayerZero integration
 */
contract MockLayerZeroAdapter is Ownable {
    using SafeERC20 for IERC20;

    // Peer adapters on other chains
    mapping(uint256 => address) public peers;
    
    // Processed message hashes (prevent replay)
    mapping(bytes32 => bool) public processedMessages;
    
    // DEX adapter for swaps
    address public dexAdapter;
    
    // Price oracle for cross-chain pricing
    address public priceOracle;

    // Cross-chain message structure
    struct CrossChainMessage {
        uint256 srcChainId;
        uint256 dstChainId;
        address user;
        address srcToken;
        uint256 srcAmount;
        address dstToken;
        uint256 minDstAmount;
        uint64 deadline;
        uint256 nonce;
    }

    // Events for cross-chain coordination
    event CrossChainSwapInitiated(
        bytes32 indexed messageHash,
        uint256 indexed srcChainId,
        uint256 indexed dstChainId,
        address user,
        address srcToken,
        uint256 srcAmount,
        address dstToken,
        uint256 minDstAmount,
        uint64 deadline,
        uint256 nonce
    );

    event CrossChainSwapExecuted(
        bytes32 indexed messageHash,
        address indexed user,
        address dstToken,
        uint256 dstAmount
    );

    event CrossChainSwapFailed(
        bytes32 indexed messageHash,
        address indexed user,
        string reason
    );

    event PeerSet(uint256 indexed chainId, address peer);

    error InvalidPeer();
    error MessageAlreadyProcessed();
    error DeadlineExpired();
    error InsufficientLiquidity();
    error SlippageExceeded();

    constructor(address _dexAdapter, address _priceOracle) Ownable(msg.sender) {
        dexAdapter = _dexAdapter;
        priceOracle = _priceOracle;
    }

    /**
     * @notice Set peer adapter on another chain
     * @param _chainId Chain ID
     * @param _peer Peer adapter address
     */
    function setPeer(uint256 _chainId, address _peer) external onlyOwner {
        peers[_chainId] = _peer;
        emit PeerSet(_chainId, _peer);
    }

    /**
     * @notice Update DEX adapter
     */
    function setDexAdapter(address _dexAdapter) external onlyOwner {
        dexAdapter = _dexAdapter;
    }

    /**
     * @notice Initiate cross-chain swap (SOURCE CHAIN)
     * @dev Called by RouterHub. Locks tokens and emits event for relayer
     * @param tokenIn Input token
     * @param amountIn Amount to bridge
     * @param dstChainId Destination chain ID
     * @param dstToken Token to receive on destination
     * @param minDstAmount Minimum amount on destination
     * @param user Recipient address
     * @param deadline Swap deadline
     */
    function bridgeAndSwap(
        address tokenIn,
        uint256 amountIn,
        uint256 dstChainId,
        address dstToken,
        uint256 minDstAmount,
        address user,
        uint64 deadline
    ) external returns (bytes32 messageHash) {
        require(peers[dstChainId] != address(0), "No peer on destination");
        require(block.timestamp <= deadline, "Deadline expired");

        // Pull tokens from caller (RouterHub)
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Generate unique message hash
        uint256 nonce = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.number,
            msg.sender,
            amountIn
        )));

        messageHash = keccak256(abi.encodePacked(
            block.chainid,
            dstChainId,
            user,
            tokenIn,
            amountIn,
            dstToken,
            minDstAmount,
            deadline,
            nonce
        ));

        // Emit event for off-chain relayer to pick up
        emit CrossChainSwapInitiated(
            messageHash,
            block.chainid,
            dstChainId,
            user,
            tokenIn,
            amountIn,
            dstToken,
            minDstAmount,
            deadline,
            nonce
        );

        return messageHash;
    }

    /**
     * @notice Execute cross-chain swap (DESTINATION CHAIN)
     * @dev Called by relayer after detecting CrossChainSwapInitiated event
     * @param message The cross-chain message
     * @param signature Relayer signature (for production security)
     */
    function receiveMessage(
        CrossChainMessage calldata message,
        bytes calldata signature
    ) external {
        // Verify peer exists
        require(peers[message.srcChainId] != address(0), "Unknown source chain");

        // Calculate message hash
        bytes32 messageHash = keccak256(abi.encodePacked(
            message.srcChainId,
            message.dstChainId,
            message.user,
            message.srcToken,
            message.srcAmount,
            message.dstToken,
            message.minDstAmount,
            message.deadline,
            message.nonce
        ));

        // Prevent replay
        if (processedMessages[messageHash]) revert MessageAlreadyProcessed();
        processedMessages[messageHash] = true;

        // Check deadline
        if (block.timestamp > message.deadline) {
            emit CrossChainSwapFailed(messageHash, message.user, "Deadline expired");
            revert DeadlineExpired();
        }

        // For production: verify signature from trusted relayer
        // For testnet demo: skip signature verification
        (signature); // Silence unused variable warning

        // Execute swap on destination chain
        _executeDestinationSwap(messageHash, message);
    }

    /**
     * @notice Execute swap on destination chain
     */
    function _executeDestinationSwap(
        bytes32 messageHash,
        CrossChainMessage calldata message
    ) internal {
        // Check adapter has liquidity
        uint256 adapterBalance = IERC20(message.dstToken).balanceOf(address(this));
        
        // Calculate output amount using oracle pricing
        uint256 outputAmount = _calculateOutput(
            message.srcToken,
            message.srcAmount,
            message.dstToken
        );

        // Check slippage
        if (outputAmount < message.minDstAmount) {
            emit CrossChainSwapFailed(messageHash, message.user, "Slippage exceeded");
            revert SlippageExceeded();
        }

        // Check liquidity
        if (adapterBalance < outputAmount) {
            emit CrossChainSwapFailed(messageHash, message.user, "Insufficient liquidity");
            revert InsufficientLiquidity();
        }

        // Transfer tokens to user
        IERC20(message.dstToken).safeTransfer(message.user, outputAmount);

        emit CrossChainSwapExecuted(
            messageHash,
            message.user,
            message.dstToken,
            outputAmount
        );
    }

    /**
     * @notice Calculate output amount using oracle
     * @dev For testnet, uses simplified pricing
     */
    function _calculateOutput(
        address srcToken,
        uint256 srcAmount,
        address dstToken
    ) internal view returns (uint256) {
        // For testnet demo: use mock pricing
        // In production: integrate with Pyth/Chainlink oracle
        
        if (priceOracle != address(0)) {
            // Try to get prices from oracle
            try IMockPriceOracle(priceOracle).getPrice(srcToken) returns (uint256 srcPrice) {
                try IMockPriceOracle(priceOracle).getPrice(dstToken) returns (uint256 dstPrice) {
                    if (srcPrice > 0 && dstPrice > 0) {
                        // Calculate: (srcAmount * srcPrice) / dstPrice
                        // Adjust for decimals (assuming 8 decimal prices)
                        return (srcAmount * srcPrice) / dstPrice;
                    }
                } catch {}
            } catch {}
        }
        
        // Fallback: 1:1 ratio (for demo)
        return srcAmount;
    }

    /**
     * @notice Fund adapter with destination tokens
     * @param token Token to fund
     * @param amount Amount to fund
     */
    function fundAdapter(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Withdraw tokens from adapter
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function withdrawFunds(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Get adapter balance for a token
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    receive() external payable {}
}

interface IMockPriceOracle {
    function getPrice(address token) external view returns (uint256);
}
