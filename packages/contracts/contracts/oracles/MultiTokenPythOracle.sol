// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiTokenPythOracle
 * @notice Oracle that fetches prices from Pyth Network for multiple tokens
 * @dev Uses Pyth's price feeds to get real-time prices - NO HARDCODING!
 */

interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
    function getPrice(bytes32 id) external view returns (Price memory);
}

contract MultiTokenPythOracle {
    IPyth public immutable pyth;
    address public owner;
    
    // Mapping: token address => Pyth price feed ID
    mapping(address => bytes32) public tokenToPriceId;
    
    // Price decimals (8 for consistency with Pyth)
    uint8 public constant PRICE_DECIMALS = 8;
    
    event PriceIdSet(address indexed token, bytes32 priceId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _pyth) {
        require(_pyth != address(0), "Invalid Pyth address");
        pyth = IPyth(_pyth);
        owner = msg.sender;
    }
    
    /**
     * @notice Set Pyth price feed ID for a token
     * @param token Token address
     * @param priceId Pyth price feed ID (e.g., ETH/USD, USDC/USD)
     */
    function setPriceId(address token, bytes32 priceId) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(priceId != bytes32(0), "Invalid price ID");
        tokenToPriceId[token] = priceId;
        emit PriceIdSet(token, priceId);
    }
    
    /**
     * @notice Set multiple price IDs at once
     * @param tokens Array of token addresses
     * @param priceIds Array of Pyth price feed IDs
     */
    function setPriceIds(address[] calldata tokens, bytes32[] calldata priceIds) external onlyOwner {
        require(tokens.length == priceIds.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token");
            require(priceIds[i] != bytes32(0), "Invalid price ID");
            tokenToPriceId[tokens[i]] = priceIds[i];
            emit PriceIdSet(tokens[i], priceIds[i]);
        }
    }
    
    /**
     * @notice Get price for a token in USD (8 decimals)
     * @param token Token address
     * @return priceUSD Price in USD with 8 decimals (e.g., 3709.35 ETH = 370935000000)
     */
    function getPrice(address token) external view returns (uint256 priceUSD) {
        bytes32 priceId = tokenToPriceId[token];
        require(priceId != bytes32(0), "Price ID not set");
        
        IPyth.Price memory priceData = pyth.getPriceUnsafe(priceId);
        require(priceData.price > 0, "Invalid price");
        
        // Pyth prices come with expo (e.g., price = 3709.35, expo = -8 means 370935000000)
        // We want to normalize to 8 decimals
        int64 price = priceData.price;
        int32 expo = priceData.expo;
        
        // Convert to positive price
        priceUSD = uint256(uint64(price));
        
        // Adjust for exponent to get 8 decimals
        if (expo < 0) {
            int32 targetExpo = -8; // We want 8 decimals
            int32 adjustment = targetExpo - expo;
            
            if (adjustment > 0) {
                priceUSD = priceUSD * (10 ** uint32(adjustment));
            } else if (adjustment < 0) {
                priceUSD = priceUSD / (10 ** uint32(-adjustment));
            }
            // If adjustment == 0, price is already at 8 decimals
        } else {
            // Positive expo (rare) - price is very large
            priceUSD = priceUSD * (10 ** uint32(expo + 8));
        }
        
        return priceUSD;
    }
    
    /**
     * @notice Check if price feed is configured for a token
     * @param token Token address
     * @return configured True if price feed is set
     */
    function isPriceConfigured(address token) external view returns (bool configured) {
        return tokenToPriceId[token] != bytes32(0);
    }
    
    /**
     * @notice Get the last update timestamp for a token's price
     * @param token Token address
     * @return timestamp Last update timestamp
     */
    function getLastUpdated(address token) external view returns (uint256 timestamp) {
        bytes32 priceId = tokenToPriceId[token];
        require(priceId != bytes32(0), "Price ID not set");
        
        IPyth.Price memory priceData = pyth.getPriceUnsafe(priceId);
        return priceData.publishTime;
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
