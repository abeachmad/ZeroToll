// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BatchExecutor
 * @notice Implementation contract for EIP-7702 batch execution
 * @dev This contract is delegated to by EOAs via EIP-7702
 * 
 * When an EOA delegates to this contract:
 * 1. The EOA can execute batch transactions
 * 2. All calls are executed atomically
 * 3. If any call fails, the entire transaction reverts
 * 
 * Based on:
 * - https://www.quicknode.com/guides/ethereum-development/smart-contracts/eip-7702-smart-accounts
 * - https://docs.onebalance.io/guides/eip-7702/getting-started
 */
contract BatchExecutor {
    /// @notice Struct representing a single call
    struct Call {
        address to;      // Target address
        uint256 value;   // ETH value to send
        bytes data;      // Calldata
    }

    /// @notice Emitted when a batch is executed
    event BatchExecuted(address indexed executor, uint256 callCount);

    /// @notice Emitted for each individual call
    event CallExecuted(
        address indexed executor,
        address indexed target,
        uint256 value,
        bytes data
    );

    /**
     * @notice Execute a batch of calls
     * @dev Can only be called when this contract is delegated to via EIP-7702
     * @param calls Array of calls to execute
     */
    function execute(Call[] calldata calls) external payable {
        // Verify that msg.sender == address(this)
        // This ensures the call is coming from an EOA that has delegated to this contract
        require(
            msg.sender == address(this),
            "BatchExecutor: must be called via delegation"
        );

        uint256 callCount = calls.length;
        require(callCount > 0, "BatchExecutor: no calls provided");

        // Execute each call
        for (uint256 i = 0; i < callCount; i++) {
            _executeCall(calls[i]);
        }

        emit BatchExecuted(msg.sender, callCount);
    }

    /**
     * @notice Execute a single call
     * @param call The call to execute
     */
    function _executeCall(Call calldata call) internal {
        (bool success, bytes memory returnData) = call.to.call{value: call.value}(call.data);
        
        if (!success) {
            // If the call failed, revert with the error message
            if (returnData.length > 0) {
                // Bubble up the revert reason
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert("BatchExecutor: call failed");
            }
        }

        emit CallExecuted(msg.sender, call.to, call.value, call.data);
    }

    /**
     * @notice Allow contract to receive ETH
     */
    receive() external payable {}
}
