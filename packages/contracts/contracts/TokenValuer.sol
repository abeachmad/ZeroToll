// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPriceOracle.sol";

contract TokenValuer is Ownable {
    mapping(address => address) public priceOracles;  // token => oracle
    mapping(address => address) public twapOracles;   // token => TWAP oracle
    
    uint256 public maxDeviationBps = 500;  // 5%
    uint256 public staleAfter = 3600;      // 1 hour
    
    event OracleSet(address indexed token, address priceOracle, address twapOracle);
    event DeviationUpdated(uint256 maxDeviationBps);
    
    constructor() Ownable(msg.sender) {}
    
    function setOracle(address token, address priceOracle, address twapOracle) external onlyOwner {
        priceOracles[token] = priceOracle;
        twapOracles[token] = twapOracle;
        emit OracleSet(token, priceOracle, twapOracle);
    }
    
    function setMaxDeviation(uint256 _maxDeviationBps) external onlyOwner {
        require(_maxDeviationBps <= 10000, "Invalid deviation");
        maxDeviationBps = _maxDeviationBps;
        emit DeviationUpdated(_maxDeviationBps);
    }
    
    function getPrice(address token) external view returns (uint256) {
        address oracle = priceOracles[token];
        address twap = twapOracles[token];
        
        require(oracle != address(0), "No oracle for token");
        
        uint256 price = IPriceOracle(oracle).getPrice();
        uint256 lastUpdate = IPriceOracle(oracle).lastUpdated();
        
        require(block.timestamp - lastUpdate <= staleAfter, "Oracle price stale");
        
        // If TWAP available, check deviation
        if (twap != address(0)) {
            uint256 twapPrice = IPriceOracle(twap).getPrice();
            uint256 deviation = price > twapPrice 
                ? ((price - twapPrice) * 10000) / twapPrice
                : ((twapPrice - price) * 10000) / price;
            
            require(deviation <= maxDeviationBps, "Price deviation too high");
        }
        
        return price;
    }
    
    function convertNativeToToken(uint256 nativeAmount, address token) external view returns (uint256) {
        uint256 price = this.getPrice(token);  // token per native (18 decimals)
        return (nativeAmount * price) / 1e18;
    }
    
    function convertTokenToToken(uint256 amount, address fromToken, address toToken) external view returns (uint256) {
        uint256 fromPrice = this.getPrice(fromToken);
        uint256 toPrice = this.getPrice(toToken);
        return (amount * fromPrice) / toPrice;
    }
}
