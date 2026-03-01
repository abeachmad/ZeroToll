// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimpleMockOracle
 * @notice Simple price oracle yang bisa di-update manual untuk testing
 * @dev Untuk testnet saja! Harga bisa di-update oleh owner berdasarkan Pyth API off-chain
 * 
 * Konsep:
 * - Backend fetch harga LIVE dari Pyth REST API (off-chain)
 * - Backend update harga di oracle ini secara periodik (misal tiap 30 detik)
 * - Adapter query oracle ini untuk swap execution
 * - User tetap dapat harga LIVE, tapi tanpa perlu Pyth contract on-chain
 */
contract SimpleMockOracle {
    address public owner;
    
    // Token address => price in USD (8 decimals, e.g., 3450.06 = 345006000000)
    mapping(address => uint256) public prices;
    
    // Last update timestamp per token
    mapping(address => uint256) public lastUpdate;
    
    // Max price age (default: 2 minutes)
    uint256 public constant MAX_PRICE_AGE = 120;
    
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Update price untuk satu token
     * @param token Token address
     * @param price Price in USD (8 decimals)
     */
    function setPrice(address token, uint256 price) external onlyOwner {
        require(price > 0, "Price must be > 0");
        prices[token] = price;
        lastUpdate[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }
    
    /**
     * @notice Update prices untuk multiple tokens (batch)
     * @param tokens Array of token addresses
     * @param newPrices Array of prices (8 decimals)
     */
    function setPrices(address[] calldata tokens, uint256[] calldata newPrices) external onlyOwner {
        require(tokens.length == newPrices.length, "Length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(newPrices[i] > 0, "Price must be > 0");
            prices[tokens[i]] = newPrices[i];
            lastUpdate[tokens[i]] = block.timestamp;
            emit PriceUpdated(tokens[i], newPrices[i], block.timestamp);
        }
    }
    
    /**
     * @notice Get price (compatible dengan MockDEXAdapter interface)
     * @param token Token address
     * @return priceUSD Price in USD (8 decimals)
     */
    function getPrice(address token) external view returns (uint256 priceUSD) {
        priceUSD = prices[token];
        require(priceUSD > 0, "Price not set");
        
        // Optional: Check if price is stale (commented out for simplicity)
        // uint256 age = block.timestamp - lastUpdate[token];
        // require(age < MAX_PRICE_AGE, "Price too old");
        
        return priceUSD;
    }
    
    /**
     * @notice Check if price is configured
     * @param token Token address
     * @return configured True if price is set
     */
    function isPriceConfigured(address token) external view returns (bool configured) {
        return prices[token] > 0;
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
