// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    uint256 private price; // stable per native token (18 decimals)
    uint256 private lastUpdate;
    
    constructor(uint256 initialPrice) {
        price = initialPrice;
        lastUpdate = block.timestamp;
    }
    
    function getPrice() external view returns (uint256) {
        return price;
    }
    
    function setPrice(uint256 newPrice) external {
        price = newPrice;
        lastUpdate = block.timestamp;
    }
    
    function lastUpdated() external view returns (uint256) {
        return lastUpdate;
    }
}
