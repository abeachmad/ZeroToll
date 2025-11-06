// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBridgeAdapter
 * @notice Standard interface for cross-chain bridge adapters
 * @dev Supports Polygon PoS Bridge, Arbitrum Bridge, Optimism Standard Bridge, etc.
 */
interface IBridgeAdapter {
    /**
     * @notice Emitted when tokens are bridged to another chain
     * @param sender Address initiating the bridge
     * @param token Token address being bridged
     * @param amount Amount of tokens bridged
     * @param toChainId Destination chain ID
     * @param recipient Recipient address on destination chain
     * @param bridgeTxId Unique bridge transaction identifier
     */
    event TokensBridged(
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint256 toChainId,
        address recipient,
        bytes32 bridgeTxId
    );

    /**
     * @notice Bridge tokens from current chain to destination chain
     * @param token Address of token to bridge (address(0) for native token)
     * @param amount Amount to bridge
     * @param toChainId Destination chain ID (e.g., 1 for Ethereum, 137 for Polygon)
     * @param recipient Recipient address on destination chain
     * @param extraData Bridge-specific parameters (deadline, slippage, relayer fee, etc.)
     * @return bridgeTxId Unique identifier for tracking bridge transaction
     */
    function bridge(
        address token,
        uint256 amount,
        uint256 toChainId,
        address recipient,
        bytes calldata extraData
    ) external payable returns (bytes32 bridgeTxId);

    /**
     * @notice Estimate the cost of bridging (in native token)
     * @param token Token to bridge
     * @param amount Amount to bridge
     * @param toChainId Destination chain ID
     * @return estimatedCost Bridge fee in native token (ETH/POL/etc.)
     */
    function estimateBridgeFee(
        address token,
        uint256 amount,
        uint256 toChainId
    ) external view returns (uint256 estimatedCost);

    /**
     * @notice Estimate time for bridge completion
     * @param toChainId Destination chain ID
     * @return estimatedSeconds Estimated completion time in seconds
     */
    function estimatedBridgeTime(uint256 toChainId)
        external
        pure
        returns (uint256 estimatedSeconds);

    /**
     * @notice Check if bridge supports a specific token and chain pair
     * @param token Token address to check
     * @param toChainId Destination chain ID
     * @return supported True if bridge supports this route
     */
    function supportsRoute(address token, uint256 toChainId)
        external
        view
        returns (bool supported);

    /**
     * @notice Get bridge protocol name
     * @return name Human-readable bridge name (e.g., "Polygon PoS Bridge")
     */
    function bridgeName() external pure returns (string memory name);

    /**
     * @notice Get destination chain's native token wrapper address
     * @param toChainId Destination chain ID
     * @return wrapperAddress Address of WETH/WPOL on destination chain
     */
    function getDestinationWrapper(uint256 toChainId)
        external
        view
        returns (address wrapperAddress);
}
