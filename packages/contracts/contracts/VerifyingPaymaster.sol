// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./core/BasePaymaster.sol";

/**
 * A verifying paymaster that requires a signature from a trusted signer (backend policy server)
 * to sponsor gas for user operations.
 * 
 * The backend can enforce:
 * - Rate limiting (X swaps per day per wallet)
 * - Token whitelisting (only WMATIC, USDC, LINK)
 * - Target whitelisting (only RouterHub.executeRoute)
 * - Economic viability (fee collected >= gas cost)
 */
contract VerifyingPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public immutable verifingSigner;

    event VerifyingSignerChanged(address indexed oldSigner, address indexed newSigner, address indexed actor);

    constructor(IEntryPoint _entryPoint, address _verifySigner) BasePaymaster(_entryPoint) {
        require(_verifySigner != address(0), "VerifyingPaymaster: signer cannot be zero address");
        verifingSigner = _verifySigner;
    }

    /**
     * Allow contract to receive native tokens
     */
    receive() external payable {}

    /**
     * Verify that the UserOperation is allowed by checking the signature from the verifying signer.
     * 
     * The paymasterAndData format:
     * - 20 bytes: paymaster address (this contract)
     * - 65 bytes: ECDSA signature from policy server
     * 
     * The policy server signs: keccak256(abi.encode(userOpHash))
     */
    function _validatePaymasterUserOp(
        bytes calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal view override returns (bytes memory context, uint256 validationData) {
        (maxCost); // unused
        (userOp); // unused - we get data from paymasterAndData
        
        // paymasterAndData must be at least 85 bytes: paymaster(20) + signature(65)
        require(userOp.length >= 85, "VerifyingPaymaster: invalid paymasterAndData length");
        
        // Extract signature (bytes 20-85)
        bytes memory signature = userOp[20:85];
        
        // Recover signer from signature
        // Policy server signs: eth_sign(keccak256(userOpHash))
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recovered = hash.recover(signature);
        
        // Verify signature is from trusted signer
        if (recovered != verifingSigner) {
            // Return invalid signature (validationData with failed bit set)
            return ("", _packValidationData(true, 0, 0));
        }
        
        // Signature valid - sponsor this UserOp
        validationData = _packValidationData(false, 0, 0); // No time restrictions
        context = "";
    }

    /**
     * Post-operation handler (optional)
     * We don't need postOp for basic gas sponsorship, but implementing it for future use.
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        // No-op for now
        // In future, could track actual costs vs collected fees
        (mode, context, actualGasCost, actualUserOpFeePerGas);
    }
}