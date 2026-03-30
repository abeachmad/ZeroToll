const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ConfidentialIntentEscrow", function () {
  let escrow, tokenIn, tokenOut;
  let owner, operator, user, feeRecipient, executionTarget;

  const AMOUNT_IN = ethers.parseUnits("100", 6);
  const GROSS_OUT = ethers.parseUnits("150", 6);
  const FEE_AMOUNT = ethers.parseUnits("2", 6);

  beforeEach(async function () {
    [owner, operator, user, feeRecipient, executionTarget] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    tokenIn = await ERC20Mock.deploy("USDC", "USDC", 6);
    tokenOut = await ERC20Mock.deploy("zUSDC", "zUSDC", 6);

    const ConfidentialIntentEscrow = await ethers.getContractFactory("ConfidentialIntentEscrow");
    escrow = await ConfidentialIntentEscrow.deploy(feeRecipient.address);

    await escrow.setTrustedOperator(operator.address, true);

    await tokenIn.mint(user.address, AMOUNT_IN);
    await tokenIn.connect(user).approve(escrow.target, AMOUNT_IN);
  });

  function buildIntent() {
    return {
      user: user.address,
      tokenIn: tokenIn.target,
      tokenOut: tokenOut.target,
      amountIn: AMOUNT_IN,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      nonce: 1,
      chainId: 31337,
      encryptedMinOutCommitment: ethers.keccak256(ethers.toUtf8Bytes("enc-minout")),
    };
  }

  it("stores confidential intent and escrows input", async function () {
    const intent = buildIntent();
    const tx = await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(
      intent,
      123n
    );
    const receipt = await tx.wait();

    const event = receipt.logs.find((log) => {
      try {
        const parsed = escrow.interface.parseLog(log);
        return parsed && parsed.name === "ConfidentialIntentSubmitted";
      } catch {
        return false;
      }
    });

    expect(event).to.not.equal(undefined);
    expect(await tokenIn.balanceOf(escrow.target)).to.equal(AMOUNT_IN);

    const intentId = await escrow.getIntentId(intent);
    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.stage).to.equal(1n); // Submitted
    expect(summary.encryptedMinOutHandle).to.not.equal(0n);
  });

  it("runs the staged success flow", async function () {
    const intent = buildIntent();
    const intentId = await escrow.getIntentId(intent);

    await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(intent, 111n);
    await escrow.connect(operator).releaseInputForExecution(intentId, executionTarget.address);

    expect(await tokenIn.balanceOf(executionTarget.address)).to.equal(AMOUNT_IN);

    await tokenOut.mint(escrow.target, GROSS_OUT);
    await escrow.connect(operator).recordExecutionResult(intentId, GROSS_OUT, FEE_AMOUNT);
    await escrow.connect(operator).requestDecryption(intentId);
    await ethers.provider.send("evm_increaseTime", [11]);
    await ethers.provider.send("evm_mine", []);

    const verdictStatus = await escrow.getVerdictStatus(intentId);
    expect(verdictStatus.decrypted).to.equal(true);
    expect(verdictStatus.verdict).to.equal(true);

    await escrow.connect(operator).finalizeSuccess(intentId);

    expect(await tokenOut.balanceOf(user.address)).to.equal(GROSS_OUT - FEE_AMOUNT);
    expect(await tokenOut.balanceOf(feeRecipient.address)).to.equal(FEE_AMOUNT);

    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.stage).to.equal(5n); // FinalizedSuccess
  });

  it("refunds an unexecuted expired intent", async function () {
    const intent = buildIntent();
    const latestBlock = await ethers.provider.getBlock("latest");
    intent.deadline = latestBlock.timestamp + 1;

    const intentId = await escrow.getIntentId(intent);
    await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(intent, 999n);

    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);

    await escrow.connect(user).cancelExpired(intentId);

    expect(await tokenIn.balanceOf(user.address)).to.equal(AMOUNT_IN);

    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.stage).to.equal(7n); // Cancelled
  });
});
