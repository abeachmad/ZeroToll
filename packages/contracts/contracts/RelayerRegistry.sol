// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RelayerRegistry is Ownable, ReentrancyGuard {
    IERC20 public immutable stakeToken;
    uint256 public minStake = 1000e18; // 1000 tokens
    
    mapping(address => uint256) public stake;
    mapping(address => uint256) public scoreOf;
    mapping(bytes32 => Quote) public bestQuote;
    mapping(bytes32 => FilledIntent) public filled;
    
    address public keeper;
    
    struct Quote {
        address relayer;
        uint256 costEstimate;
        uint256 deadline;
        bytes32 commitHash;
        bool revealed;
    }
    
    struct FilledIntent {
        address relayer;
        uint256 costNative;
        uint256 latencyMs;
        uint256 timestamp;
    }
    
    event Staked(address indexed relayer, uint256 amount);
    event Unstaked(address indexed relayer, uint256 amount);
    event Slashed(address indexed relayer, uint256 amount, string reason);
    event ScoreUpdated(address indexed relayer, uint256 newScore);
    event QuoteCommitted(bytes32 indexed intentId, address indexed relayer, bytes32 commitHash);
    event QuoteRevealed(bytes32 indexed intentId, address indexed relayer, uint256 costEstimate);
    event Filled(bytes32 indexed intentId, address indexed relayer, uint256 costNative, uint256 latencyMs);
    
    constructor(IERC20 _stakeToken) Ownable(msg.sender) {
        stakeToken = _stakeToken;
        keeper = msg.sender;
    }
    
    function stakeTokens(uint256 amount) external nonReentrant {
        require(amount >= minStake, "Below min stake");
        require(stakeToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        stake[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external nonReentrant {
        require(stake[msg.sender] >= amount, "Insufficient stake");
        stake[msg.sender] -= amount;
        
        require(stakeToken.transfer(msg.sender, amount), "Transfer failed");
        emit Unstaked(msg.sender, amount);
    }
    
    function commitQuote(bytes32 intentId, bytes32 commitHash) external {
        require(stake[msg.sender] >= minStake, "Not staked");
        require(bestQuote[intentId].deadline == 0 || block.timestamp <= bestQuote[intentId].deadline, "Expired");
        
        bestQuote[intentId] = Quote({
            relayer: msg.sender,
            costEstimate: 0,
            deadline: block.timestamp + 60, // 60s to reveal
            commitHash: commitHash,
            revealed: false
        });
        
        emit QuoteCommitted(intentId, msg.sender, commitHash);
    }
    
    function revealQuote(bytes32 intentId, uint256 costEstimate, bytes32 salt) external {
        Quote storage quote = bestQuote[intentId];
        require(quote.relayer == msg.sender, "Not your quote");
        require(!quote.revealed, "Already revealed");
        require(block.timestamp <= quote.deadline, "Reveal expired");
        require(keccak256(abi.encode(costEstimate, salt)) == quote.commitHash, "Invalid reveal");
        
        quote.costEstimate = costEstimate;
        quote.revealed = true;
        
        emit QuoteRevealed(intentId, msg.sender, costEstimate);
    }
    
    function recordFill(bytes32 intentId, address relayer, uint256 costNative, uint256 latencyMs) external onlyOwner {
        filled[intentId] = FilledIntent({
            relayer: relayer,
            costNative: costNative,
            latencyMs: latencyMs,
            timestamp: block.timestamp
        });
        
        emit Filled(intentId, relayer, costNative, latencyMs);
    }
    
    function setScore(address relayer, uint256 newScore) external {
        require(msg.sender == keeper || msg.sender == owner(), "Not authorized");
        scoreOf[relayer] = newScore;
        emit ScoreUpdated(relayer, newScore);
    }
    
    function slash(address relayer, uint256 amount, string calldata reason) external onlyOwner {
        require(stake[relayer] >= amount, "Insufficient stake");
        stake[relayer] -= amount;
        
        // Slashed amount goes to treasury (owner)
        require(stakeToken.transfer(owner(), amount), "Transfer failed");
        emit Slashed(relayer, amount, reason);
    }
    
    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
    }
    
    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
    }
}
