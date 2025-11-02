// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/IntentLib.sol";

contract RouterHub is Ownable, ReentrancyGuard {
    mapping(address => bool) public whitelistedAdapter;
    address public twapOracle;
    
    event RouteExecuted(bytes32 indexed intentId, uint256 amountOut, uint256 dstChainId);
    event AdapterWhitelisted(address indexed adapter, bool status);
    
    constructor() Ownable(msg.sender) {}
    
    function executeRoute(
        IntentLib.Intent calldata intent,
        address adapter,
        bytes calldata routeData
    ) external nonReentrant returns (uint256 amountOut) {
        require(whitelistedAdapter[adapter], "Adapter not whitelisted");
        require(block.timestamp <= intent.deadline, "Intent expired");
        
        // Pull tokens from sender
        require(
            IERC20(intent.tokenIn).transferFrom(msg.sender, address(this), intent.amtIn),
            "Transfer failed"
        );
        
        // Approve adapter
        IERC20(intent.tokenIn).approve(adapter, intent.amtIn);
        
        // Execute route via adapter with gas limit
        (bool success, bytes memory result) = adapter.call{gas: 500000}(routeData);
        require(success, "Adapter call failed");
        require(result.length > 0, "Empty result");
        
        // Reset approval to 0 for security
        IERC20(intent.tokenIn).approve(adapter, 0);
        
        amountOut = abi.decode(result, (uint256));
        require(amountOut >= intent.minOut, "Slippage exceeded");
        require(amountOut > 0, "Invalid output amount");
        
        bytes32 intentId = IntentLib.hashIntent(intent);
        emit RouteExecuted(intentId, amountOut, intent.dstChainId);
    }
    
    function whitelistAdapter(address adapter, bool status) external onlyOwner {
        whitelistedAdapter[adapter] = status;
        emit AdapterWhitelisted(adapter, status);
    }
    
    function setTwapOracle(address _twapOracle) external onlyOwner {
        twapOracle = _twapOracle;
    }
    
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
