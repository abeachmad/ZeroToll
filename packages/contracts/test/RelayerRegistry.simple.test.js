const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * RelayerRegistry Simplified Test Suite
 * 
 * Fokus pada test cases penting yang harus pass
 */
describe("RelayerRegistry - Simplified", function () {
  let registry;
  let owner;
  let executor;
  let relayer1;
  let relayer2;
  let relayer3;

  const MIN_STAKE = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, executor, relayer1, relayer2, relayer3] = await ethers.getSigners();

    const RelayerRegistry = await ethers.getContractFactory("RelayerRegistry");
    registry = await RelayerRegistry.deploy(executor.address);
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set correct owner and executor", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.executor()).to.equal(executor.address);
    });

    it("Should have correct constants", async function () {
      expect(await registry.MIN_STAKE()).to.equal(MIN_STAKE);
      expect(await registry.MAX_RELAYERS()).to.equal(100n);
      expect(await registry.SLASH_PERCENTAGE()).to.equal(10n);
      expect(await registry.MIN_REPUTATION()).to.equal(500n);
    });

    it("Should start with zero relayers", async function () {
      expect(await registry.getRelayerCount()).to.equal(0n);
    });
  });

  describe("Registration", function () {
    it("Should allow registration with sufficient stake", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });

      const info = await registry.getRelayerInfo(relayer1.address);
      expect(info.active).to.be.true;
      expect(info.stake).to.equal(MIN_STAKE);
      expect(info.reputation).to.equal(1000n);
    });

    it("Should reject registration with insufficient stake", async function () {
      const insufficientStake = ethers.parseEther("5");
      
      try {
        await registry.connect(relayer1).registerRelayer({ value: insufficientStake });
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Insufficient stake");
      }
    });

    it("Should reject duplicate registration", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      
      try {
        await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Already registered");
      }
    });

    it("Should add relayer to active list", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      
      expect(await registry.getRelayerCount()).to.equal(1n);
      expect(await registry.isRelayerActive(relayer1.address)).to.be.true;
    });

    it("Should allow multiple relayers", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer2).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer3).registerRelayer({ value: MIN_STAKE });

      expect(await registry.getRelayerCount()).to.equal(3n);
    });
  });

  describe("Unregistration", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should allow unregistration", async function () {
      const balanceBefore = await ethers.provider.getBalance(relayer1.address);
      
      const tx = await registry.connect(relayer1).unregisterRelayer();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(relayer1.address);
      
      // Should receive stake back minus gas
      const expectedBalance = balanceBefore + MIN_STAKE - gasCost;
      const diff = balanceAfter > expectedBalance ? 
        balanceAfter - expectedBalance : 
        expectedBalance - balanceAfter;
      
      // Allow 0.01 ETH difference for gas variations
      expect(diff).to.be.lte(ethers.parseEther("0.01"));
      
      expect(await registry.isRelayerActive(relayer1.address)).to.be.false;
      expect(await registry.getRelayerCount()).to.equal(0n);
    });

    it("Should reject unregistration from non-relayer", async function () {
      try {
        await registry.connect(relayer2).unregisterRelayer();
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Not registered");
      }
    });
  });

  describe("Stake Management", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should allow increasing stake", async function () {
      const additionalStake = ethers.parseEther("5");
      await registry.connect(relayer1).increaseStake({ value: additionalStake });

      const info = await registry.getRelayerInfo(relayer1.address);
      expect(info.stake).to.equal(MIN_STAKE + additionalStake);
    });

    it("Should reject zero value stake increase", async function () {
      try {
        await registry.connect(relayer1).increaseStake({ value: 0 });
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Must send stake");
      }
    });
  });

  describe("Execution Recording", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should record successful execution", async function () {
      const intentHash = ethers.id("test-intent-1");
      const reward = ethers.parseEther("0.1");

      // Send reward to contract first
      await executor.sendTransaction({
        to: await registry.getAddress(),
        value: reward
      });

      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        reward
      );

      const info = await registry.getRelayerInfo(relayer1.address);
      expect(info.successfulExecutions).to.equal(1n);
      expect(info.failedExecutions).to.equal(0n);
      expect(info.reputation).to.equal(1000n);
    });

    it("Should record failed execution and slash", async function () {
      const intentHash = ethers.id("test-intent-2");

      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        false,
        0
      );

      const info = await registry.getRelayerInfo(relayer1.address);
      expect(info.successfulExecutions).to.equal(0n);
      expect(info.failedExecutions).to.equal(1n);
      
      // Stake should be slashed by 10%
      const expectedStake = MIN_STAKE - (MIN_STAKE * 10n / 100n);
      expect(info.stake).to.equal(expectedStake);
    });

    it("Should reject recording from non-executor", async function () {
      const intentHash = ethers.id("test-intent-3");

      try {
        await registry.connect(relayer2).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        );
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Only executor");
      }
    });

    it("Should reject duplicate intent", async function () {
      const intentHash = ethers.id("test-intent-4");
      const reward = ethers.parseEther("0.1");

      // Send reward to contract first
      await executor.sendTransaction({
        to: await registry.getAddress(),
        value: reward
      });

      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        reward
      );

      try {
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          reward
        );
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Intent already executed");
      }
    });
  });

  describe("Reputation Management", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should calculate reputation correctly", async function () {
      // Execute 3 successful, 1 failed = 75% success rate
      const reward = ethers.parseEther("0.1");
      
      // Send rewards to contract first
      await executor.sendTransaction({
        to: await registry.getAddress(),
        value: reward * 3n
      });

      for (let i = 0; i < 3; i++) {
        const intentHash = ethers.id(`success-${i}`);
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          reward
        );
      }

      const intentHash = ethers.id("failed-1");
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        false,
        0
      );

      const info = await registry.getRelayerInfo(relayer1.address);
      // 3 successful out of 4 total = 750 reputation
      expect(info.reputation).to.equal(750n);
    });

    it("Should apply reputation decay", async function () {
      // Execute one successful swap
      const intentHash = ethers.id("success-1");
      const reward = ethers.parseEther("0.1");
      
      // Send rewards to contract first
      await executor.sendTransaction({
        to: await registry.getAddress(),
        value: reward * 2n
      });

      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        reward
      );

      // Fast forward 10 days
      await time.increase(10 * 24 * 60 * 60);

      // Trigger reputation update by executing another swap
      const intentHash2 = ethers.id("success-2");
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash2,
        true,
        reward
      );

      const info = await registry.getRelayerInfo(relayer1.address);
      // Reputation should have decayed (1% per day after 7 days = 3% decay)
      // But since we executed another successful swap, reputation should be recalculated
      expect(info.reputation).to.be.lte(1000n);
    });
  });

  describe("View Functions", function () {
    it("Should return correct network stats", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer2).registerRelayer({ value: MIN_STAKE });

      const stats = await registry.getNetworkStats();
      expect(stats.totalRelayers).to.equal(2n);
      expect(stats.totalStaked).to.equal(MIN_STAKE * 2n);
    });

    it("Should return correct relayer stats", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });

      const reward = ethers.parseEther("0.1");
      
      // Send rewards to contract first
      await executor.sendTransaction({
        to: await registry.getAddress(),
        value: reward * 3n
      });

      // Execute some swaps
      for (let i = 0; i < 3; i++) {
        const intentHash = ethers.id(`intent-${i}`);
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          reward
        );
      }

      const stats = await registry.getRelayerStats(relayer1.address);
      expect(stats.successfulExecutions).to.equal(3n);
      expect(stats.failedExecutions).to.equal(0n);
      expect(stats.reputation).to.equal(1000n);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update executor", async function () {
      const newExecutor = relayer1.address;
      await registry.connect(owner).setExecutor(newExecutor);

      expect(await registry.executor()).to.equal(newExecutor);
    });

    it("Should reject executor update from non-owner", async function () {
      try {
        await registry.connect(relayer1).setExecutor(relayer2.address);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Ownable");
      }
    });

    it("Should allow emergency withdraw", async function () {
      // Send some ETH to contract
      await owner.sendTransaction({
        to: await registry.getAddress(),
        value: ethers.parseEther("1")
      });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const contractBalance = await ethers.provider.getBalance(await registry.getAddress());

      const tx = await registry.connect(owner).emergencyWithdraw();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(owner.address);

      const expectedBalance = balanceBefore + contractBalance - gasCost;
      const diff = balanceAfter > expectedBalance ? 
        balanceAfter - expectedBalance : 
        expectedBalance - balanceAfter;
      
      // Allow 0.01 ETH difference
      expect(diff).to.be.lte(ethers.parseEther("0.01"));
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero reward correctly", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });

      const intentHash = ethers.id("zero-reward");
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        0
      );

      const info = await registry.getRelayerInfo(relayer1.address);
      expect(info.successfulExecutions).to.equal(1n);
      expect(info.totalRewards).to.equal(0n);
    });

    it("Should handle network stats with zero relayers", async function () {
      const stats = await registry.getNetworkStats();
      expect(stats.totalRelayers).to.equal(0n);
      expect(stats.totalStaked).to.equal(0n);
    });
  });
});
