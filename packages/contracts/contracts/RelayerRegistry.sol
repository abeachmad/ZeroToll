// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RelayerRegistry
 * @notice Manages decentralized relayer network for ZeroToll gasless swaps
 * @dev Implements staking, reputation, and slashing mechanisms
 * 
 * Features:
 * - Relayer registration with minimum stake
 * - Reputation tracking based on execution success
 * - Automatic slashing for failed executions
 * - Reward distribution for successful executions
 * - Maximum relayer limit to prevent centralization
 * 
 * Security:
 * - Only authorized executors can record executions
 * - Stake locked until unregistration
 * - Automatic deactivation if stake falls below minimum
 * - Reputation decay for inactive relayers
 */
contract RelayerRegistry {
    // ============ Constants ============
    
    /// @notice Minimum stake required to become a relayer (10 ETH/POL)
    uint256 public constant MIN_STAKE = 10 ether;
    
    /// @notice Maximum number of active relayers to prevent centralization
    uint256 public constant MAX_RELAYERS = 100;
    
    /// @notice Percentage of stake slashed for failed execution (10%)
    uint256 public constant SLASH_PERCENTAGE = 10;
    
    /// @notice Minimum reputation score (0-1000 scale)
    uint256 public constant MIN_REPUTATION = 500;
    
    /// @notice Time window for reputation decay (7 days)
    uint256 public constant REPUTATION_DECAY_WINDOW = 7 days;
    
    // ============ Structs ============
    
    struct Relayer {
        address relayerAddress;      // Relayer's address
        uint256 stake;               // Current stake amount
        uint256 reputation;          // Reputation score (0-1000)
        uint256 successfulExecutions; // Count of successful executions
        uint256 failedExecutions;    // Count of failed executions
        uint256 totalRewards;        // Total rewards earned
        uint256 registeredAt;        // Registration timestamp
        uint256 lastExecutionAt;     // Last execution timestamp
        bool active;                 // Active status
    }
    
    struct ExecutionRecord {
        address relayer;             // Relayer who executed
        bytes32 intentHash;          // Intent hash
        bool success;                // Execution success
        uint256 reward;              // Reward amount
        uint256 timestamp;           // Execution timestamp
    }
    
    // ============ State Variables ============
    
    /// @notice Mapping of relayer address to Relayer info
    mapping(address => Relayer) public relayers;
    
    /// @notice Array of active relayer addresses
    address[] public activeRelayers;
    
    /// @notice Mapping of intent hash to relayer who executed
    mapping(bytes32 => address) public intentExecutor;
    
    /// @notice Mapping of intent hash to execution record
    mapping(bytes32 => ExecutionRecord) public executionRecords;
    
    /// @notice Address authorized to record executions (ZeroTollDelegate or backend)
    address public executor;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;
    
    /// @notice Total slashed amount
    uint256 public totalSlashed;
    
    // ============ Events ============
    
    event RelayerRegistered(address indexed relayer, uint256 stake);
    event RelayerUnregistered(address indexed relayer, uint256 returnedStake);
    event ExecutionRecorded(address indexed relayer, bytes32 indexed intentHash, bool success, uint256 reward);
    event RewardDistributed(address indexed relayer, uint256 amount);
    event RelayerSlashed(address indexed relayer, uint256 amount, string reason);
    event ReputationUpdated(address indexed relayer, uint256 oldReputation, uint256 newReputation);
    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    event StakeIncreased(address indexed relayer, uint256 amount, uint256 newStake);
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyExecutor() {
        require(msg.sender == executor, "Only executor");
        _;
    }
    
    modifier onlyActiveRelayer() {
        require(relayers[msg.sender].active, "Not active relayer");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _executor) {
        owner = msg.sender;
        executor = _executor;
    }
    
    // ============ Registration Functions ============
    
    /**
     * @notice Register as a relayer by staking minimum amount
     * @dev Requires MIN_STAKE to be sent with transaction
     */
    function registerRelayer() external payable {
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(!relayers[msg.sender].active, "Already registered");
        require(activeRelayers.length < MAX_RELAYERS, "Max relayers reached");
        
        relayers[msg.sender] = Relayer({
            relayerAddress: msg.sender,
            stake: msg.value,
            reputation: 1000, // Start with perfect reputation
            successfulExecutions: 0,
            failedExecutions: 0,
            totalRewards: 0,
            registeredAt: block.timestamp,
            lastExecutionAt: block.timestamp,
            active: true
        });
        
        activeRelayers.push(msg.sender);
        
        emit RelayerRegistered(msg.sender, msg.value);
    }
    
    /**
     * @notice Unregister as a relayer and withdraw stake
     * @dev Returns remaining stake after any slashing
     */
    function unregisterRelayer() external onlyActiveRelayer {
        Relayer storage relayer = relayers[msg.sender];
        uint256 returnAmount = relayer.stake;
        
        // Remove from active relayers
        _removeFromActiveRelayers(msg.sender);
        
        // Mark as inactive
        relayer.active = false;
        
        // Return stake
        (bool success, ) = msg.sender.call{value: returnAmount}("");
        require(success, "Transfer failed");
        
        emit RelayerUnregistered(msg.sender, returnAmount);
    }
    
    /**
     * @notice Increase stake amount
     * @dev Allows relayers to increase their stake for better reputation
     */
    function increaseStake() external payable onlyActiveRelayer {
        require(msg.value > 0, "Must send stake");
        
        Relayer storage relayer = relayers[msg.sender];
        relayer.stake += msg.value;
        
        emit StakeIncreased(msg.sender, msg.value, relayer.stake);
    }
    
    // ============ Execution Tracking ============
    
    /**
     * @notice Record execution result and distribute reward or slash stake
     * @param relayer Address of relayer who executed
     * @param intentHash Hash of the intent that was executed
     * @param success Whether execution was successful
     * @param reward Reward amount for successful execution
     */
    function recordExecution(
        address relayer,
        bytes32 intentHash,
        bool success,
        uint256 reward
    ) external onlyExecutor {
        require(relayers[relayer].active, "Relayer not active");
        require(intentExecutor[intentHash] == address(0), "Intent already executed");
        
        Relayer storage r = relayers[relayer];
        
        if (success) {
            // Successful execution
            r.successfulExecutions++;
            r.totalRewards += reward;
            r.lastExecutionAt = block.timestamp;
            
            // Distribute reward
            if (reward > 0) {
                totalRewardsDistributed += reward;
                (bool sent, ) = relayer.call{value: reward}("");
                require(sent, "Reward transfer failed");
                emit RewardDistributed(relayer, reward);
            }
        } else {
            // Failed execution - slash stake
            r.failedExecutions++;
            
            uint256 slashAmount = (r.stake * SLASH_PERCENTAGE) / 100;
            r.stake -= slashAmount;
            totalSlashed += slashAmount;
            
            emit RelayerSlashed(relayer, slashAmount, "Failed execution");
            
            // If stake too low, deactivate
            if (r.stake < MIN_STAKE) {
                _removeFromActiveRelayers(relayer);
                r.active = false;
            }
        }
        
        // Update reputation
        _updateReputation(relayer);
        
        // Record execution
        intentExecutor[intentHash] = relayer;
        executionRecords[intentHash] = ExecutionRecord({
            relayer: relayer,
            intentHash: intentHash,
            success: success,
            reward: reward,
            timestamp: block.timestamp
        });
        
        emit ExecutionRecorded(relayer, intentHash, success, reward);
    }
    
    // ============ Reputation Management ============
    
    /**
     * @notice Update relayer reputation based on execution history
     * @param relayer Address of relayer to update
     */
    function _updateReputation(address relayer) internal {
        Relayer storage r = relayers[relayer];
        
        uint256 totalExecutions = r.successfulExecutions + r.failedExecutions;
        if (totalExecutions == 0) {
            r.reputation = 1000;
            return;
        }
        
        uint256 oldReputation = r.reputation;
        
        // Base reputation: (successful / total) * 1000
        uint256 baseReputation = (r.successfulExecutions * 1000) / totalExecutions;
        
        // Apply decay if inactive
        uint256 timeSinceLastExecution = block.timestamp - r.lastExecutionAt;
        if (timeSinceLastExecution > REPUTATION_DECAY_WINDOW) {
            // Decay 1% per day after decay window
            uint256 daysInactive = (timeSinceLastExecution - REPUTATION_DECAY_WINDOW) / 1 days;
            uint256 decayAmount = daysInactive * 10; // 1% = 10 points
            if (decayAmount > baseReputation) {
                baseReputation = 0;
            } else {
                baseReputation -= decayAmount;
            }
        }
        
        r.reputation = baseReputation;
        
        // Deactivate if reputation too low
        if (r.reputation < MIN_REPUTATION && r.active) {
            _removeFromActiveRelayers(relayer);
            r.active = false;
        }
        
        emit ReputationUpdated(relayer, oldReputation, r.reputation);
    }
    
    /**
     * @notice Manually update reputation for all relayers (for maintenance)
     */
    function updateAllReputations() external {
        for (uint256 i = 0; i < activeRelayers.length; i++) {
            _updateReputation(activeRelayers[i]);
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update executor address
     * @param newExecutor New executor address
     */
    function setExecutor(address newExecutor) external onlyOwner {
        require(newExecutor != address(0), "Invalid executor");
        address oldExecutor = executor;
        executor = newExecutor;
        emit ExecutorUpdated(oldExecutor, newExecutor);
    }
    
    /**
     * @notice Emergency withdraw (only for stuck funds)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all active relayer addresses
     * @return Array of active relayer addresses
     */
    function getActiveRelayers() external view returns (address[] memory) {
        return activeRelayers;
    }
    
    /**
     * @notice Get relayer information
     * @param relayer Address of relayer
     * @return Relayer struct
     */
    function getRelayerInfo(address relayer) external view returns (Relayer memory) {
        return relayers[relayer];
    }
    
    /**
     * @notice Get number of active relayers
     * @return Count of active relayers
     */
    function getRelayerCount() external view returns (uint256) {
        return activeRelayers.length;
    }
    
    /**
     * @notice Check if relayer is active
     * @param relayer Address to check
     * @return True if relayer is active
     */
    function isRelayerActive(address relayer) external view returns (bool) {
        return relayers[relayer].active;
    }
    
    /**
     * @notice Get execution record for intent
     * @param intentHash Hash of intent
     * @return ExecutionRecord struct
     */
    function getExecutionRecord(bytes32 intentHash) external view returns (ExecutionRecord memory) {
        return executionRecords[intentHash];
    }
    
    /**
     * @notice Get relayer statistics
     * @param relayer Address of relayer
     * @return stake Current stake
     * @return reputation Current reputation
     * @return successRate Success rate percentage (0-100)
     * @return totalExecutions Total executions
     */
    function getRelayerStats(address relayer) external view returns (
        uint256 stake,
        uint256 reputation,
        uint256 successRate,
        uint256 totalExecutions
    ) {
        Relayer memory r = relayers[relayer];
        stake = r.stake;
        reputation = r.reputation;
        totalExecutions = r.successfulExecutions + r.failedExecutions;
        
        if (totalExecutions > 0) {
            successRate = (r.successfulExecutions * 100) / totalExecutions;
        } else {
            successRate = 100;
        }
    }
    
    /**
     * @notice Get network statistics
     * @return totalRelayers Total active relayers
     * @return totalStaked Total amount staked
     * @return avgReputation Average reputation score
     * @return totalExecutions Total executions across all relayers
     */
    function getNetworkStats() external view returns (
        uint256 totalRelayers,
        uint256 totalStaked,
        uint256 avgReputation,
        uint256 totalExecutions
    ) {
        totalRelayers = activeRelayers.length;
        
        if (totalRelayers == 0) {
            return (0, 0, 0, 0);
        }
        
        uint256 sumStake = 0;
        uint256 sumReputation = 0;
        uint256 sumExecutions = 0;
        
        for (uint256 i = 0; i < activeRelayers.length; i++) {
            Relayer memory r = relayers[activeRelayers[i]];
            sumStake += r.stake;
            sumReputation += r.reputation;
            sumExecutions += r.successfulExecutions + r.failedExecutions;
        }
        
        totalStaked = sumStake;
        avgReputation = sumReputation / totalRelayers;
        totalExecutions = sumExecutions;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Remove relayer from active relayers array
     * @param relayer Address to remove
     */
    function _removeFromActiveRelayers(address relayer) internal {
        for (uint256 i = 0; i < activeRelayers.length; i++) {
            if (activeRelayers[i] == relayer) {
                activeRelayers[i] = activeRelayers[activeRelayers.length - 1];
                activeRelayers.pop();
                break;
            }
        }
    }
    
    // ============ Receive Function ============
    
    /**
     * @notice Receive function to accept ETH/POL for rewards
     */
    receive() external payable {}
}
