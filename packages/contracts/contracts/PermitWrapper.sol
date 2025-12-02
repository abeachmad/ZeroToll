// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PermitWrapper
 * @notice Wraps any ERC-20 token with ERC-2612 Permit support
 * @dev Users deposit underlying token, get permit-enabled wrapper token
 *      Enables gasless approvals for tokens that don't support Permit
 */
contract PermitWrapper is ERC20, ERC20Permit {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint8 private immutable _decimals;

    event Wrapped(address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);

    constructor(
        address _underlying,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) ERC20Permit(name) {
        underlying = IERC20(_underlying);
        // Get decimals from underlying token
        (bool success, bytes memory data) = _underlying.staticcall(abi.encodeWithSignature("decimals()"));
        _decimals = success && data.length == 32 ? abi.decode(data, (uint8)) : 18;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Wrap underlying tokens to get permit-enabled wrapper tokens
     * @param amount Amount of underlying tokens to wrap
     */
    function wrap(uint256 amount) external {
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Wrapped(msg.sender, amount);
    }

    /**
     * @notice Unwrap to get underlying tokens back
     * @param amount Amount of wrapper tokens to unwrap
     */
    function unwrap(uint256 amount) external {
        _burn(msg.sender, amount);
        underlying.safeTransfer(msg.sender, amount);
        emit Unwrapped(msg.sender, amount);
    }

    /**
     * @notice Wrap with permit (gasless wrap for tokens with permit)
     */
    function wrapWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Try to use permit on underlying (if supported)
        try IERC20Permit(address(underlying)).permit(
            msg.sender, address(this), amount, deadline, v, r, s
        ) {} catch {}
        
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Wrapped(msg.sender, amount);
    }
}

/**
 * @title PermitWETH (pWETH)
 * @notice Permit-enabled wrapper for WETH
 */
contract PermitWETH is PermitWrapper {
    constructor(address weth) PermitWrapper(weth, "Permit WETH", "pWETH") {}
}

/**
 * @title PermitUSDC (pUSDC)
 * @notice Permit-enabled wrapper for USDC
 */
contract PermitUSDC is PermitWrapper {
    constructor(address usdc) PermitWrapper(usdc, "Permit USDC", "pUSDC") {}
}
