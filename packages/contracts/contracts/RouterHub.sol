// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/IntentLib.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
}

contract RouterHub is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    mapping(address => bool) public whitelistedAdapter;
    mapping(address => address) public nativeToWrapped; // NATIVE_MARKER => WETH/WPOL
    address public constant NATIVE_MARKER = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    address public twapOracle;
    address public feeSink;
    
    // Gasless fee configuration (Phase 1)
    uint16 public gaslessFeeBps = 50; // 0.5% default for gasless swaps
    address public gaslessFeeRecipient; // Paymaster treasury for gasless fee collection
    
    event RouteExecuted(
        bytes32 indexed intentId,
        uint256 amountOut,
        uint256 dstChainId,
        bool outIsNative,
        uint256 outGrossWrapped,
        uint256 outNetNative
    );
    event GaslessFeeCharged(
        bytes32 indexed intentId,
        address indexed user,
        address indexed token,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 netAmount
    );
    event AdapterWhitelisted(address indexed adapter, bool status);
    event NativeWrappedSet(address indexed wrapped);
    event PrefundPushed(address indexed token, address indexed adapter, uint256 amount);
    
    constructor() Ownable(msg.sender) {}
    
    function executeRoute(
        IntentLib.Intent calldata intent,
        address adapter,
        bytes calldata routeData
    ) external nonReentrant returns (uint256 amountOut) {
        require(whitelistedAdapter[adapter], "Adapter not whitelisted");
        require(block.timestamp <= intent.deadline, "Intent expired");
        
        address tokenIn = intent.tokenIn == NATIVE_MARKER ? nativeToWrapped[NATIVE_MARKER] : intent.tokenIn;
        address tokenOut = intent.tokenOut == NATIVE_MARKER ? nativeToWrapped[NATIVE_MARKER] : intent.tokenOut;
        
        // PUSH PATTERN: Pull tokens from intent.user (not msg.sender!)
        // This allows relayer to submit TX on behalf of user who signed intent
        IERC20(tokenIn).safeTransferFrom(intent.user, address(this), intent.amtIn);
        
        // Transfer tokens to adapter (prefund pattern)
        // Adapter will consume from its own balance, not pull from RouterHub
        IERC20(tokenIn).safeTransfer(adapter, intent.amtIn);
        emit PrefundPushed(tokenIn, adapter, intent.amtIn);
        
        // Execute route via adapter (no approval needed with push pattern)
        // Increased gas limit to accommodate SafeERC20 overhead
        (bool success, bytes memory result) = adapter.call{gas: 800000}(routeData);
        require(success, "Adapter call failed");
        require(result.length > 0, "Empty result");
        
        uint256 grossOut = abi.decode(result, (uint256));
        require(grossOut >= intent.minOut, "Slippage exceeded");
        require(grossOut > 0, "Invalid output amount");
        
        uint256 netOut = grossOut;
        uint256 feeAmount = 0;
        bool isNativeOut = intent.tokenOut == NATIVE_MARKER;
        
        // Calculate gasless fee if recipient is configured (Phase 1: Gasless)
        // Fee is taken from output (post-swap) to enable gasless UX
        if (gaslessFeeRecipient != address(0) && gaslessFeeBps > 0) {
            feeAmount = (grossOut * gaslessFeeBps) / 10000;
            netOut = grossOut - feeAmount;
            
            // Safety check: ensure netOut still meets user's minOut requirement
            require(netOut >= intent.minOut, "Fee + slippage exceeds minOut");
        }
        
        // Handle output-fee mode with native unwrap
        if (intent.feeMode == FeeAssetMode.TOKEN_OUTPUT_DEST && isNativeOut) {
            // Legacy fee mode (using intent.feeCapToken)
            // Skim fee from wrapped, then unwrap remainder
            uint256 legacyFee = (grossOut * intent.feeCapToken) / 10000; // simplified
            if (legacyFee > 0 && feeSink != address(0)) {
                IERC20(tokenOut).transfer(feeSink, legacyFee);
                netOut = grossOut - legacyFee;
            }
            
            // Unwrap to native
            IWETH(tokenOut).withdraw(netOut);
            payable(intent.user).transfer(netOut);
            
            emit RouteExecuted(
                IntentLib.hashIntent(intent),
                grossOut,
                intent.dstChainId,
                true,
                grossOut,
                netOut
            );
        } else if (isNativeOut) {
            // Gasless fee (if configured) from wrapped before unwrap
            if (feeAmount > 0) {
                IERC20(tokenOut).safeTransfer(gaslessFeeRecipient, feeAmount);
                emit GaslessFeeCharged(
                    IntentLib.hashIntent(intent),
                    intent.user,
                    tokenOut,
                    grossOut,
                    feeAmount,
                    netOut
                );
            }
            
            // Unwrap to native
            IWETH(tokenOut).withdraw(netOut);
            payable(intent.user).transfer(netOut);
            
            emit RouteExecuted(
                IntentLib.hashIntent(intent),
                grossOut,
                intent.dstChainId,
                true,
                grossOut,
                netOut
            );
        } else {
            // Standard ERC20 output - apply gasless fee if configured
            if (feeAmount > 0) {
                IERC20(tokenOut).safeTransfer(gaslessFeeRecipient, feeAmount);
                emit GaslessFeeCharged(
                    IntentLib.hashIntent(intent),
                    intent.user,
                    tokenOut,
                    grossOut,
                    feeAmount,
                    netOut
                );
            }
            
            // Transfer net amount to user
            IERC20(tokenOut).safeTransfer(intent.user, netOut);
            
            emit RouteExecuted(
                IntentLib.hashIntent(intent),
                grossOut,
                intent.dstChainId,
                false,
                0,
                0
            );
        }
        
        amountOut = netOut;
    }
    
    function whitelistAdapter(address adapter, bool status) external onlyOwner {
        whitelistedAdapter[adapter] = status;
        emit AdapterWhitelisted(adapter, status);
    }
    
    function setNativeWrapped(address wrapped) external onlyOwner {
        nativeToWrapped[NATIVE_MARKER] = wrapped;
        emit NativeWrappedSet(wrapped);
    }
    
    function setFeeSink(address _feeSink) external onlyOwner {
        feeSink = _feeSink;
    }
    
    function setTwapOracle(address _twapOracle) external onlyOwner {
        twapOracle = _twapOracle;
    }
    
    // Phase 1: Gasless fee configuration
    function setGaslessFeeConfig(uint16 _feeBps, address _feeRecipient) external onlyOwner {
        require(_feeBps <= 200, "Fee too high"); // Max 2%
        gaslessFeeBps = _feeBps;
        gaslessFeeRecipient = _feeRecipient;
    }
    
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    receive() external payable {}
}
