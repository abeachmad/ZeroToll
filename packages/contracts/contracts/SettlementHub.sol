// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VaultStableFloat.sol";

contract SettlementHub is Ownable, ReentrancyGuard {
    VaultStableFloat public immutable vault;
    uint256 public challengeWindow = 300; // 5 minutes on testnet
    
    mapping(bytes32 => FillRecord) public fills;
    
    struct FillRecord {
        address relayer;
        uint256 costStable;
        uint256 timestamp;
        bool claimed;
        bool challenged;
    }
    
    event Filled(bytes32 indexed intentId, address indexed relayer, uint256 costStable);
    event Claimed(bytes32 indexed intentId, address indexed relayer, uint256 reimbursement);
    event Challenged(bytes32 indexed intentId, address indexed challenger, string reason);
    
    constructor(VaultStableFloat _vault) Ownable(msg.sender) {
        vault = _vault;
    }
    
    function fill(bytes32 intentId, uint256 costStable, bytes calldata fillProof) external nonReentrant {
        require(fills[intentId].timestamp == 0, "Already filled");
        
        fills[intentId] = FillRecord({
            relayer: msg.sender,
            costStable: costStable,
            timestamp: block.timestamp,
            claimed: false,
            challenged: false
        });
        
        emit Filled(intentId, msg.sender, costStable);
    }
    
    function claimReimburse(bytes32 intentId) external nonReentrant {
        FillRecord storage record = fills[intentId];
        require(record.relayer == msg.sender, "Not your fill");
        require(!record.claimed, "Already claimed");
        require(!record.challenged, "Fill challenged");
        require(block.timestamp >= record.timestamp + challengeWindow, "Challenge window open");
        
        record.claimed = true;
        
        // Reimburse from vault (vault will transfer)
        // For MVP, we trust the relayer's costStable; in production add oracle verification
        // vault.reimburseRelayer(msg.sender, record.costStable);
        
        emit Claimed(intentId, msg.sender, record.costStable);
    }
    
    function challenge(bytes32 intentId, string calldata reason) external {
        FillRecord storage record = fills[intentId];
        require(record.timestamp > 0, "No fill");
        require(!record.claimed, "Already claimed");
        require(block.timestamp < record.timestamp + challengeWindow, "Challenge window closed");
        
        record.challenged = true;
        emit Challenged(intentId, msg.sender, reason);
    }
    
    function setChallengeWindow(uint256 _window) external onlyOwner {
        challengeWindow = _window;
    }
}
