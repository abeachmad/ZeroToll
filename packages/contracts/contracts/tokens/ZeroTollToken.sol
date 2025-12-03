// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZeroTollToken
 * @notice ERC-2612 compliant token for ZeroToll gasless swaps
 * @dev Supports permit() for gasless approvals, configurable decimals
 * 
 * These tokens mirror real asset prices via Pyth oracle:
 * - zUSDC: mirrors USDC/USD price (6 decimals)
 * - zETH: mirrors ETH/USD price (18 decimals)
 * - zPOL: mirrors POL/USD price (18 decimals)
 * - zLINK: mirrors LINK/USD price (18 decimals)
 */
contract ZeroTollToken is ERC20, ERC20Permit, Ownable {
    uint8 private immutable _decimals;
    
    // Pyth price feed ID for this token's underlying asset
    bytes32 public pythPriceId;
    
    // Maximum supply (0 = unlimited)
    uint256 public maxSupply;
    
    event PythPriceIdSet(bytes32 indexed priceId);
    event MaxSupplySet(uint256 maxSupply);

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        bytes32 _pythPriceId
    ) 
        ERC20(name, symbol) 
        ERC20Permit(name)
        Ownable(msg.sender)
    {
        _decimals = decimals_;
        pythPriceId = _pythPriceId;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens to any address (owner only in production)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (maxSupply > 0) {
            require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        }
        _mint(to, amount);
    }

    /**
     * @notice Faucet for testnet - anyone can mint small amounts
     * @dev Mints 1000 tokens to caller
     */
    function faucet() external {
        uint256 amount = 1000 * (10 ** _decimals);
        if (maxSupply > 0) {
            require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        }
        _mint(msg.sender, amount);
    }

    /**
     * @notice Faucet with custom amount for testnet
     * @param amount Amount to mint (in token units with decimals)
     */
    function faucetAmount(uint256 amount) external {
        // Limit faucet to 10,000 tokens per call
        uint256 maxFaucet = 10000 * (10 ** _decimals);
        require(amount <= maxFaucet, "Faucet limit exceeded");
        
        if (maxSupply > 0) {
            require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        }
        _mint(msg.sender, amount);
    }

    /**
     * @notice Update Pyth price feed ID
     * @param _pythPriceId New Pyth price feed ID
     */
    function setPythPriceId(bytes32 _pythPriceId) external onlyOwner {
        pythPriceId = _pythPriceId;
        emit PythPriceIdSet(_pythPriceId);
    }

    /**
     * @notice Set maximum supply (0 = unlimited)
     * @param _maxSupply Maximum token supply
     */
    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        require(_maxSupply == 0 || _maxSupply >= totalSupply(), "Below current supply");
        maxSupply = _maxSupply;
        emit MaxSupplySet(_maxSupply);
    }

    /**
     * @notice Burn tokens from caller
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
