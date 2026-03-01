// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

contract TestPermitCaller {
    event PermitResult(bool success, string reason);
    
    function testPermit(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool success, string memory reason) {
        try IERC20Permit(token).permit(owner, spender, value, deadline, v, r, s) {
            success = true;
            reason = "Success";
            emit PermitResult(true, "Success");
        } catch Error(string memory err) {
            success = false;
            reason = err;
            emit PermitResult(false, err);
        } catch (bytes memory lowLevelData) {
            success = false;
            reason = string(abi.encodePacked("Low level error: 0x", _toHex(lowLevelData)));
            emit PermitResult(false, reason);
        }
    }
    
    function _toHex(bytes memory data) internal pure returns (bytes memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(data.length * 2);
        for (uint i = 0; i < data.length; i++) {
            result[i * 2] = hexChars[uint8(data[i] >> 4)];
            result[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return result;
    }
}
