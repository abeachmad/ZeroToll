// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/IBridgeAdapter.sol";

/**
 * @title MockBridgeAdapter
 * @notice Mock bridge adapter for testnet demonstrations
 * @dev Simulates cross-chain bridging without actual L1↔L2 messaging
 * 
 * WARNING: FOR TESTNET DEMO ONLY! Does not perform real bridging.
 * In production, use PolygonPOSAdapter, ArbitrumBridgeAdapter, etc.
 */
contract MockBridgeAdapter is IBridgeAdapter {
    using SafeERC20 for IERC20;

    address public immutable owner;

    // Mock bridge fee (in native token wei)
    uint256 public constant MOCK_BRIDGE_FEE = 0.001 ether;

    // Mock completion time (in seconds)
    uint256 public constant MOCK_COMPLETION_TIME = 300; // 5 minutes

    // Supported chains (testnet chain IDs)
    mapping(uint256 => bool) public supportedChains;

    // Supported tokens
    mapping(address => bool) public supportedTokens;

    // Simulated bridge transactions (for demo tracking)
    mapping(bytes32 => BridgeTransaction) public transactions;

    struct BridgeTransaction {
        address sender;
        address token;
        uint256 amount;
        uint256 fromChainId;
        uint256 toChainId;
        address recipient;
        uint256 timestamp;
        bool completed;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;

        // Add testnet chains
        supportedChains[11155111] = true; // Sepolia
        supportedChains[80002] = true; // Amoy
        supportedChains[421614] = true; // Arbitrum Sepolia
        supportedChains[11155420] = true; // Optimism Sepolia
    }

    /**
     * @notice Add supported token
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }

    /**
     * @notice Add supported chain
     */
    function addSupportedChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = true;
    }

    /**
     * @inheritdoc IBridgeAdapter
     * @dev Simulates bridge by locking tokens and emitting event
     */
    function bridge(
        address token,
        uint256 amount,
        uint256 toChainId,
        address recipient,
        bytes calldata /* extraData */
    ) external payable override returns (bytes32 bridgeTxId) {
        require(supportedChains[toChainId], "Chain not supported");
        require(
            token == address(0) || supportedTokens[token],
            "Token not supported"
        );
        require(amount > 0, "Amount must be > 0");
        require(msg.value >= MOCK_BRIDGE_FEE, "Insufficient bridge fee");

        // Generate bridge transaction ID
        bridgeTxId = keccak256(
            abi.encodePacked(
                msg.sender,
                token,
                amount,
                block.chainid,
                toChainId,
                recipient,
                block.timestamp
            )
        );

        // Handle token transfer
        if (token == address(0)) {
            // Native token: msg.value should include amount + bridge fee
            require(
                msg.value >= amount + MOCK_BRIDGE_FEE,
                "Insufficient ETH sent"
            );
        } else {
            // ERC20: transfer to this contract (locked)
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Store mock transaction
        transactions[bridgeTxId] = BridgeTransaction({
            sender: msg.sender,
            token: token,
            amount: amount,
            fromChainId: block.chainid,
            toChainId: toChainId,
            recipient: recipient,
            timestamp: block.timestamp,
            completed: false
        });

        emit TokensBridged(
            msg.sender,
            token,
            amount,
            toChainId,
            recipient,
            bridgeTxId
        );

        return bridgeTxId;
    }

    /**
     * @inheritdoc IBridgeAdapter
     */
    function estimateBridgeFee(
        address /* token */,
        uint256 /* amount */,
        uint256 toChainId
    ) external view override returns (uint256 estimatedCost) {
        require(supportedChains[toChainId], "Chain not supported");
        return MOCK_BRIDGE_FEE;
    }

    /**
     * @inheritdoc IBridgeAdapter
     */
    function estimatedBridgeTime(uint256 toChainId)
        external
        pure
        override
        returns (uint256 estimatedSeconds)
    {
        // Mock different completion times based on chain
        if (toChainId == 11155111 || toChainId == 80002) {
            return MOCK_COMPLETION_TIME; // 5 minutes for L1↔L2
        } else {
            return 60; // 1 minute for L2↔L2 (would use real bridge in prod)
        }
    }

    /**
     * @inheritdoc IBridgeAdapter
     */
    function supportsRoute(address token, uint256 toChainId)
        external
        view
        override
        returns (bool supported)
    {
        return
            supportedChains[toChainId] &&
            (token == address(0) || supportedTokens[token]);
    }

    /**
     * @inheritdoc IBridgeAdapter
     */
    function bridgeName() external pure override returns (string memory) {
        return "MockBridge (Testnet Only)";
    }

    /**
     * @inheritdoc IBridgeAdapter
     */
    function getDestinationWrapper(uint256 toChainId)
        external
        pure
        override
        returns (address wrapperAddress)
    {
        // Return known WETH/WPOL addresses for testnets
        if (toChainId == 11155111) {
            // Sepolia WETH
            return 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
        } else if (toChainId == 80002) {
            // Amoy WPOL
            return 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9;
        } else if (toChainId == 421614) {
            // Arbitrum Sepolia WETH
            return 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73;
        } else if (toChainId == 11155420) {
            // Optimism Sepolia WETH
            return 0x4200000000000000000000000000000000000006;
        }

        return address(0);
    }

    /**
     * @notice Mock function to "complete" a bridge transaction (testnet only)
     * @dev In production, this would be called by bridge relayers
     */
    function mockCompleteBridge(bytes32 bridgeTxId) external onlyOwner {
        BridgeTransaction storage txn = transactions[bridgeTxId];
        require(txn.amount > 0, "Transaction not found");
        require(!txn.completed, "Already completed");

        txn.completed = true;

        // In real bridge, tokens would be minted/released on destination chain
        // For mock, we just mark as completed
    }

    /**
     * @notice Get bridge transaction details
     */
    function getBridgeTransaction(bytes32 bridgeTxId)
        external
        view
        returns (BridgeTransaction memory)
    {
        return transactions[bridgeTxId];
    }

    /**
     * @notice Withdraw locked funds (emergency only)
     */
    function emergencyWithdraw(address token, uint256 amount)
        external
        onlyOwner
    {
        if (token == address(0)) {
            (bool success, ) = owner.call{value: amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }

    // Allow receiving ETH
    receive() external payable {}
}
