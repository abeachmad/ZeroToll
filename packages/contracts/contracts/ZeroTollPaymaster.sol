// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "./interfaces/IEntryPoint.sol";
import "./AssetRegistry.sol";
import "./TokenValuer.sol";
import "./FeeEscrow.sol";
import "./libraries/IntentLib.sol";

contract ZeroTollPaymaster is Ownable, ReentrancyGuard {
    IEntryPoint public immutable entryPoint;
    AssetRegistry public assetRegistry;
    TokenValuer public tokenValuer;
    FeeEscrow public feeEscrow;
    address public treasury;
    
    uint256 public feeBps = 50;           // 0.5%
    uint256 public maxFeeBps = 300;       // 3%
    uint256 public gasBufferBps = 1500;   // 15% buffer
    
    mapping(bytes32 => bool) public usedIntent;
    
    event GasSettled(
        address indexed user,
        address feeToken,
        uint256 costInFeeToken,
        uint256 refundInFeeToken,
        string oracleSource,
        FeeAssetMode feeMode
    );
    event FeeParamsUpdated(uint256 feeBps, uint256 maxFeeBps, uint256 gasBufferBps);
    
    constructor(
        IEntryPoint _entryPoint,
        address _assetRegistry,
        address _tokenValuer,
        address _feeEscrow,
        address _treasury
    ) Ownable(msg.sender) {
        entryPoint = _entryPoint;
        assetRegistry = AssetRegistry(_assetRegistry);
        tokenValuer = TokenValuer(_tokenValuer);
        feeEscrow = FeeEscrow(_feeEscrow);
        treasury = _treasury;
    }
    
    function setFeeParams(uint256 _feeBps, uint256 _maxFeeBps, uint256 _gasBufferBps) external onlyOwner {
        require(_feeBps <= _maxFeeBps, "Fee exceeds max");
        require(_maxFeeBps <= 10000, "Max fee too high");
        feeBps = _feeBps;
        maxFeeBps = _maxFeeBps;
        gasBufferBps = _gasBufferBps;
        emit FeeParamsUpdated(_feeBps, _maxFeeBps, _gasBufferBps);
    }
    
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "Only EntryPoint");
        
        // Decode intent from paymasterAndData
        (IntentLib.Intent memory intent, bytes memory permitData) = 
            abi.decode(userOp.paymasterAndData[20:], (IntentLib.Intent, bytes));
        
        require(block.timestamp <= intent.deadline, "Intent expired");
        require(intent.deadline <= block.timestamp + 1 hours, "Deadline too far");
        
        bytes32 intentHash = IntentLib.hashIntent(intent);
        require(!usedIntent[intentHash], "Intent already used");
        usedIntent[intentHash] = true;
        
        // Check if fee mode is allowed for this token
        require(
            assetRegistry.isModeAllowed(intent.feeToken, intent.feeMode),
            "Fee mode not allowed for token"
        );
        
        // Handle different fee modes
        if (intent.feeMode == FeeAssetMode.TOKEN_INPUT_SOURCE) {
            // Pull fee token into escrow via permit
            feeEscrow.depositFromUserPermit2(
                intentHash,
                intent.user,
                intent.feeToken,
                intent.feeCapToken,
                permitData
            );
        } else if (intent.feeMode == FeeAssetMode.TOKEN_OUTPUT_DEST) {
            // No pull on source; will be deducted on destination
            // Store claimId for later settlement
        } else if (intent.feeMode == FeeAssetMode.TOKEN_STABLE) {
            // Pull stable token directly (existing path)
            if (permitData.length > 0) {
                (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = 
                    abi.decode(permitData, (uint8, bytes32, bytes32, uint256));
                IERC20Permit(intent.feeToken).permit(
                    intent.user,
                    address(this),
                    intent.feeCapToken,
                    deadline,
                    v, r, s
                );
            }
        }
        // NATIVE mode: no pre-pull needed
        
        context = abi.encode(intent, intentHash);
        validationData = 0; // Valid
    }
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external nonReentrant {
        require(msg.sender == address(entryPoint), "Only EntryPoint");
        
        if (mode == PostOpMode.postOpReverted) return;
        
        (IntentLib.Intent memory intent, bytes32 intentHash) = 
            abi.decode(context, (IntentLib.Intent, bytes32));
        
        // Convert native gas cost to feeToken via TokenValuer
        uint256 costInFeeToken = tokenValuer.convertNativeToToken(actualGasCost, intent.feeToken);
        
        // Add protocol fee with overflow check
        uint256 feeAmount = (costInFeeToken * feeBps) / 10000;
        require(feeAmount <= costInFeeToken, "Fee overflow");
        
        uint256 totalCharge = costInFeeToken + feeAmount;
        require(totalCharge >= costInFeeToken, "Charge overflow");
        require(totalCharge <= intent.feeCapToken, "Cost exceeds cap");
        
        // Handle payment based on mode
        if (intent.feeMode == FeeAssetMode.TOKEN_INPUT_SOURCE) {
            // Take from escrow
            feeEscrow.release(intentHash, treasury, intent.feeToken, totalCharge);
            
            // Refund surplus
            uint256 refund = intent.feeCapToken - totalCharge;
            if (refund > 0) {
                feeEscrow.refund(intentHash, intent.user, intent.feeToken, refund);
            }
        } else if (intent.feeMode == FeeAssetMode.TOKEN_STABLE) {
            // Pull from user
            require(
                IERC20(intent.feeToken).transferFrom(intent.user, treasury, totalCharge),
                "Fee transfer failed"
            );
            
            // Refund surplus
            uint256 refund = intent.feeCapToken - totalCharge;
            if (refund > 0) {
                IERC20(intent.feeToken).transfer(intent.user, refund);
            }
        }
        // OUTPUT mode handled by FeeSink on destination
        
        AssetRegistry.AssetConfig memory config = assetRegistry.getAssetConfig(intent.feeToken);
        
        emit GasSettled(
            intent.user,
            intent.feeToken,
            costInFeeToken,
            intent.feeCapToken - totalCharge,
            config.oracleSource,
            intent.feeMode
        );
    }
    
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
    
    function withdrawTo(address payable withdrawAddress, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

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
