// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum FeeAssetMode { NATIVE, TOKEN_INPUT_SOURCE, TOKEN_OUTPUT_DEST, TOKEN_STABLE }

library IntentLib {
    struct Intent {
        address user;
        address tokenIn;
        uint256 amtIn;
        address tokenOut;
        uint256 minOut;
        uint64 dstChainId;
        uint64 deadline;
        address feeToken;           // token used to settle fee
        FeeAssetMode feeMode;       // payment mode
        uint256 feeCapToken;        // max fee in feeToken units
        bytes routeHint;
        uint256 nonce;
    }
    
    bytes32 constant INTENT_TYPEHASH = keccak256(
        "Intent(address user,address tokenIn,uint256 amtIn,address tokenOut,uint256 minOut,uint64 dstChainId,uint64 deadline,address feeToken,uint8 feeMode,uint256 feeCapToken,bytes routeHint,uint256 nonce)"
    );
    
    function hashIntent(Intent memory intent) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            INTENT_TYPEHASH,
            intent.user,
            intent.tokenIn,
            intent.amtIn,
            intent.tokenOut,
            intent.minOut,
            intent.dstChainId,
            intent.deadline,
            intent.feeToken,
            uint8(intent.feeMode),
            intent.feeCapToken,
            keccak256(intent.routeHint),
            intent.nonce
        ));
    }
}
