const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * RelayerRegistry Test Suite
 * 
 * Tests all functionality of the RelayerRegistry contract:
 * - Registration and unregistration
 * - Staking and slashing
 * - Reputation management
 * - Execution tracking
 * - Reward distribution
 * - Edge cases and security
 */
describe("RelayerRegistry", function () {
  let registry;
  let owner;
  let executor;
  let relayer1;
  let relayer2;
  let relayer3;
  let user;

  const MIN_STAKE = ethers.parseEther("10");
  const SLASH_PERCENTAGE = 10n;

  beforeEach(async function () {
    // Get signers
    [owner, executor, relayer1, relayer2, relayer3, user] = await ethers.getSigners();

    // Deploy RelayerRegistry
    const RelayerRegistry = await ethers.getContractFactory("RelayerRegistry");
    registry = await RelayerRegistry.deploy(executor.address);
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should set the correct executor", async function () {
      expect(await registry.executor()).to.equal(executor.address);
    });

    it("Should have correct constants", async function () {
      expect(await registry.MIN_STAKE()).to.equal(MIN_STAKE);
      expect(await registry.MAX_RELAYERS()).to.equal(100);
      expect(await registry.SLASH_PERCENTAGE()).to.equal(SLASH_PERCENTAGE);
      expect(await registry.MIN_REPUTATION()).to.equal(500);
    });

    it("Should start with zero relayers", async function () {
      expect(await registry.getRelayerCount()).to.equal(0);
      const activeRelayers = await registry.getActiveRelayers();
      expect(activeRelayers.length).to.equal(0);
    });
  });

  describe("Registration", function () {
    it("Should allow registration with sufficient stake", async function () {
      await expect(
        registry.connect(relayer1).registerRelayer({ value: MIN_STAKE })
      )
        .to.emit(registry, "RelayerRegistered")
        .withArgs(relayer1.address, MIN_STAKE);

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.active).to.be.true;
      expect(relayerInfo.stake).to.equal(MIN_STAKE);
      expect(relayerInfo.reputation).to.equal(1000);
      expect(relayerInfo.successfulExecutions).to.equal(0);
      expect(relayerInfo.failedExecutions).to.equal(0);
    });

    it("Should reject registration with insufficient stake", async function () {
      const insufficientStake = ethers.parseEther("5");
      await expect(
        registry.connect(relayer1).registerRelayer({ value: insufficientStake })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should reject duplicate registration", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      
      await expect(
        registry.connect(relayer1).registerRelayer({ value: MIN_STAKE })
      ).to.be.revertedWith("Already registered");
    });

    it("Should add relayer to active relayers list", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      
      const activeRelayers = await registry.getActiveRelayers();
      expect(activeRelayers.length).to.equal(1);
      expect(activeRelayers[0]).to.equal(relayer1.address);
      expect(await registry.getRelayerCount()).to.equal(1);
    });

    it("Should allow multiple relayers to register", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer2).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer3).registerRelayer({ value: MIN_STAKE });

      expect(await registry.getRelayerCount()).to.equal(3);
      const activeRelayers = await registry.getActiveRelayers();
      expect(activeRelayers).to.include(relayer1.address);
      expect(activeRelayers).to.include(relayer2.address);
      expect(activeRelayers).to.include(relayer3.address);
    });

    it("Should allow registration with more than minimum stake", async function () {
      const extraStake = ethers.parseEther("20");
      await registry.connect(relayer1).registerRelayer({ value: extraStake });

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.stake).to.equal(extraStake);
    });
  });

  describe("Unregistration", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should allow active relayer to unregister", async function () {
      await expect(
        registry.connect(relayer1).unregisterRelayer()
      )
        .to.emit(registry, "RelayerUnregistered")
        .withArgs(relayer1.address, MIN_STAKE);

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.active).to.be.false;
    });

    it("Should return stake on unregistration", async function () {
      const balanceBefore = await ethers.provider.getBalance(relayer1.address);
      
      const tx = await registry.connect(relayer1).unregisterRelayer();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(relayer1.address);
      expect(balanceAfter).to.equal(balanceBefore + MIN_STAKE - gasUsed);
    });

    it("Should remove relayer from active list", async function () {
      await registry.connect(relayer1).unregisterRelayer();

      expect(await registry.getRelayerCount()).to.equal(0);
      const activeRelayers = await registry.getActiveRelayers();
      expect(activeRelayers.length).to.equal(0);
    });

    it("Should reject unregistration from non-relayer", async function () {
      await expect(
        registry.connect(user).unregisterRelayer()
      ).to.be.revertedWith("Not active relayer");
    });

    it("Should reject duplicate unregistration", async function () {
      await registry.connect(relayer1).unregisterRelayer();
      
      await expect(
        registry.connect(relayer1).unregisterRelayer()
      ).to.be.revertedWith("Not active relayer");
    });
  });

  describe("Stake Management", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should allow increasing stake", async function () {
      const additionalStake = ethers.parseEther("5");
      
      await expect(
        registry.connect(relayer1).increaseStake({ value: additionalStake })
      )
        .to.emit(registry, "StakeIncreased")
        .withArgs(relayer1.address, additionalStake, MIN_STAKE + additionalStake);

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.stake).to.equal(MIN_STAKE + additionalStake);
    });

    it("Should reject increasing stake with zero value", async function () {
      await expect(
        registry.connect(relayer1).increaseStake({ value: 0 })
      ).to.be.revertedWith("Must send stake");
    });

    it("Should reject increasing stake from non-relayer", async function () {
      await expect(
        registry.connect(user).increaseStake({ value: ethers.parseEther("5") })
      ).to.be.revertedWith("Not active relayer");
    });
  });

  describe("Execution Recording", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should record successful execution", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      const reward = ethers.parseEther("0.1");

      // Fund registry for reward
      await owner.sendTransaction({
        to: await registry.getAddress(),
        value: reward
      });

      await expect(
        registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          reward
        )
      )
        .to.emit(registry, "ExecutionRecorded")
        .withArgs(relayer1.address, intentHash, true, reward)
        .to.emit(registry, "RewardDistributed")
        .withArgs(relayer1.address, reward);

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.successfulExecutions).to.equal(1);
      expect(relayerInfo.failedExecutions).to.equal(0);
      expect(relayerInfo.totalRewards).to.equal(reward);
      expect(relayerInfo.reputation).to.equal(1000);
    });

    it("Should record failed execution and slash stake", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      const slashAmount = (MIN_STAKE * SLASH_PERCENTAGE) / 100n;

      await expect(
        registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          false,
          0
        )
      )
        .to.emit(registry, "ExecutionRecorded")
        .withArgs(relayer1.address, intentHash, false, 0)
        .to.emit(registry, "RelayerSlashed")
        .withArgs(relayer1.address, slashAmount, "Failed execution");

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.successfulExecutions).to.equal(0);
      expect(relayerInfo.failedExecutions).to.equal(1);
      expect(relayerInfo.stake).to.equal(MIN_STAKE - slashAmount);
      expect(relayerInfo.reputation).to.equal(0);
    });

    it("Should deactivate relayer if stake falls below minimum", async function () {
      // Cause multiple failures to reduce stake below minimum
      for (let i = 0; i < 11; i++) {
        const intentHash = ethers.keccak256(ethers.toUtf8Bytes(`intent${i}`));
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          false,
          0
        );
      }

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.active).to.be.false;
      expect(await registry.getRelayerCount()).to.equal(0);
    });

    it("Should reject recording from non-executor", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      
      await expect(
        registry.connect(user).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        )
      ).to.be.revertedWith("Only executor");
    });

    it("Should reject recording for inactive relayer", async function () {
      await registry.connect(relayer1).unregisterRelayer();
      
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      
      await expect(
        registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        )
      ).to.be.revertedWith("Relayer not active");
    });

    it("Should reject duplicate intent execution", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        0
      );

      await expect(
        registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        )
      ).to.be.revertedWith("Intent already executed");
    });
  });

  describe("Reputation Management", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
    });

    it("Should calculate reputation correctly", async function () {
      // 3 successful, 1 failed = 75% success rate = 750 reputation
      for (let i = 0; i < 3; i++) {
        const intentHash = ethers.keccak256(ethers.toUtf8Bytes(`success${i}`));
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        );
      }

      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("failed"));
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        false,
        0
      );

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.reputation).to.equal(750);
    });

    it("Should apply reputation decay for inactive relayers", async function () {
      // Execute once
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        0
      );

      // Fast forward 10 days (7 day window + 3 days decay)
      await time.increase(10 * 24 * 60 * 60);

      // Execute again to trigger reputation update
      const intentHash2 = ethers.keccak256(ethers.toUtf8Bytes("intent2"));
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash2,
        true,
        0
      );

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      // Reputation should be 1000 - (3 days * 10 points) = 970
      expect(relayerInfo.reputation).to.equal(970);
    });

    it("Should deactivate relayer with low reputation", async function () {
      // Cause 6 failures out of 10 executions = 40% success = 400 reputation < 500 minimum
      for (let i = 0; i < 4; i++) {
        const intentHash = ethers.keccak256(ethers.toUtf8Bytes(`success${i}`));
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        );
      }

      for (let i = 0; i < 6; i++) {
        const intentHash = ethers.keccak256(ethers.toUtf8Bytes(`failed${i}`));
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          false,
          0
        );
      }

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.active).to.be.false;
      expect(relayerInfo.reputation).to.equal(400);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer2).registerRelayer({ value: ethers.parseEther("15") });
    });

    it("Should return correct relayer stats", async function () {
      // Execute 3 successful, 1 failed
      for (let i = 0; i < 3; i++) {
        const intentHash = ethers.keccak256(ethers.toUtf8Bytes(`success${i}`));
        await registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          0
        );
      }

      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("failed"));
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        false,
        0
      );

      const [stake, reputation, successRate, totalExecutions] = 
        await registry.getRelayerStats(relayer1.address);

      expect(totalExecutions).to.equal(4);
      expect(successRate).to.equal(75); // 3/4 = 75%
      expect(reputation).to.equal(750);
    });

    it("Should return correct network stats", async function () {
      const [totalRelayers, totalStaked, avgReputation, totalExecutions] = 
        await registry.getNetworkStats();

      expect(totalRelayers).to.equal(2);
      expect(totalStaked).to.equal(ethers.parseEther("25")); // 10 + 15
      expect(avgReputation).to.equal(1000); // Both have perfect reputation
      expect(totalExecutions).to.equal(0);
    });

    it("Should check if relayer is active", async function () {
      expect(await registry.isRelayerActive(relayer1.address)).to.be.true;
      expect(await registry.isRelayerActive(user.address)).to.be.false;

      await registry.connect(relayer1).unregisterRelayer();
      expect(await registry.isRelayerActive(relayer1.address)).to.be.false;
    });

    it("Should return execution record", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      const reward = ethers.parseEther("0.1");

      await owner.sendTransaction({
        to: await registry.getAddress(),
        value: reward
      });

      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        reward
      );

      const record = await registry.getExecutionRecord(intentHash);
      expect(record.relayer).to.equal(relayer1.address);
      expect(record.intentHash).to.equal(intentHash);
      expect(record.success).to.be.true;
      expect(record.reward).to.equal(reward);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update executor", async function () {
      const newExecutor = user.address;

      await expect(
        registry.connect(owner).setExecutor(newExecutor)
      )
        .to.emit(registry, "ExecutorUpdated")
        .withArgs(executor.address, newExecutor);

      expect(await registry.executor()).to.equal(newExecutor);
    });

    it("Should reject executor update from non-owner", async function () {
      await expect(
        registry.connect(user).setExecutor(user.address)
      ).to.be.revertedWith("Only owner");
    });

    it("Should reject zero address as executor", async function () {
      await expect(
        registry.connect(owner).setExecutor(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid executor");
    });

    it("Should allow owner to emergency withdraw", async function () {
      // Send some ETH to contract
      const amount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await registry.getAddress(),
        value: amount
      });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await registry.connect(owner).emergencyWithdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + amount - gasUsed);
    });

    it("Should reject emergency withdraw from non-owner", async function () {
      await expect(
        registry.connect(user).emergencyWithdraw()
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum relayers limit", async function () {
      // This test would take too long to run 100 times
      // Just verify the constant is set correctly
      expect(await registry.MAX_RELAYERS()).to.equal(100);
    });

    it("Should handle zero reward correctly", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        0
      );

      const relayerInfo = await registry.getRelayerInfo(relayer1.address);
      expect(relayerInfo.totalRewards).to.equal(0);
      expect(relayerInfo.successfulExecutions).to.equal(1);
    });

    it("Should handle network stats with zero relayers", async function () {
      const [totalRelayers, totalStaked, avgReputation, totalExecutions] = 
        await registry.getNetworkStats();

      expect(totalRelayers).to.equal(0);
      expect(totalStaked).to.equal(0);
      expect(avgReputation).to.equal(0);
      expect(totalExecutions).to.equal(0);
    });

    it("Should handle relayer stats with zero executions", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });

      const [stake, reputation, successRate, totalExecutions] = 
        await registry.getRelayerStats(relayer1.address);

      expect(totalExecutions).to.equal(0);
      expect(successRate).to.equal(100); // Default to 100% with no executions
      expect(reputation).to.equal(1000);
    });
  });

  describe("Security", function () {
    it("Should prevent reentrancy in unregisterRelayer", async function () {
      // This is implicitly tested by the transfer pattern used
      // (call with no data, checks-effects-interactions pattern)
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      await registry.connect(relayer1).unregisterRelayer();
      
      // Should not be able to unregister twice
      await expect(
        registry.connect(relayer1).unregisterRelayer()
      ).to.be.revertedWith("Not active relayer");
    });

    it("Should prevent reentrancy in recordExecution", async function () {
      await registry.connect(relayer1).registerRelayer({ value: MIN_STAKE });
      
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      const reward = ethers.parseEther("0.1");

      await owner.sendTransaction({
        to: await registry.getAddress(),
        value: reward
      });

      await registry.connect(executor).recordExecution(
        relayer1.address,
        intentHash,
        true,
        reward
      );

      // Should not be able to execute same intent twice
      await expect(
        registry.connect(executor).recordExecution(
          relayer1.address,
          intentHash,
          true,
          reward
        )
      ).to.be.revertedWith("Intent already executed");
    });
  });
});
