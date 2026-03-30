const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ConfidentialIntentEscrow", function () {
  let escrow, tokenIn, tokenOut, wrappedNative, permit2;
  let owner, operator, user, feeRecipient, executionTarget;

  const AMOUNT_IN = ethers.parseUnits("100", 6);
  const GROSS_OUT = ethers.parseUnits("150", 6);
  const FEE_AMOUNT = ethers.parseUnits("2", 6);

  beforeEach(async function () {
    [owner, operator, user, feeRecipient, executionTarget] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    const MockWrappedNative = await ethers.getContractFactory("MockWrappedNative");
    const MockPermit2 = await ethers.getContractFactory("MockPermit2");
    tokenIn = await ERC20Mock.deploy("USDC", "USDC", 6);
    tokenOut = await ERC20Mock.deploy("zUSDC", "zUSDC", 6);
    wrappedNative = await MockWrappedNative.deploy("Wrapped Ether", "WETH");
    permit2 = await MockPermit2.deploy();

    const ConfidentialIntentEscrow = await ethers.getContractFactory("ConfidentialIntentEscrow");
    escrow = await ConfidentialIntentEscrow.deploy(
      feeRecipient.address,
      wrappedNative.target,
      permit2.target
    );

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

  async function signErc2612Permit({
    token,
    ownerSigner,
    spender,
    value,
    deadline,
  }) {
    const ownerAddress = await ownerSigner.getAddress();
    const name = await token.name();
    const nonce = await token.nonces(ownerAddress);
    const { chainId } = await ethers.provider.getNetwork();

    const domain = {
      name,
      version: "1",
      chainId,
      verifyingContract: await token.getAddress(),
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const values = {
      owner: ownerAddress,
      spender,
      value,
      nonce,
      deadline,
    };

    const signature = await ownerSigner.signTypedData(domain, types, values);
    return ethers.Signature.from(signature);
  }

  it("stores confidential intent and escrows input", async function () {
    const intent = buildIntent();
    const tx = await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(
      intent,
      123n,
      false
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

    await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(intent, 111n, false);
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

  it("unwraps wrapped native output to native ETH on finalize", async function () {
    const intent = buildIntent();
    intent.tokenOut = wrappedNative.target;
    const intentId = await escrow.getIntentId(intent);

    await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(intent, 111n, true);
    await escrow.connect(operator).releaseInputForExecution(intentId, executionTarget.address);

    await wrappedNative.connect(operator).deposit({ value: GROSS_OUT });
    await wrappedNative.connect(operator).transfer(escrow.target, GROSS_OUT);
    await escrow.connect(operator).recordExecutionResult(intentId, GROSS_OUT, FEE_AMOUNT);
    await escrow.connect(operator).requestDecryption(intentId);
    await ethers.provider.send("evm_increaseTime", [11]);
    await ethers.provider.send("evm_mine", []);

    const userBalanceBefore = await ethers.provider.getBalance(user.address);
    await escrow.connect(operator).finalizeSuccess(intentId);
    const userBalanceAfter = await ethers.provider.getBalance(user.address);

    expect(userBalanceAfter - userBalanceBefore).to.equal(GROSS_OUT - FEE_AMOUNT);
    expect(await wrappedNative.balanceOf(feeRecipient.address)).to.equal(FEE_AMOUNT);

    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.deliverNative).to.equal(true);
    expect(summary.stage).to.equal(5n);
  });

  it("refunds an unexecuted expired intent", async function () {
    const intent = buildIntent();
    const latestBlock = await ethers.provider.getBlock("latest");
    intent.deadline = latestBlock.timestamp + 1;

    const intentId = await escrow.getIntentId(intent);
    await escrow.connect(user).submitIntentWithPlaintextMinOutForTesting(intent, 999n, false);

    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);

    await escrow.connect(user).cancelExpired(intentId);

    expect(await tokenIn.balanceOf(user.address)).to.equal(AMOUNT_IN);

    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.stage).to.equal(7n); // Cancelled
  });

  it("submits through Permit2 without upfront ERC20 approval", async function () {
    const intent = buildIntent();
    await tokenIn.connect(user).approve(escrow.target, 0n);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const permitSingle = {
      details: {
        token: tokenIn.target,
        amount: AMOUNT_IN,
        expiration: deadline,
        nonce: 0,
      },
      spender: escrow.target,
      sigDeadline: deadline,
    };

    await escrow.connect(operator).submitIntentWithPermit2ForTesting(
      intent,
      123n,
      false,
      permitSingle,
      "0x1234"
    );

    expect(await tokenIn.balanceOf(escrow.target)).to.equal(AMOUNT_IN);
    const intentId = await escrow.getIntentId(intent);
    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.stage).to.equal(1n);
  });

  it("submits through ERC-2612 permit without upfront approval", async function () {
    const MockERC20Permit = await ethers.getContractFactory("MockERC20Permit");
    const permitToken = await MockERC20Permit.deploy("Permit USDC", "pUSDC", 6);
    const permitAmount = ethers.parseUnits("50", 6);
    await permitToken.mint(user.address, permitAmount);

    const intent = buildIntent();
    intent.tokenIn = permitToken.target;
    intent.amountIn = permitAmount;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const permitSignature = await signErc2612Permit({
      token: permitToken,
      ownerSigner: user,
      spender: escrow.target,
      value: permitAmount,
      deadline,
    });

    await escrow.connect(operator).submitIntentWithPermitForTesting(
      intent,
      123n,
      false,
      deadline,
      permitSignature.v,
      permitSignature.r,
      permitSignature.s
    );

    expect(await permitToken.balanceOf(escrow.target)).to.equal(permitAmount);
    const intentId = await escrow.getIntentId(intent);
    const summary = await escrow.getSettlementSummary(intentId);
    expect(summary.stage).to.equal(1n);
  });
});
