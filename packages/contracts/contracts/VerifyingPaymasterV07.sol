// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEntryPoint.sol";

/**
 * VerifyingPaymaster for ERC-4337 v0.7
 * 
 * Requires a signature from a trusted signer (backend policy server) to sponsor gas.
 * 
 * v0.7 paymasterAndData format:
 * - Bytes 0-20: paymaster address
 * - Bytes 20-36: paymasterVerificationGasLimit (16 bytes, uint128)
 * - Bytes 36-52: paymasterPostOpGasLimit (16 bytes, uint128)
 * - Bytes 52+: paymasterData (signature from policy server)
 */
contract VerifyingPaymasterV07 is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IEntryPoint public immutable entryPoint;
    address public immutable verifySigner;

    // v0.7 offsets
    uint256 constant PAYMASTER_VALIDATION_GAS_OFFSET = 20;
    uint256 constant PAYMASTER_POSTOP_GAS_OFFSET = 36;
    uint256 constant PAYMASTER_DATA_OFFSET = 52;

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    event GasSponsored(address indexed sender, bytes32 indexed userOpHash, uint256 maxCost);

    constructor(IEntryPoint _entryPoint, address _verifySigner) Ownable(msg.sender) {
        require(address(_entryPoint) != address(0), "Invalid entrypoint");
        require(_verifySigner != address(0), "Invalid signer");
        entryPoint = _entryPoint;
        verifySigner = _verifySigner;
    }

    receive() external payable {}

    /**
     * Validate paymaster user operation (called by EntryPoint)
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "Sender not EntryPoint");
        return _validatePaymasterUserOp(userOp, userOpHash, maxCost);
    }

    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal returns (bytes memory context, uint256 validationData) {
        (userOpHash); // We don't use the full userOpHash since it includes our signature
        (maxCost); // unused

        // v0.7: paymasterAndData must be at least 52 + 65 = 117 bytes
        // (paymaster 20 + verificationGas 16 + postOpGas 16 + signature 65)
        require(userOp.paymasterAndData.length >= 117, "Invalid paymasterAndData length");

        // Extract signature from paymasterData (offset 52)
        bytes memory signature = userOp.paymasterAndData[PAYMASTER_DATA_OFFSET:];
        require(signature.length >= 65, "Invalid signature length");

        // Calculate the hash that the policy server signed
        // This is the hash of the UserOp WITHOUT the paymaster signature
        bytes32 hashToSign = getHash(userOp);
        
        // Recover signer from signature
        bytes32 ethSignedHash = hashToSign.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);

        // Verify signature is from trusted signer
        if (recovered != verifySigner) {
            // Return invalid signature
            return ("", _packValidationData(true, 0, 0));
        }

        emit GasSponsored(userOp.sender, hashToSign, maxCost);

        // Signature valid - sponsor this UserOp
        validationData = _packValidationData(false, 0, 0);
        context = "";
    }

    /**
     * Calculate the hash that the policy server should sign.
     * This excludes the paymaster signature from paymasterAndData.
     */
    function getHash(PackedUserOperation calldata userOp) public view returns (bytes32) {
        // Build paymasterAndData without signature (just paymaster + gas limits)
        bytes memory paymasterAndDataWithoutSig = userOp.paymasterAndData[0:PAYMASTER_DATA_OFFSET];
        
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.accountGasLimits,
            userOp.preVerificationGas,
            userOp.gasFees,
            keccak256(paymasterAndDataWithoutSig),
            block.chainid,
            address(this)
        ));
    }

    /**
     * Post-operation handler (called by EntryPoint)
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        require(msg.sender == address(entryPoint), "Sender not EntryPoint");
        // No-op for basic sponsorship
        (mode, context, actualGasCost, actualUserOpFeePerGas);
    }

    /**
     * Add deposit for this paymaster
     */
    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * Withdraw from deposit
     */
    function withdrawTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }

    /**
     * Get current deposit
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    /**
     * Add stake for this paymaster
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /**
     * Unlock stake
     */
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    /**
     * Withdraw stake
     */
    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        entryPoint.withdrawStake(withdrawAddress);
    }

    function _packValidationData(bool sigFailed, uint48 validUntil, uint48 validAfter) internal pure returns (uint256) {
        return (sigFailed ? 1 : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << (160 + 48));
    }
}

/**
 * PackedUserOperation struct for v0.7
 */
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}
