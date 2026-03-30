// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ConfidentialIntentLib {
    enum SettlementStage {
        None,
        Submitted,
        Executing,
        Executed,
        DecryptionRequested,
        FinalizedSuccess,
        FinalizedRefunded,
        Cancelled
    }

    struct ConfidentialIntent {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 deadline;
        uint256 nonce;
        uint256 chainId;
        bytes32 encryptedMinOutCommitment;
    }

    bytes32 internal constant CONFIDENTIAL_INTENT_TYPEHASH = keccak256(
        "ConfidentialIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 deadline,uint256 nonce,uint256 chainId,bytes32 encryptedMinOutCommitment)"
    );

    function hashIntent(ConfidentialIntent memory intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CONFIDENTIAL_INTENT_TYPEHASH,
                intent.user,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.deadline,
                intent.nonce,
                intent.chainId,
                intent.encryptedMinOutCommitment
            )
        );
    }
}
