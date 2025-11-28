// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LayerZeroBridgeAdapter
 * @notice Cross-chain bridge adapter using LayerZero V2 OApp pattern
 * @dev Inspired by SushiXSwap's Stargate adapter
 * 
 * Architecture:
 * 1. Source chain: User calls RouterHub.executeRoute() with this adapter
 * 2. This adapter sends cross-chain message via LayerZero
 * 3. Destination chain: lzReceive() is called, which executes the swap
 * 
 * For testnet demo, we use LayerZero's test endpoints
 */

// LayerZero V2 interfaces
interface ILayerZeroEndpointV2 {
    struct MessagingParams {
        uint32 dstEid;
        bytes32 receiver;
        bytes message;
        bytes options;
        bool payInLzToken;
    }

    struct MessagingFee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }

    struct MessagingReceipt {
        bytes32 guid;
        uint64 nonce;
        MessagingFee fee;
    }

    function send(
        MessagingParams calldata _params,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory);

    function quote(
        MessagingParams calldata _params,
        address _sender
    ) external view returns (MessagingFee memory);

    function setDelegate(address _delegate) external;
}

interface ILayerZeroReceiver {
    struct Origin {
        uint32 srcEid;
        bytes32 sender;
        uint64 nonce;
    }

    function lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable;
}

contract LayerZeroBridgeAdapter is Ownable, ILayerZeroReceiver {
    using SafeERC20 for IERC20;

    // LayerZero endpoint
    ILayerZeroEndpointV2 public immutable lzEndpoint;
    
    // Chain ID to LayerZero Endpoint ID mapping
    mapping(uint256 => uint32) public chainIdToEid;
    
    // Peer adapters on other chains (eid => adapter address as bytes32)
    mapping(uint32 => bytes32) public peers;
    
    // RouterHub on this chain
    address public routerHub;
    
    // DEX adapter for swaps on this chain
    address public dexAdapter;

    // Cross-chain swap payload structure
    struct CrossChainSwapPayload {
        address user;           // Final recipient
        address tokenOut;       // Token to receive on dst chain
        uint256 minAmountOut;   // Minimum output amount
        uint64 deadline;        // Swap deadline
        bytes swapData;         // Encoded swap data for dst chain
    }

    event CrossChainSwapInitiated(
        bytes32 indexed guid,
        uint32 dstEid,
        address indexed user,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 minAmountOut
    );

    event CrossChainSwapReceived(
        bytes32 indexed guid,
        uint32 srcEid,
        address indexed user,
        address tokenOut,
        uint256 amountOut
    );

    event PeerSet(uint32 indexed eid, bytes32 peer);

    error InvalidPeer();
    error OnlyEndpoint();
    error SwapFailed();
    error DeadlineExpired();

    constructor(
        address _lzEndpoint,
        address _routerHub,
        address _dexAdapter
    ) Ownable(msg.sender) {
        lzEndpoint = ILayerZeroEndpointV2(_lzEndpoint);
        routerHub = _routerHub;
        dexAdapter = _dexAdapter;
        
        // Set this contract as delegate for endpoint config
        lzEndpoint.setDelegate(address(this));
    }

    /**
     * @notice Set peer adapter on another chain
     * @param _eid LayerZero endpoint ID
     * @param _peer Peer adapter address (as bytes32)
     */
    function setPeer(uint32 _eid, bytes32 _peer) external onlyOwner {
        peers[_eid] = _peer;
        emit PeerSet(_eid, _peer);
    }

    /**
     * @notice Set chain ID to endpoint ID mapping
     * @param _chainId EVM chain ID
     * @param _eid LayerZero endpoint ID
     */
    function setChainIdToEid(uint256 _chainId, uint32 _eid) external onlyOwner {
        chainIdToEid[_chainId] = _eid;
    }

    /**
     * @notice Update RouterHub address
     */
    function setRouterHub(address _routerHub) external onlyOwner {
        routerHub = _routerHub;
    }

    /**
     * @notice Update DEX adapter address
     */
    function setDexAdapter(address _dexAdapter) external onlyOwner {
        dexAdapter = _dexAdapter;
    }

    /**
     * @notice Bridge tokens and swap on destination chain
     * @dev Called by RouterHub via adapter pattern
     * @param tokenIn Input token on source chain
     * @param amountIn Amount to bridge
     * @param dstChainId Destination chain ID
     * @param payload Encoded CrossChainSwapPayload
     */
    function bridge(
        address tokenIn,
        uint256 amountIn,
        uint256 dstChainId,
        bytes calldata payload
    ) external payable returns (uint256) {
        // Decode payload
        CrossChainSwapPayload memory swapPayload = abi.decode(
            payload,
            (CrossChainSwapPayload)
        );

        // Get destination endpoint ID
        uint32 dstEid = chainIdToEid[dstChainId];
        require(dstEid != 0, "Unsupported destination chain");
        require(peers[dstEid] != bytes32(0), "No peer on destination");

        // Pull tokens from caller (RouterHub)
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Encode message for destination chain
        bytes memory message = abi.encode(
            swapPayload.user,
            tokenIn,
            amountIn,
            swapPayload.tokenOut,
            swapPayload.minAmountOut,
            swapPayload.deadline,
            swapPayload.swapData
        );

        // Build LayerZero options (gas for destination execution)
        // Using 500k gas for swap execution
        bytes memory options = _buildOptions(500000);

        // Send cross-chain message
        ILayerZeroEndpointV2.MessagingParams memory params = ILayerZeroEndpointV2.MessagingParams({
            dstEid: dstEid,
            receiver: peers[dstEid],
            message: message,
            options: options,
            payInLzToken: false
        });

        ILayerZeroEndpointV2.MessagingReceipt memory receipt = lzEndpoint.send{value: msg.value}(
            params,
            msg.sender // Refund excess to caller
        );

        emit CrossChainSwapInitiated(
            receipt.guid,
            dstEid,
            swapPayload.user,
            tokenIn,
            amountIn,
            swapPayload.tokenOut,
            swapPayload.minAmountOut
        );

        // Return amount bridged (actual output will be on dst chain)
        return amountIn;
    }

    /**
     * @notice Quote the fee for cross-chain swap
     * @param dstChainId Destination chain ID
     * @param payload Encoded swap payload
     */
    function quoteFee(
        uint256 dstChainId,
        bytes calldata payload
    ) external view returns (uint256 nativeFee) {
        uint32 dstEid = chainIdToEid[dstChainId];
        require(dstEid != 0, "Unsupported destination chain");

        CrossChainSwapPayload memory swapPayload = abi.decode(
            payload,
            (CrossChainSwapPayload)
        );

        bytes memory message = abi.encode(
            swapPayload.user,
            address(0), // tokenIn placeholder
            uint256(0), // amountIn placeholder
            swapPayload.tokenOut,
            swapPayload.minAmountOut,
            swapPayload.deadline,
            swapPayload.swapData
        );

        bytes memory options = _buildOptions(500000);

        ILayerZeroEndpointV2.MessagingParams memory params = ILayerZeroEndpointV2.MessagingParams({
            dstEid: dstEid,
            receiver: peers[dstEid],
            message: message,
            options: options,
            payInLzToken: false
        });

        ILayerZeroEndpointV2.MessagingFee memory fee = lzEndpoint.quote(params, address(this));
        return fee.nativeFee;
    }

    /**
     * @notice Receive cross-chain message from LayerZero
     * @dev Called by LayerZero endpoint
     */
    function lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) external payable override {
        // Only endpoint can call
        if (msg.sender != address(lzEndpoint)) revert OnlyEndpoint();
        
        // Verify sender is a trusted peer
        if (peers[_origin.srcEid] != _origin.sender) revert InvalidPeer();

        // Decode message
        (
            address user,
            address tokenIn,
            uint256 amountIn,
            address tokenOut,
            uint256 minAmountOut,
            uint64 deadline,
            bytes memory swapData
        ) = abi.decode(_message, (address, address, uint256, address, uint256, uint64, bytes));

        // Check deadline
        if (block.timestamp > deadline) revert DeadlineExpired();

        // Execute swap on this chain
        // For testnet, we use MockDexAdapter which has liquidity
        uint256 amountOut = _executeSwap(
            tokenIn,
            amountIn,
            tokenOut,
            minAmountOut,
            user,
            deadline,
            swapData
        );

        emit CrossChainSwapReceived(
            _guid,
            _origin.srcEid,
            user,
            tokenOut,
            amountOut
        );
    }

    /**
     * @notice Execute swap on destination chain
     */
    function _executeSwap(
        address /*tokenIn*/,
        uint256 amountIn,
        address tokenOut,
        uint256 minAmountOut,
        address recipient,
        uint64 deadline,
        bytes memory /*swapData*/
    ) internal returns (uint256 amountOut) {
        // For testnet demo, we directly transfer from adapter's liquidity
        // In production, this would call the DEX adapter
        
        uint256 balance = IERC20(tokenOut).balanceOf(address(this));
        
        // Calculate output based on simple ratio (mock pricing)
        // In production, use actual DEX or oracle pricing
        amountOut = amountIn; // 1:1 for demo
        
        if (amountOut < minAmountOut) {
            amountOut = minAmountOut; // Ensure minimum
        }
        
        if (balance >= amountOut) {
            IERC20(tokenOut).safeTransfer(recipient, amountOut);
        } else {
            // Fallback: transfer whatever we have
            if (balance > 0) {
                IERC20(tokenOut).safeTransfer(recipient, balance);
            }
            amountOut = balance;
        }
        
        return amountOut;
    }

    /**
     * @notice Build LayerZero options for gas
     * @param _gas Gas limit for destination execution
     */
    function _buildOptions(uint128 _gas) internal pure returns (bytes memory) {
        // LayerZero V2 options format
        // Type 3 = lzReceive options
        // See: https://docs.layerzero.network/v2/developers/evm/protocol-gas-settings/options
        return abi.encodePacked(
            uint16(3),      // Options type
            uint8(1),       // Worker ID (executor)
            uint16(16 + 1), // Option length
            uint8(1),       // Option type (lzReceive)
            _gas            // Gas limit
        );
    }

    /**
     * @notice Fund adapter with tokens for destination swaps
     * @param token Token to fund
     * @param amount Amount to fund
     */
    function fundAdapter(address token, uint256 amount) external onlyOwner {
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
     * @notice Withdraw native tokens
     */
    function withdrawNative() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
