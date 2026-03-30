// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPermit2 {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    struct AllowanceData {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    mapping(address => mapping(address => mapping(address => AllowanceData))) private _allowances;

    function permit(address owner, PermitSingle memory permitSingle, bytes calldata) external {
        require(permitSingle.sigDeadline >= block.timestamp, "Permit expired");

        _allowances[owner][permitSingle.details.token][permitSingle.spender] = AllowanceData({
            amount: permitSingle.details.amount,
            expiration: permitSingle.details.expiration,
            nonce: permitSingle.details.nonce
        });
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        AllowanceData storage allowanceData = _allowances[from][token][msg.sender];
        require(allowanceData.expiration >= block.timestamp, "Allowance expired");
        require(allowanceData.amount >= amount, "Insufficient Permit2 allowance");

        allowanceData.amount -= amount;
        IERC20(token).transferFrom(from, to, amount);
    }

    function allowance(
        address user,
        address token,
        address spender
    ) external view returns (uint160 amount, uint48 expiration, uint48 nonce) {
        AllowanceData memory allowanceData = _allowances[user][token][spender];
        return (allowanceData.amount, allowanceData.expiration, allowanceData.nonce);
    }
}
