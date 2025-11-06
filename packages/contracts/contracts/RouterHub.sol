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
    
    event RouteExecuted(
        bytes32 indexed intentId,
        uint256 amountOut,
        uint256 dstChainId,
        bool outIsNative,
        uint256 outGrossWrapped,
        uint256 outNetNative
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
        bool isNativeOut = intent.tokenOut == NATIVE_MARKER;
        
        // Handle output-fee mode with native unwrap
        if (intent.feeMode == FeeAssetMode.TOKEN_OUTPUT_DEST && isNativeOut) {
            // Skim fee from wrapped, then unwrap remainder
            uint256 feeAmount = (grossOut * intent.feeCapToken) / 10000; // simplified
            if (feeAmount > 0) {
                IERC20(tokenOut).transfer(feeSink, feeAmount);
            }
            netOut = grossOut - feeAmount;
            
            // Unwrap to native
            IWETH(tokenOut).withdraw(netOut);
            payable(msg.sender).transfer(netOut);
            
            emit RouteExecuted(
                IntentLib.hashIntent(intent),
                grossOut,
                intent.dstChainId,
                true,
                grossOut,
                netOut
            );
        } else if (isNativeOut) {
            // No fee deduction, just unwrap
            IWETH(tokenOut).withdraw(grossOut);
            payable(msg.sender).transfer(grossOut);
            
            emit RouteExecuted(
                IntentLib.hashIntent(intent),
                grossOut,
                intent.dstChainId,
                true,
                grossOut,
                grossOut
            );
        } else {
            // Standard ERC20 output
            IERC20(tokenOut).transfer(msg.sender, grossOut);
            
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
    
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    receive() external payable {}
}
