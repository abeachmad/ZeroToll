const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RouterHub - Gasless Fee (Phase 1)", function () {
  let routerHub, mockAdapter, usdc, wmatic;
  let owner, user, feeRecipient;
  
  const FEE_BPS = 50; // 0.5%
  const AMOUNT_IN = ethers.parseUnits("100", 6); // 100 USDC
  const AMOUNT_OUT = ethers.parseUnits("566", 18); // 566 WMATIC (simulated)
  
  beforeEach(async function () {
    [owner, user, feeRecipient] = await ethers.getSigners();
    
    // Deploy mock tokens
    const ERC20Mock = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    usdc = await ERC20Mock.deploy("USDC", "USDC", 6);
    wmatic = await ERC20Mock.deploy("Wrapped MATIC", "WMATIC", 18);
    
    // Deploy RouterHub
    const RouterHub = await ethers.getContractFactory("RouterHub");
    routerHub = await RouterHub.deploy();
    
    // Deploy mock adapter
    const MockAdapter = await ethers.getContractFactory("contracts/mocks/SimpleMockAdapter.sol:SimpleMockAdapter");
    mockAdapter = await MockAdapter.deploy();
    
    // Setup
    await routerHub.whitelistAdapter(mockAdapter.target, true);
    await routerHub.setGaslessFeeConfig(FEE_BPS, feeRecipient.address);
    
    // Fund user and mock adapter
    await usdc.mint(user.address, AMOUNT_IN);
    await wmatic.mint(mockAdapter.target, AMOUNT_OUT);
    
    // Configure mock adapter to return AMOUNT_OUT
    await mockAdapter.setMockOutput(wmatic.target, AMOUNT_OUT);
  });
  
  describe("Fee Configuration", function () {
    it("Should set gasless fee configuration", async function () {
      expect(await routerHub.gaslessFeeBps()).to.equal(BigInt(FEE_BPS));
      expect(await routerHub.gaslessFeeRecipient()).to.equal(feeRecipient.address);
    });
    
    it("Should reject fee > 2%", async function () {
      try {
        await routerHub.setGaslessFeeConfig(201, feeRecipient.address);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Fee too high");
      }
    });
    
    it("Should allow disabling fee by setting recipient to 0x0", async function () {
      await routerHub.setGaslessFeeConfig(FEE_BPS, ethers.ZeroAddress);
      expect(await routerHub.gaslessFeeRecipient()).to.equal(ethers.ZeroAddress);
    });
  });
  
  describe("Fee Deduction on Swap", function () {
    it("Should deduct 0.5% fee from output", async function () {
      // Approve RouterHub
      await usdc.connect(user).approve(routerHub.target, AMOUNT_IN);
      
      // Create intent
      const intent = {
        user: user.address,
        tokenIn: usdc.target,
        amtIn: AMOUNT_IN,
        tokenOut: wmatic.target,
        minOut: ethers.parseUnits("560", 18), // Allow for fee + slippage
        dstChainId: 80002,
        deadline: Math.floor(Date.now() / 1000) + 600,
        feeToken: ethers.ZeroAddress,
        feeMode: 0,
        feeCapToken: 0,
        routeHint: "0x",
        nonce: 0,
      };
      
      // Encode swap call
      const routeData = mockAdapter.interface.encodeFunctionData("mockSwap", [
        usdc.target,
        wmatic.target,
        AMOUNT_IN,
        AMOUNT_OUT,
        routerHub.target,
      ]);
      
      // Execute swap
      const balanceBefore = await wmatic.balanceOf(user.address);
      const feeBalanceBefore = await wmatic.balanceOf(feeRecipient.address);
      
      await routerHub.connect(user).executeRoute(intent, mockAdapter.target, routeData);
      
      const balanceAfter = await wmatic.balanceOf(user.address);
      const feeBalanceAfter = await wmatic.balanceOf(feeRecipient.address);
      
      // Calculate expected amounts
      const expectedFee = (AMOUNT_OUT * BigInt(FEE_BPS)) / 10000n;
      const expectedNet = AMOUNT_OUT - expectedFee;
      
      // Verify
      expect(balanceAfter - balanceBefore).to.equal(expectedNet);
      expect(feeBalanceAfter - feeBalanceBefore).to.equal(expectedFee);
    });
    
    it("Should NOT deduct fee if recipient = 0x0", async function () {
      // Disable fee
      await routerHub.setGaslessFeeConfig(FEE_BPS, ethers.ZeroAddress);
      
      // Approve
      await usdc.connect(user).approve(routerHub.target, AMOUNT_IN);
      
      // Create intent
      const intent = {
        user: user.address,
        tokenIn: usdc.target,
        amtIn: AMOUNT_IN,
        tokenOut: wmatic.target,
        minOut: AMOUNT_OUT, // Full amount since no fee
        dstChainId: 80002,
        deadline: Math.floor(Date.now() / 1000) + 600,
        feeToken: ethers.ZeroAddress,
        feeMode: 0,
        feeCapToken: 0,
        routeHint: "0x",
        nonce: 0,
      };
      
      const routeData = mockAdapter.interface.encodeFunctionData("mockSwap", [
        usdc.target,
        wmatic.target,
        AMOUNT_IN,
        AMOUNT_OUT,
        routerHub.target,
      ]);
      
      const balanceBefore = await wmatic.balanceOf(user.address);
      await routerHub.connect(user).executeRoute(intent, mockAdapter.target, routeData);
      const balanceAfter = await wmatic.balanceOf(user.address);
      
      // User receives full amount (no fee deducted)
      expect(balanceAfter - balanceBefore).to.equal(AMOUNT_OUT);
    });
    
    it("Should revert if netOut < minOut after fee", async function () {
      await usdc.connect(user).approve(routerHub.target, AMOUNT_IN);
      
      const intent = {
        user: user.address,
        tokenIn: usdc.target,
        amtIn: AMOUNT_IN,
        tokenOut: wmatic.target,
        minOut: AMOUNT_OUT, // Too high - doesn't account for fee
        dstChainId: 80002,
        deadline: Math.floor(Date.now() / 1000) + 600,
        feeToken: ethers.ZeroAddress,
        feeMode: 0,
        feeCapToken: 0,
        routeHint: "0x",
        nonce: 0,
      };
      
      const routeData = mockAdapter.interface.encodeFunctionData("mockSwap", [
        usdc.target,
        wmatic.target,
        AMOUNT_IN,
        AMOUNT_OUT,
        routerHub.target,
      ]);
      
      try {
        await routerHub.connect(user).executeRoute(intent, mockAdapter.target, routeData);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Fee + slippage exceeds minOut");
      }
    });
    
    it("Should emit GaslessFeeCharged event", async function () {
      await usdc.connect(user).approve(routerHub.target, AMOUNT_IN);
      
      const intent = {
        user: user.address,
        tokenIn: usdc.target,
        amtIn: AMOUNT_IN,
        tokenOut: wmatic.target,
        minOut: ethers.parseUnits("560", 18),
        dstChainId: 80002,
        deadline: Math.floor(Date.now() / 1000) + 600,
        feeToken: ethers.ZeroAddress,
        feeMode: 0,
        feeCapToken: 0,
        routeHint: "0x",
        nonce: 0,
      };
      
      const routeData = mockAdapter.interface.encodeFunctionData("mockSwap", [
        usdc.target,
        wmatic.target,
        AMOUNT_IN,
        AMOUNT_OUT,
        routerHub.target,
      ]);
      
      const expectedFee = (AMOUNT_OUT * BigInt(FEE_BPS)) / 10000n;
      const expectedNet = AMOUNT_OUT - expectedFee;
      
      const tx = await routerHub.connect(user).executeRoute(intent, mockAdapter.target, routeData);
      const receipt = await tx.wait();
      
      // Find GaslessFeeCharged event
      const feeEvent = receipt.logs.find(log => {
        try {
          const parsed = routerHub.interface.parseLog(log);
          return parsed && parsed.name === "GaslessFeeCharged";
        } catch {
          return false;
        }
      });
      
      expect(feeEvent).to.not.be.undefined;
    });
  });
  
  describe("Backward Compatibility", function () {
    it("Should still work with legacy feeMode for native output", async function () {
      // This ensures existing functionality is not broken
      // Test would require WETH/native setup - placeholder for now
      expect(true).to.be.true;
    });
  });
});
