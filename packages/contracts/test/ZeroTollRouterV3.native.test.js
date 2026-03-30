const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZeroTollRouterV3 native output", function () {
  const NATIVE_MARKER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const AMOUNT_IN = ethers.parseUnits("100", 6);
  const AMOUNT_OUT = ethers.parseEther("0.05");

  let owner;
  let relayer;
  let user;
  let usdc;
  let wrappedNative;
  let adapter;
  let router;

  async function signIntent(intent) {
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "ZeroTollRouter",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: await router.getAddress(),
    };

    const types = {
      SwapIntent: [
        { name: "user", type: "address" },
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "minAmountOut", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "chainId", type: "uint256" },
      ],
    };

    return user.signTypedData(domain, types, intent);
  }

  async function buildIntent(overrides = {}) {
    const network = await ethers.provider.getNetwork();
    return {
      user: user.address,
      tokenIn: await usdc.getAddress(),
      tokenOut: NATIVE_MARKER,
      amountIn: AMOUNT_IN,
      minAmountOut: AMOUNT_OUT - ethers.parseEther("0.001"),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 0n,
      chainId: network.chainId,
      ...overrides,
    };
  }

  beforeEach(async function () {
    [owner, relayer, user] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    const MockWrappedNative = await ethers.getContractFactory("contracts/mocks/MockWrappedNative.sol:MockWrappedNative");
    const AdapterMock = await ethers.getContractFactory("contracts/mocks/RouterV3NativeAdapterMock.sol:RouterV3NativeAdapterMock");
    const RouterV3 = await ethers.getContractFactory("ZeroTollRouterV3");

    usdc = await ERC20Mock.deploy("USD Coin", "USDC", 6);
    wrappedNative = await MockWrappedNative.deploy("Wrapped Ether", "WETH");
    adapter = await AdapterMock.deploy();
    router = await RouterV3.deploy();

    await router.setWrappedNativeToken(await wrappedNative.getAddress());
    await router.setAdapters(await adapter.getAddress(), ethers.ZeroAddress);
    await router.setTestMode(false);

    await usdc.mint(user.address, AMOUNT_IN);
    await usdc.connect(user).approve(await router.getAddress(), AMOUNT_IN);
  });

  it("unwraps adapter output and sends native token to the intent user", async function () {
    await wrappedNative.connect(owner).deposit({ value: AMOUNT_OUT });
    await wrappedNative.connect(owner).transfer(await adapter.getAddress(), AMOUNT_OUT);
    await adapter.setMockOutput(await wrappedNative.getAddress(), AMOUNT_OUT);

    const intent = await buildIntent();
    const signature = await signIntent(intent);

    const nativeBefore = await ethers.provider.getBalance(user.address);

    await router.connect(relayer).executeSwap(intent, signature);

    const nativeAfter = await ethers.provider.getBalance(user.address);
    expect(nativeAfter - nativeBefore).to.equal(AMOUNT_OUT);
    expect(await wrappedNative.balanceOf(user.address)).to.equal(0n);
    expect(await wrappedNative.balanceOf(await router.getAddress())).to.equal(0n);
  });

  it("unwraps native output in test mode when the router holds wrapped liquidity", async function () {
    await router.setAdapters(ethers.ZeroAddress, ethers.ZeroAddress);
    await router.setTestMode(true);

    const routerLiquidity = ethers.parseEther("100");
    await wrappedNative.connect(owner).deposit({ value: routerLiquidity });
    await wrappedNative.connect(owner).transfer(await router.getAddress(), routerLiquidity);

    const intent = await buildIntent({
      minAmountOut: ethers.parseEther("80"),
    });
    const signature = await signIntent(intent);

    const nativeBefore = await ethers.provider.getBalance(user.address);

    await router.connect(relayer).executeSwap(intent, signature);

    const nativeAfter = await ethers.provider.getBalance(user.address);
    expect(nativeAfter - nativeBefore).to.equal(ethers.parseEther("99.5"));
    expect(await wrappedNative.balanceOf(user.address)).to.equal(0n);
    expect(await wrappedNative.balanceOf(await router.getAddress())).to.equal(
      routerLiquidity - ethers.parseEther("99.5")
    );
  });

  it("reverts native output swaps when wrapped native is not configured", async function () {
    const RouterV3 = await ethers.getContractFactory("ZeroTollRouterV3");
    const unconfiguredRouter = await RouterV3.deploy();

    await usdc.connect(user).approve(await unconfiguredRouter.getAddress(), AMOUNT_IN);
    await unconfiguredRouter.setAdapters(await adapter.getAddress(), ethers.ZeroAddress);
    await unconfiguredRouter.setTestMode(false);

    await wrappedNative.connect(owner).deposit({ value: AMOUNT_OUT });
    await wrappedNative.connect(owner).transfer(await adapter.getAddress(), AMOUNT_OUT);
    await adapter.setMockOutput(await wrappedNative.getAddress(), AMOUNT_OUT);

    const network = await ethers.provider.getNetwork();
    const intent = {
      user: user.address,
      tokenIn: await usdc.getAddress(),
      tokenOut: NATIVE_MARKER,
      amountIn: AMOUNT_IN,
      minAmountOut: AMOUNT_OUT - ethers.parseEther("0.001"),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 0n,
      chainId: network.chainId,
    };

    const domain = {
      name: "ZeroTollRouter",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: await unconfiguredRouter.getAddress(),
    };

    const types = {
      SwapIntent: [
        { name: "user", type: "address" },
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "minAmountOut", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "chainId", type: "uint256" },
      ],
    };
    const signature = await user.signTypedData(domain, types, intent);

    try {
      await unconfiguredRouter.connect(relayer).executeSwap(intent, signature);
      expect.fail("Expected native output swap to revert without wrapped native config");
    } catch (error) {
      expect(error.message).to.include("Wrapped native not configured");
    }
  });

  it("surfaces the primary adapter failure instead of retrying after prefunding", async function () {
    const FailingAdapter = await ethers.getContractFactory("contracts/mocks/RouterV3NativeAdapterMock.sol:RouterV3NativeAdapterMock");
    const fallbackAdapter = await ethers.getContractFactory("contracts/mocks/RouterV3NativeAdapterMock.sol:RouterV3NativeAdapterMock");

    const failingAdapter = await FailingAdapter.deploy();
    const workingFallback = await fallbackAdapter.deploy();

    await wrappedNative.connect(owner).deposit({ value: AMOUNT_OUT });
    await wrappedNative.connect(owner).transfer(await workingFallback.getAddress(), AMOUNT_OUT);
    await workingFallback.setMockOutput(await wrappedNative.getAddress(), AMOUNT_OUT);

    await router.setAdapters(await failingAdapter.getAddress(), await workingFallback.getAddress());

    const intent = await buildIntent();
    const signature = await signIntent(intent);

    await expect(
      router.connect(relayer).executeSwap(intent, signature)
    ).to.be.revertedWith("Mock output not configured");
  });
});
