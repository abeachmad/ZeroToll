// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceOracle.sol";

interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
}

contract PythPriceOracle is IPriceOracle {
    IPyth public immutable pyth;
    bytes32 public immutable priceId;
    uint8 public immutable targetDecimals;
    
    constructor(address _pyth, bytes32 _priceId, uint8 _targetDecimals) {
        pyth = IPyth(_pyth);
        priceId = _priceId;
        targetDecimals = _targetDecimals;
    }
    
    function getPrice() external view override returns (uint256) {
        IPyth.Price memory priceData = pyth.getPriceUnsafe(priceId);
        require(priceData.price > 0, "Invalid price");
        
        uint256 price = uint256(uint64(priceData.price));
        int32 expo = priceData.expo;
        
        if (expo < 0) {
            uint32 absExpo = uint32(-expo);
            if (absExpo < targetDecimals) {
                price = price * (10 ** (targetDecimals - absExpo));
            } else {
                price = price / (10 ** (absExpo - targetDecimals));
            }
        } else {
            price = price * (10 ** (targetDecimals + uint32(expo)));
        }
        
        return price;
    }
    
    function lastUpdated() external view override returns (uint256) {
        IPyth.Price memory priceData = pyth.getPriceUnsafe(priceId);
        return priceData.publishTime;
    }
}
