// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "../interfaces/IWETH.sol";
import "./ConfidentialIntentLib.sol";

interface IPermit2 {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    function permit(address owner, PermitSingle memory permitSingle, bytes calldata signature) external;
    function transferFrom(address from, address to, uint160 amount, address token) external;
}

/// @notice Confidential settlement scaffold for ZeroToll's future Fhenix path.
/// @dev This contract now uses real CoFHE types for encrypted thresholds and
/// verdicts. It still exposes a plaintext helper for local scaffolding/tests so
/// the rest of the stack can be developed incrementally.
contract ConfidentialIntentEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct ConfidentialSettlement {
        ConfidentialIntentLib.ConfidentialIntent intent;
        ConfidentialIntentLib.SettlementStage stage;
        euint128 encryptedMinOut;
        ebool encryptedVerdict;
        uint256 grossAmountOut;
        uint256 feeAmount;
        uint256 netAmountOut;
        uint64 submittedAt;
        uint64 executedAt;
        uint64 finalizedAt;
        bool inputReleased;
        bool deliverNative;
        address executionTarget;
    }

    mapping(bytes32 => ConfidentialSettlement) private settlements;
    mapping(address => bool) public trustedOperators;

    address public feeRecipient;
    address public wrappedNativeToken;
    address public permit2;

    event TrustedOperatorSet(address indexed operator, bool enabled);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event WrappedNativeTokenUpdated(address indexed oldWrappedNativeToken, address indexed newWrappedNativeToken);
    event Permit2Updated(address indexed oldPermit2, address indexed newPermit2);
    event ConfidentialIntentSubmitted(
        bytes32 indexed intentId,
        address indexed user,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 encryptedMinOutHandle,
        bool deliverNative
    );
    event InputReleasedForExecution(
        bytes32 indexed intentId,
        address indexed operator,
        address indexed executionTarget,
        uint256 amountIn
    );
    event ExecutionResultRecorded(
        bytes32 indexed intentId,
        address indexed operator,
        uint256 grossAmountOut,
        uint256 feeAmount,
        uint256 netAmountOut,
        uint256 encryptedVerdictHandle
    );
    event DecryptionRequested(bytes32 indexed intentId, address indexed requestedBy, uint256 encryptedVerdictHandle);
    event ConfidentialIntentFinalized(
        bytes32 indexed intentId,
        bool success,
        address indexed user,
        address indexed token,
        uint256 userAmount,
        uint256 feeAmount
    );
    event ConfidentialIntentCancelled(bytes32 indexed intentId, address indexed user, uint256 refundAmount);

    modifier onlyTrustedOperator() {
        require(msg.sender == owner() || trustedOperators[msg.sender], "Not trusted operator");
        _;
    }

    constructor(
        address initialFeeRecipient,
        address initialWrappedNativeToken,
        address initialPermit2
    ) Ownable(msg.sender) {
        feeRecipient = initialFeeRecipient;
        wrappedNativeToken = initialWrappedNativeToken;
        permit2 = initialPermit2;
    }

    function setTrustedOperator(address operator, bool enabled) external onlyOwner {
        trustedOperators[operator] = enabled;
        emit TrustedOperatorSet(operator, enabled);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function setWrappedNativeToken(address newWrappedNativeToken) external onlyOwner {
        address oldWrappedNativeToken = wrappedNativeToken;
        wrappedNativeToken = newWrappedNativeToken;
        emit WrappedNativeTokenUpdated(oldWrappedNativeToken, newWrappedNativeToken);
    }

    function setPermit2(address newPermit2) external onlyOwner {
        address oldPermit2 = permit2;
        permit2 = newPermit2;
        emit Permit2Updated(oldPermit2, newPermit2);
    }

    function getIntentId(
        ConfidentialIntentLib.ConfidentialIntent calldata intent
    ) external pure returns (bytes32) {
        return ConfidentialIntentLib.hashIntent(intent);
    }

    function submitIntent(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        InEuint128 memory encryptedMinOut,
        bool deliverNative
    ) external nonReentrant returns (bytes32 intentId) {
        euint128 minOut = FHE.asEuint128(encryptedMinOut);
        return _submitIntentWithTransfer(intent, minOut, deliverNative);
    }

    /// @notice Local-development helper for tests and scaffolding.
    /// @dev This keeps the rest of the integration moving while frontend/client
    /// encryption is still being wired up. Do not market this path as private.
    function submitIntentWithPlaintextMinOutForTesting(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        uint128 plaintextMinOut,
        bool deliverNative
    ) external nonReentrant returns (bytes32 intentId) {
        euint128 minOut = FHE.asEuint128(uint256(plaintextMinOut));
        return _submitIntentWithTransfer(intent, minOut, deliverNative);
    }

    /// @notice Testing/helper path for Permit2-backed confidential submissions.
    function submitIntentWithPermit2ForTesting(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        uint128 plaintextMinOut,
        bool deliverNative,
        IPermit2.PermitSingle calldata permitSingle,
        bytes calldata permit2Signature
    ) external nonReentrant returns (bytes32 intentId) {
        require(permit2 != address(0), "Permit2 not configured");
        require(permitSingle.details.token == intent.tokenIn, "Permit2 token mismatch");
        require(permitSingle.spender == address(this), "Permit2 spender mismatch");
        require(permitSingle.details.amount >= intent.amountIn, "Permit2 amount too low");
        require(permitSingle.sigDeadline >= block.timestamp, "Permit2 signature expired");

        euint128 minOut = FHE.asEuint128(uint256(plaintextMinOut));
        intentId = _initializeSettlement(intent, minOut, deliverNative);

        IPermit2(permit2).permit(intent.user, permitSingle, permit2Signature);
        IPermit2(permit2).transferFrom(intent.user, address(this), uint160(intent.amountIn), intent.tokenIn);
    }

    /// @notice Testing/helper path for ERC-2612-backed confidential submissions.
    function submitIntentWithPermitForTesting(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        uint128 plaintextMinOut,
        bool deliverNative,
        uint256 permitDeadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external nonReentrant returns (bytes32 intentId) {
        euint128 minOut = FHE.asEuint128(uint256(plaintextMinOut));
        intentId = _initializeSettlement(intent, minOut, deliverNative);

        IERC20Permit(intent.tokenIn).permit(
            intent.user,
            address(this),
            intent.amountIn,
            permitDeadline,
            permitV,
            permitR,
            permitS
        );
        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);
    }

    function _submitIntentWithTransfer(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        euint128 encryptedMinOut,
        bool deliverNative
    ) internal returns (bytes32 intentId) {
        intentId = _initializeSettlement(intent, encryptedMinOut, deliverNative);
        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);
    }

    function _initializeSettlement(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        euint128 encryptedMinOut,
        bool deliverNative
    ) internal returns (bytes32 intentId) {
        require(msg.sender == intent.user || trustedOperators[msg.sender], "Unauthorized submitter");
        require(intent.user != address(0), "Invalid user");
        require(intent.tokenIn != address(0), "Invalid tokenIn");
        require(intent.tokenOut != address(0), "Invalid tokenOut");
        require(intent.amountIn > 0, "Invalid amountIn");
        require(intent.deadline >= block.timestamp, "Intent expired");
        require(intent.chainId == block.chainid, "Wrong chain");
        if (deliverNative) {
            require(wrappedNativeToken != address(0), "Wrapped native not configured");
            require(intent.tokenOut == wrappedNativeToken, "Native delivery requires wrapped native tokenOut");
        }

        intentId = ConfidentialIntentLib.hashIntent(intent);
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt == 0, "Intent already exists");

        settlement.intent = intent;
        settlement.stage = ConfidentialIntentLib.SettlementStage.Submitted;
        settlement.encryptedMinOut = encryptedMinOut;
        settlement.submittedAt = uint64(block.timestamp);
        settlement.deliverNative = deliverNative;

        FHE.allowThis(settlement.encryptedMinOut);
        FHE.allow(settlement.encryptedMinOut, intent.user);

        emit ConfidentialIntentSubmitted(
            intentId,
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            euint128.unwrap(settlement.encryptedMinOut),
            settlement.deliverNative
        );
    }

    function releaseInputForExecution(bytes32 intentId, address executionTarget) external onlyTrustedOperator nonReentrant {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        require(settlement.stage == ConfidentialIntentLib.SettlementStage.Submitted, "Invalid stage");
        require(executionTarget != address(0), "Invalid execution target");

        settlement.stage = ConfidentialIntentLib.SettlementStage.Executing;
        settlement.inputReleased = true;
        settlement.executionTarget = executionTarget;

        IERC20(settlement.intent.tokenIn).safeTransfer(executionTarget, settlement.intent.amountIn);

        emit InputReleasedForExecution(intentId, msg.sender, executionTarget, settlement.intent.amountIn);
    }

    function recordExecutionResult(
        bytes32 intentId,
        uint256 grossAmountOut,
        uint256 feeAmount
    ) external onlyTrustedOperator nonReentrant {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        require(settlement.stage == ConfidentialIntentLib.SettlementStage.Executing, "Invalid stage");
        require(grossAmountOut > 0, "Invalid gross amount");
        require(grossAmountOut <= type(uint128).max, "Gross output too large");
        require(grossAmountOut >= feeAmount, "Fee exceeds gross output");
        require(
            IERC20(settlement.intent.tokenOut).balanceOf(address(this)) >= grossAmountOut,
            "Missing output funds"
        );

        euint128 encryptedGrossOut = FHE.asEuint128(grossAmountOut);
        ebool encryptedVerdict = FHE.gte(encryptedGrossOut, settlement.encryptedMinOut);

        settlement.grossAmountOut = grossAmountOut;
        settlement.feeAmount = feeAmount;
        settlement.netAmountOut = grossAmountOut - feeAmount;
        settlement.encryptedVerdict = encryptedVerdict;
        settlement.executedAt = uint64(block.timestamp);
        settlement.stage = ConfidentialIntentLib.SettlementStage.Executed;

        FHE.allowThis(settlement.encryptedVerdict);
        FHE.allow(settlement.encryptedVerdict, settlement.intent.user);

        emit ExecutionResultRecorded(
            intentId,
            msg.sender,
            grossAmountOut,
            feeAmount,
            settlement.netAmountOut,
            ebool.unwrap(settlement.encryptedVerdict)
        );
    }

    function requestDecryption(bytes32 intentId) external {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        require(
            msg.sender == settlement.intent.user || trustedOperators[msg.sender] || msg.sender == owner(),
            "Unauthorized requester"
        );
        require(settlement.stage == ConfidentialIntentLib.SettlementStage.Executed, "Invalid stage");

        FHE.allowSender(settlement.encryptedVerdict);
        FHE.decrypt(settlement.encryptedVerdict);
        settlement.stage = ConfidentialIntentLib.SettlementStage.DecryptionRequested;
        emit DecryptionRequested(intentId, msg.sender, ebool.unwrap(settlement.encryptedVerdict));
    }

    function finalizeSuccess(bytes32 intentId) external onlyTrustedOperator nonReentrant {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        require(settlement.stage == ConfidentialIntentLib.SettlementStage.DecryptionRequested, "Invalid stage");

        (bool verdict, bool decrypted) = FHE.getDecryptResultSafe(settlement.encryptedVerdict);
        require(decrypted, "Verdict not decrypted");
        require(verdict, "Confidential threshold not met");

        settlement.stage = ConfidentialIntentLib.SettlementStage.FinalizedSuccess;
        settlement.finalizedAt = uint64(block.timestamp);

        if (settlement.feeAmount > 0 && feeRecipient != address(0)) {
            IERC20(settlement.intent.tokenOut).safeTransfer(feeRecipient, settlement.feeAmount);
        }

        if (settlement.deliverNative) {
            IWETH(settlement.intent.tokenOut).withdraw(settlement.netAmountOut);
            (bool success, ) = payable(settlement.intent.user).call{value: settlement.netAmountOut}("");
            require(success, "Native transfer failed");
        } else {
            IERC20(settlement.intent.tokenOut).safeTransfer(settlement.intent.user, settlement.netAmountOut);
        }

        emit ConfidentialIntentFinalized(
            intentId,
            true,
            settlement.intent.user,
            settlement.intent.tokenOut,
            settlement.netAmountOut,
            settlement.feeAmount
        );
    }

    function finalizeRefund(bytes32 intentId) external onlyTrustedOperator nonReentrant {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        require(
            settlement.stage == ConfidentialIntentLib.SettlementStage.Submitted ||
                settlement.stage == ConfidentialIntentLib.SettlementStage.Executing ||
                settlement.stage == ConfidentialIntentLib.SettlementStage.DecryptionRequested,
            "Invalid stage"
        );

        if (settlement.stage == ConfidentialIntentLib.SettlementStage.DecryptionRequested) {
            (bool verdict, bool decrypted) = FHE.getDecryptResultSafe(settlement.encryptedVerdict);
            require(decrypted, "Verdict not decrypted");
            require(!verdict, "Confidential threshold satisfied");
        }

        require(
            IERC20(settlement.intent.tokenIn).balanceOf(address(this)) >= settlement.intent.amountIn,
            "Missing refund funds"
        );

        settlement.stage = ConfidentialIntentLib.SettlementStage.FinalizedRefunded;
        settlement.finalizedAt = uint64(block.timestamp);

        IERC20(settlement.intent.tokenIn).safeTransfer(settlement.intent.user, settlement.intent.amountIn);

        emit ConfidentialIntentFinalized(
            intentId,
            false,
            settlement.intent.user,
            settlement.intent.tokenIn,
            settlement.intent.amountIn,
            0
        );
    }

    function cancelExpired(bytes32 intentId) external nonReentrant {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        require(
            msg.sender == settlement.intent.user || trustedOperators[msg.sender] || msg.sender == owner(),
            "Unauthorized canceller"
        );
        require(settlement.stage == ConfidentialIntentLib.SettlementStage.Submitted, "Invalid stage");
        require(block.timestamp > settlement.intent.deadline, "Intent still active");

        settlement.stage = ConfidentialIntentLib.SettlementStage.Cancelled;
        settlement.finalizedAt = uint64(block.timestamp);

        IERC20(settlement.intent.tokenIn).safeTransfer(settlement.intent.user, settlement.intent.amountIn);

        emit ConfidentialIntentCancelled(intentId, settlement.intent.user, settlement.intent.amountIn);
    }

    function getSettlementSummary(
        bytes32 intentId
    )
        external
        view
        returns (
            ConfidentialIntentLib.ConfidentialIntent memory intent,
            ConfidentialIntentLib.SettlementStage stage,
            uint256 encryptedMinOutHandle,
            uint256 encryptedVerdictHandle,
            uint256 grossAmountOut,
            uint256 feeAmount,
            uint256 netAmountOut,
            bool inputReleased,
            bool deliverNative,
            address executionTarget
        )
    {
        ConfidentialSettlement storage settlement = settlements[intentId];
        return (
            settlement.intent,
            settlement.stage,
            euint128.unwrap(settlement.encryptedMinOut),
            ebool.unwrap(settlement.encryptedVerdict),
            settlement.grossAmountOut,
            settlement.feeAmount,
            settlement.netAmountOut,
            settlement.inputReleased,
            settlement.deliverNative,
            settlement.executionTarget
        );
    }

    function getVerdictStatus(bytes32 intentId) external view returns (bool verdict, bool decrypted) {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        return FHE.getDecryptResultSafe(settlement.encryptedVerdict);
    }

    receive() external payable {}
}
