// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title GaslessTestToken
 * @notice Test token with built-in Permit support for gasless approvals
 * @dev Anyone can mint for testing. Supports ERC-2612 Permit.
 */
contract GaslessTestToken is ERC20, ERC20Permit {
    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        ERC20Permit(name) 
    {}

    /**
     * @notice Mint tokens to any address (for testing only)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Mint tokens to caller
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**18); // 1000 tokens
    }
}
