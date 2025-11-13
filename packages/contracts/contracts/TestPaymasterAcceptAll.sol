// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./core/BasePaymaster.sol";

/**
 * TestPaymaster - A simple paymaster that accepts all requests (FOR TESTNET ONLY)
 * 
 * This paymaster will sponsor gas for ANY user operation without validation.
 * Use ONLY for Phase 2 testing on testnets.
 * 
 * In Phase 3, replace with VerifyingPaymaster that validates backend signatures.
 */
contract TestPaymasterAcceptAll is BasePaymaster {
    
    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    /**
     * Accept all user operations without any validation.
     * Returns empty context (no postOp needed).
     */
    function _validatePaymasterUserOp(
        bytes calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal pure override returns (bytes memory context, uint256 validationData) {
        (userOp, userOpHash, maxCost); // unused
        
        // Accept all requests
        // validationData = 0 means: signature valid, no time limits
        return ("", 0);
    }

    /**
     * No post-operation logic needed for basic sponsorship.
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        (mode, context, actualGasCost, actualUserOpFeePerGas); // unused
        // No-op
    }
}
