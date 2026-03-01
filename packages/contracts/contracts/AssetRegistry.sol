// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/IntentLib.sol";

contract AssetRegistry is Ownable {
    struct AssetConfig {
        address tokenAddress;
        uint8 decimals;
        bool hasPermit2;
        bool hasEIP2612;
        bool isFeeOnTransfer;
        bool isRebasing;
        string oracleSource;      // "chainlink" | "twap" | "none"
        uint256 minLiquidityUSD;  // in 1e6 (USDC units)
        bool allowNative;
        bool allowInputSource;
        bool allowOutputDest;
        bool allowStable;
        bool isActive;
    }
    
    mapping(string => AssetConfig) public assets;  // symbol => config
    string[] public supportedSymbols;
    
    event AssetRegistered(string symbol, address tokenAddress);
    event AssetUpdated(string symbol);
    event AssetDeactivated(string symbol);
    
    constructor() Ownable(msg.sender) {}
    
    function registerAsset(
        string calldata symbol,
        address tokenAddress,
        uint8 decimals,
        bool hasPermit2,
        bool hasEIP2612,
        bool isFeeOnTransfer,
        bool isRebasing,
        string calldata oracleSource,
        uint256 minLiquidityUSD,
        bool allowNative,
        bool allowInputSource,
        bool allowOutputDest,
        bool allowStable
    ) external onlyOwner {
        require(assets[symbol].tokenAddress == address(0), "Asset already registered");
        
        assets[symbol] = AssetConfig({
            tokenAddress: tokenAddress,
            decimals: decimals,
            hasPermit2: hasPermit2,
            hasEIP2612: hasEIP2612,
            isFeeOnTransfer: isFeeOnTransfer,
            isRebasing: isRebasing,
            oracleSource: oracleSource,
            minLiquidityUSD: minLiquidityUSD,
            allowNative: allowNative,
            allowInputSource: allowInputSource,
            allowOutputDest: allowOutputDest,
            allowStable: allowStable,
            isActive: true
        });
        
        supportedSymbols.push(symbol);
        emit AssetRegistered(symbol, tokenAddress);
    }
    
    function updateAsset(
        string calldata symbol,
        string calldata oracleSource,
        uint256 minLiquidityUSD,
        bool allowNative,
        bool allowInputSource,
        bool allowOutputDest,
        bool allowStable
    ) external onlyOwner {
        AssetConfig storage asset = assets[symbol];
        require(asset.tokenAddress != address(0), "Asset not registered");
        
        asset.oracleSource = oracleSource;
        asset.minLiquidityUSD = minLiquidityUSD;
        asset.allowNative = allowNative;
        asset.allowInputSource = allowInputSource;
        asset.allowOutputDest = allowOutputDest;
        asset.allowStable = allowStable;
        
        emit AssetUpdated(symbol);
    }
    
    function deactivateAsset(string calldata symbol) external onlyOwner {
        assets[symbol].isActive = false;
        emit AssetDeactivated(symbol);
    }
    
    function isModeAllowed(address token, FeeAssetMode mode) external view returns (bool) {
        // Find symbol for token
        for (uint i = 0; i < supportedSymbols.length; i++) {
            AssetConfig memory asset = assets[supportedSymbols[i]];
            if (asset.tokenAddress == token && asset.isActive) {
                if (mode == FeeAssetMode.NATIVE) return asset.allowNative;
                if (mode == FeeAssetMode.TOKEN_INPUT_SOURCE) return asset.allowInputSource;
                if (mode == FeeAssetMode.TOKEN_OUTPUT_DEST) return asset.allowOutputDest;
                if (mode == FeeAssetMode.TOKEN_STABLE) return asset.allowStable;
            }
        }
        return false;
    }
    
    function getAssetConfig(address token) external view returns (AssetConfig memory) {
        for (uint i = 0; i < supportedSymbols.length; i++) {
            AssetConfig memory asset = assets[supportedSymbols[i]];
            if (asset.tokenAddress == token) {
                return asset;
            }
        }
        revert("Asset not found");
    }
    
    function getSupportedTokens() external view returns (string[] memory) {
        return supportedSymbols;
    }
}
