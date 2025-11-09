// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TestnetPriceOracle
 * @notice Configurable price oracle for TESTNET ONLY
 * @dev Allows setting prices externally - DO NOT use on mainnet!
 * 
 * Key features:
 * - No hardcoded prices (all configurable)
 * - Owner can update prices anytime
 * - Prices stored per token address
 * - Events for price updates (auditable)
 * 
 * Security: Owner has full control - use multi-sig on production testnets
 * 
 * Interface: Same as MultiTokenPythOracle - getPrice(address token)
 */
contract TestnetPriceOracle {
    address public owner;
    
    // Token address => price in 8 decimals (e.g., $3445.50 = 344550000000)
    mapping(address => uint256) public prices;
    
    event PriceUpdated(address indexed token, uint256 oldPrice, uint256 newPrice);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Get price for a token
     * @param token Token address to query
     * @return price Price in 8 decimals (e.g., $1.50 = 150000000)
     */
    function getPrice(address token) external view returns (uint256 price) {
        price = prices[token];
        require(price > 0, "Price not set");
        return price;
    }
    
    /**
     * @notice Set price for a single token
     * @param token Token address
     * @param price Price in 8 decimals
     */
    function setPrice(address token, uint256 price) external onlyOwner {
        require(token != address(0), "Zero address");
        require(price > 0, "Price must be > 0");
        
        uint256 oldPrice = prices[token];
        prices[token] = price;
        
        emit PriceUpdated(token, oldPrice, price);
    }
    
    /**
     * @notice Batch set prices for multiple tokens
     * @param tokens Array of token addresses
     * @param newPrices Array of prices (8 decimals)
     */
    function setPrices(address[] calldata tokens, uint256[] calldata newPrices) external onlyOwner {
        require(tokens.length == newPrices.length, "Length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Zero address");
            require(newPrices[i] > 0, "Price must be > 0");
            
            uint256 oldPrice = prices[tokens[i]];
            prices[tokens[i]] = newPrices[i];
            
            emit PriceUpdated(tokens[i], oldPrice, newPrices[i]);
        }
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @notice Check if price is set for a token
     * @param token Token address
     * @return true if price exists
     */
    function hasPrice(address token) external view returns (bool) {
        return prices[token] > 0;
    }
}
