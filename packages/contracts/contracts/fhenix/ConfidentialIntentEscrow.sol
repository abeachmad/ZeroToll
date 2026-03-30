// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./ConfidentialIntentLib.sol";

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
        address executionTarget;
    }

    mapping(bytes32 => ConfidentialSettlement) private settlements;
    mapping(address => bool) public trustedOperators;

    address public feeRecipient;

    event TrustedOperatorSet(address indexed operator, bool enabled);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event ConfidentialIntentSubmitted(
        bytes32 indexed intentId,
        address indexed user,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 encryptedMinOutHandle
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

    constructor(address initialFeeRecipient) Ownable(msg.sender) {
        feeRecipient = initialFeeRecipient;
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

    function getIntentId(
        ConfidentialIntentLib.ConfidentialIntent calldata intent
    ) external pure returns (bytes32) {
        return ConfidentialIntentLib.hashIntent(intent);
    }

    function submitIntent(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        InEuint128 memory encryptedMinOut
    ) external nonReentrant returns (bytes32 intentId) {
        euint128 minOut = FHE.asEuint128(encryptedMinOut);
        return _submitIntent(intent, minOut);
    }

    /// @notice Local-development helper for tests and scaffolding.
    /// @dev This keeps the rest of the integration moving while frontend/client
    /// encryption is still being wired up. Do not market this path as private.
    function submitIntentWithPlaintextMinOutForTesting(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        uint128 plaintextMinOut
    ) external nonReentrant returns (bytes32 intentId) {
        euint128 minOut = FHE.asEuint128(uint256(plaintextMinOut));
        return _submitIntent(intent, minOut);
    }

    function _submitIntent(
        ConfidentialIntentLib.ConfidentialIntent calldata intent,
        euint128 encryptedMinOut
    ) internal returns (bytes32 intentId) {
        require(msg.sender == intent.user || trustedOperators[msg.sender], "Unauthorized submitter");
        require(intent.user != address(0), "Invalid user");
        require(intent.tokenIn != address(0), "Invalid tokenIn");
        require(intent.tokenOut != address(0), "Invalid tokenOut");
        require(intent.amountIn > 0, "Invalid amountIn");
        require(intent.deadline >= block.timestamp, "Intent expired");
        require(intent.chainId == block.chainid, "Wrong chain");

        intentId = ConfidentialIntentLib.hashIntent(intent);
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt == 0, "Intent already exists");

        settlement.intent = intent;
        settlement.stage = ConfidentialIntentLib.SettlementStage.Submitted;
        settlement.encryptedMinOut = encryptedMinOut;
        settlement.submittedAt = uint64(block.timestamp);

        FHE.allowThis(settlement.encryptedMinOut);
        FHE.allow(settlement.encryptedMinOut, intent.user);

        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);

        emit ConfidentialIntentSubmitted(
            intentId,
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            euint128.unwrap(settlement.encryptedMinOut)
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

        IERC20(settlement.intent.tokenOut).safeTransfer(settlement.intent.user, settlement.netAmountOut);

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
            settlement.executionTarget
        );
    }

    function getVerdictStatus(bytes32 intentId) external view returns (bool verdict, bool decrypted) {
        ConfidentialSettlement storage settlement = settlements[intentId];
        require(settlement.submittedAt != 0, "Unknown intent");
        return FHE.getDecryptResultSafe(settlement.encryptedVerdict);
    }
}
