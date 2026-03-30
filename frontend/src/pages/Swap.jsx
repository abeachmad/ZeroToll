import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, CheckCircle, Info, HelpCircle, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAccount, useWalletClient, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { ethers } from 'ethers';
import FeeModeExplainer from '../components/FeeModeExplainer';
import ConnectButton from '../components/ConnectButton';
import GaslessSwapStatus from '../components/GaslessSwapStatus';
import { useGaslessSwap } from '../hooks/useGaslessSwap';
import { useIntentGasless } from '../hooks/useIntentGasless';
import { useConfidentialIntentGasless } from '../hooks/useConfidentialIntentGasless';
import { useEIP7702Swap } from '../hooks/useEIP7702Swap';
import amoyTokens from '../config/tokenlists/zerotoll.tokens.amoy.json';
import sepoliaTokens from '../config/tokenlists/zerotoll.tokens.sepolia.json';
import arbitrumSepoliaTokens from '../config/tokenlists/zerotoll.tokens.arbitrum-sepolia.json';
import optimismSepoliaTokens from '../config/tokenlists/zerotoll.tokens.optimism-sepolia.json';
import contractsConfig from '../config/contracts.json';
import { getBackendUrl } from '../lib/runtimeUrls';

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

const getConfiguredAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value || '') ? value : null;

// RouterHub addresses per chain (UPGRADED Nov 6-8, 2025 - Bug Fix: Transfer to user)
// Load from config file to avoid hardcoding
const ROUTER_HUB_ADDRESSES = {
  80002: getConfiguredAddress(contractsConfig.amoy.routerHub),
  11155111: getConfiguredAddress(contractsConfig.sepolia.routerHub),
  421614: getConfiguredAddress(contractsConfig.arbitrumSepolia.routerHub),
  11155420: getConfiguredAddress(contractsConfig.optimismSepolia.routerHub)
};

// ERC20 ABI (minimal for approve/allowance)
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

const chains = [
  { id: 11155111, name: 'Ethereum Sepolia', logo: '⭐', tokens: sepoliaTokens.tokens },
  { id: 80002, name: 'Polygon Amoy', logo: '🔷', tokens: amoyTokens.tokens },
  { id: 421614, name: 'Arbitrum Sepolia', logo: '🔵', tokens: arbitrumSepoliaTokens.tokens },
  { id: 11155420, name: 'Optimism Sepolia', logo: '🔴', tokens: optimismSepoliaTokens.tokens }
];

const feeModes = [
  { id: 'NATIVE', label: 'Native (POL/ETH)', desc: 'Pay gas in native token' },
  { id: 'INPUT', label: 'Use Input Token', desc: 'Deduct fee from input on source' },
  { id: 'OUTPUT', label: 'Use Output Token', desc: 'Skim fee from output on dest' },
  { id: 'STABLE', label: 'Stable', desc: 'Pay in stablecoins' }
];

const EXECUTION_MODES = {
  TRADITIONAL: 'traditional',
  ZEROTOLL: 'zerotoll',
  CONFIDENTIAL: 'confidential_intent',
  SMART_WALLET: 'smart_wallet',
  CUSTOM_7702: 'custom_7702',
};

const CHAIN_CONFIG_KEYS = {
  80002: 'amoy',
  11155111: 'sepolia',
  421614: 'arbitrumSepolia',
  11155420: 'optimismSepolia',
};

const NATIVE_EIP7702_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const ROUTER_HUB_ABI = [
  "function executeRoute(tuple(address user, address tokenIn, uint256 amtIn, address tokenOut, uint256 minOut, uint64 dstChainId, uint64 deadline, address feeToken, uint8 feeMode, uint256 feeCapToken, bytes routeHint, uint256 nonce) intent, address adapter, bytes routeData) external returns (uint256)"
];

const ADAPTER_SWAP_ABI = [
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) external payable returns (uint256 amountOut)"
];

const getChainContracts = (chainId) => {
  const key = CHAIN_CONFIG_KEYS[chainId];
  return key ? contractsConfig[key] : null;
};

const getPreferredAdapterAddress = (chainId) => {
  const chainContracts = getChainContracts(chainId);
  if (!chainContracts) return null;

  const adapterCandidates = [
    chainContracts.adapters?.zeroToll,
    chainContracts.adapters?.mockDex,
    chainContracts.adapters?.uniswapV2,
    chainContracts.adapters?.quickswapV2,
    chainContracts.adapters?.uniswapV3,
    chainContracts.smartDexAdapter,
  ];

  return adapterCandidates.find((value) => getConfiguredAddress(value)) || null;
};

const getExplorerTxUrl = (chainId, hash) => {
  if (!hash) return null;

  const explorers = {
    11155111: `https://sepolia.etherscan.io/tx/${hash}`,
    80002: `https://amoy.polygonscan.com/tx/${hash}`,
    421614: `https://sepolia.arbiscan.io/tx/${hash}`,
    11155420: `https://sepolia-optimism.etherscan.io/tx/${hash}`,
  };

  return explorers[chainId] || null;
};

// Helper function to get permit type indicator
const getPermitIndicator = (token) => {
  if (token?.permitType === 'ERC2612') return '⚡';
  if (token?.permitType === 'permit2') return '🔄';
  if (token?.isNative) return '🪙';
  return '⚠️';
};

const getPermitTooltip = (token) => {
  if (token?.permitType === 'ERC2612') return 'ERC-2612 permit - fully gasless';
  if (token?.permitType === 'permit2') return 'Permit2 - gasless after approval';
  if (token?.isNative) return 'Native token';
  return 'Requires approval tx';
};

const normalizeConfidentialBaseSymbol = (symbol) =>
  String(symbol || '')
    .replace(/^z/i, '')
    .replace(/^W(?=ETH$|POL$|MATIC$|LINK$|USDC$)/i, '')
    .toUpperCase();

const getConfidentialRecommendedInput = (token, chainTokens) => {
  if (!token || token.isNative || token.permitType === 'ERC2612') {
    return null;
  }

  const normalizedSymbol = normalizeConfidentialBaseSymbol(token.symbol);
  return (
    chainTokens.find(
      (candidate) =>
        candidate?.permitType === 'ERC2612' &&
        normalizeConfidentialBaseSymbol(candidate.symbol) === normalizedSymbol
    ) || null
  );
};

const Swap = () => {
  const navigate = useNavigate();
  const { address, isConnected, chain, connector } = useAccount();
  const { data: activeWalletClient } = useWalletClient();
  
  // Initialize fromChain - Sepolia is now chains[0]
  const [fromChain, setFromChain] = useState(chains[0]); // Sepolia
  const [toChain, setToChain] = useState(chains[1]); // Amoy
  const [tokenIn, setTokenIn] = useState(fromChain.tokens[0]);
  const [tokenOut, setTokenOut] = useState(toChain.tokens[0]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [feeMode, setFeeMode] = useState('INPUT');
  const [feeCap, setFeeCap] = useState('3');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [showExplainer, setShowExplainer] = useState(false);
  
  const [executionMode, setExecutionMode] = useState(EXECUTION_MODES.TRADITIONAL);
  const [gaslessStatus, setGaslessStatus] = useState('');
  const gaslessSwap = useGaslessSwap();
  const intentGasless = useIntentGasless(); // ZeroToll gasless (works on Sepolia and Amoy)
  const confidentialGasless = useConfidentialIntentGasless(); // Staged confidential lifecycle for the Fhenix buildathon path
  const eip7702Swap = useEIP7702Swap(); // Custom EIP-7702 path for embedded/programmatic wallets
  const [smartWalletAvailability, setSmartWalletAvailability] = useState(null);

  const isGaslessMode = executionMode === EXECUTION_MODES.SMART_WALLET;
  const isZeroTollGasless = executionMode === EXECUTION_MODES.ZEROTOLL;
  const isConfidentialMode = executionMode === EXECUTION_MODES.CONFIDENTIAL;
  const isEIP7702Mode = executionMode === EXECUTION_MODES.CUSTOM_7702;
  const isCustomEip7702Eligible =
    Boolean(activeWalletClient?.account?.type) &&
    activeWalletClient.account.type !== 'json-rpc';
  
  // Fetch fee estimate when ZeroToll gasless is enabled
  useEffect(() => {
    if (isZeroTollGasless && tokenIn?.address && intentGasless.getFeeEstimate) {
      intentGasless.getFeeEstimate(tokenIn.address);
    }
  }, [isZeroTollGasless, tokenIn?.address, intentGasless.getFeeEstimate]);

  useEffect(() => {
    if (isConfidentialMode && confidentialGasless.statusMessage) {
      setGaslessStatus(confidentialGasless.statusMessage);
    }
  }, [isConfidentialMode, confidentialGasless.statusMessage]);

  useEffect(() => {
    let cancelled = false;

    if (!isGaslessMode) {
      setSmartWalletAvailability(null);
      return undefined;
    }

    const loadAvailability = async () => {
      try {
        const availability = await gaslessSwap.checkAvailability();
        if (!cancelled) {
          setSmartWalletAvailability(availability);
        }
      } catch (error) {
        if (!cancelled) {
          setSmartWalletAvailability({
            available: false,
            reason: error.message || 'Failed to load smart wallet capabilities.',
          });
        }
      }
    };

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [isGaslessMode, gaslessSwap.checkAvailability, address, chain?.id]);

  useEffect(() => {
    if (isGaslessMode && gaslessSwap.txHash) {
      setTxHash(gaslessSwap.txHash);
    }
  }, [isGaslessMode, gaslessSwap.txHash]);

  useEffect(() => {
    if (isGaslessMode && gaslessSwap.statusMessage) {
      setGaslessStatus(gaslessSwap.statusMessage);
    }
  }, [isGaslessMode, gaslessSwap.statusMessage]);
  
  // Approval state
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  
  // Network mismatch state
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  
  // Get RouterHub address for current chain
  const routerHubAddress = ROUTER_HUB_ADDRESSES[fromChain?.id];
  const confidentialEscrowAddress = getConfiguredAddress(
    getChainContracts(fromChain?.id)?.confidentialIntentEscrow
  );
  const confidentialFundingMode = isConfidentialMode
    ? (tokenIn?.permitType === 'permit2'
        ? 'permit2'
        : tokenIn?.permitType === 'ERC2612'
          ? 'erc2612'
          : 'approval')
    : 'approval';
  const confidentialSupportsGaslessFunding = Boolean(
    isConfidentialMode &&
    confidentialEscrowAddress &&
    confidentialFundingMode !== 'approval'
  );
  const confidentialPermit2Spender = confidentialFundingMode === 'permit2'
    ? intentGasless.permit2Address
    : null;
  const zeroTollPermitType = isZeroTollGasless && tokenIn?.address
    ? intentGasless.getPermitType(tokenIn.address)
    : 'none';
  const zeroTollApprovalSpender = zeroTollPermitType === 'permit2'
    ? intentGasless.permit2Address
    : null;
  const confidentialRecommendedInput = getConfidentialRecommendedInput(
    tokenIn,
    fromChain?.tokens || []
  );
  const approvalSpenderAddress =
    isConfidentialMode
      ? (confidentialFundingMode === 'permit2'
          ? confidentialPermit2Spender
          : confidentialFundingMode === 'erc2612'
            ? undefined
            : confidentialEscrowAddress)
      : isZeroTollGasless
        ? (zeroTollPermitType === 'permit2'
            ? zeroTollApprovalSpender
            : undefined)
      : routerHubAddress;
  const confidentialApprovalRequired = Boolean(
    isConfidentialMode && (
      (confidentialFundingMode === 'permit2' && confidentialPermit2Spender) ||
      (confidentialFundingMode === 'approval' && confidentialEscrowAddress)
    )
  );
  const zeroTollApprovalRequired = Boolean(
    isZeroTollGasless && zeroTollPermitType === 'permit2' && zeroTollApprovalSpender
  );
  const modeManagedApprovalRequired = Boolean(
    (isConfidentialMode && confidentialApprovalRequired) ||
    zeroTollApprovalRequired
  );
  const showApprovalAction = Boolean(
    needsApproval &&
    !tokenIn?.isNative &&
    !isGaslessMode &&
    !isEIP7702Mode &&
    (!isConfidentialMode || confidentialApprovalRequired) &&
    (!isZeroTollGasless || zeroTollApprovalRequired)
  );
  
  // Wagmi hooks for approval
  const { writeContract: approveToken, data: approveHash } = useWriteContract();
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { switchChain: _switchChain } = useSwitchChain();
  
  // Wrap switchChain with logging to debug auto-switching issue
  const switchChain = _switchChain ? async (params) => {
    console.log('🔄 switchChain called with:', params, new Error().stack);
    return _switchChain(params);
  } : null;
  
  // Check allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && approvalSpenderAddress ? [address, approvalSpenderAddress] : undefined,
    enabled: Boolean(address && approvalSpenderAddress && tokenIn && !tokenIn.isNative),
  });

  const activateExecutionMode = (mode) => {
    if (mode === EXECUTION_MODES.CUSTOM_7702 && !isCustomEip7702Eligible) {
      toast.error(
        'Custom EIP-7702 currently needs an embedded/programmatic wallet that exposes raw authorization signing. The current browser-wallet connection is not suitable.'
      );
      return;
    }

    setExecutionMode((currentMode) =>
      currentMode === mode ? EXECUTION_MODES.TRADITIONAL : mode
    );
    setGaslessStatus('');
    setTxHash(null);
    setQuote(null);
    setAmountOut('');
    confidentialGasless.reset();
  };

  const buildRouterExecution = ({
    tokenInAddress,
    tokenOutAddress,
    amountWei,
    minOutWei,
  }) => {
    const chainContracts = getChainContracts(fromChain.id);
    const routerHub = getConfiguredAddress(chainContracts?.routerHub);
    const adapter = getPreferredAdapterAddress(fromChain.id);

    if (!address) {
      throw new Error('Wallet not connected');
    }

    if (!routerHub) {
      throw new Error(`RouterHub not configured for ${fromChain.name}`);
    }

    if (!adapter) {
      throw new Error(`No same-chain adapter configured for ${fromChain.name}`);
    }

    const routerHubInterface = new ethers.Interface(ROUTER_HUB_ABI);
    const adapterInterface = new ethers.Interface(ADAPTER_SWAP_ABI);
    const deadline = Math.floor(Date.now() / 1000) + 600;

    const intent = {
      user: address,
      tokenIn: tokenInAddress,
      amtIn: amountWei,
      tokenOut: tokenOutAddress,
      minOut: minOutWei,
      dstChainId: fromChain.id,
      deadline,
      feeToken: tokenInAddress,
      feeMode: 1,
      feeCapToken: parseUnits(feeCap || '3', 18),
      routeHint: '0x',
      nonce: BigInt(Date.now()),
    };

    const routeData = adapterInterface.encodeFunctionData('swap', [
      tokenInAddress,
      tokenOutAddress,
      amountWei,
      minOutWei,
      routerHub,
      intent.deadline,
    ]);

    const swapCallData = routerHubInterface.encodeFunctionData('executeRoute', [
      intent,
      adapter,
      routeData,
    ]);

    return {
      routerHub,
      adapter,
      routeData,
      swapCallData,
    };
  };

  useEffect(() => {
    setTokenIn(fromChain.tokens[0]);
  }, [fromChain]);

  useEffect(() => {
    setTokenOut(toChain.tokens[0]);
  }, [toChain]);

  useEffect(() => {
    if (!tokenIn.feeModes.includes(feeMode)) {
      setFeeMode(tokenIn.feeModes[0]);
    }
  }, [tokenIn, feeMode]);
  
  // Just show warning when wallet chain doesn't match selected fromChain
  // DO NOT auto-switch anything - let user control both wallet and UI
  useEffect(() => {
    console.log('🔗 Chain changed detected:', { 
      walletChain: chain?.id, 
      walletChainName: chain?.name,
      fromChainId: fromChain.id,
      fromChainName: fromChain.name,
      isConnected 
    });
    
    if (!isConnected || !chain) {
      setShowNetworkWarning(false);
      return;
    }
    
    // Show warning if wallet is on different chain than selected fromChain
    if (chain.id !== fromChain.id) {
      setShowNetworkWarning(true);
    } else {
      setShowNetworkWarning(false);
    }
  }, [chain?.id, isConnected, fromChain.id]);
  
  // Check if approval is needed when amount or allowance changes
  useEffect(() => {
    if ((isConfidentialMode && !confidentialApprovalRequired) || (isZeroTollGasless && !zeroTollApprovalRequired)) {
      setNeedsApproval(false);
      return;
    }

    if (!amountIn || tokenIn?.isNative) {
      setNeedsApproval(false);
      return;
    }
    
    // CRITICAL: Refetch allowance when amountIn changes to avoid stale cache
    // User might have used allowance in previous swap
    if (amountIn && !tokenIn?.isNative && refetchAllowance) {
      refetchAllowance();
    }
    
    // CRITICAL FIX: If currentAllowance is undefined (RPC failure or not loaded yet),
    // we MUST show approve button for safety. User can manually check allowance on explorer.
    if (currentAllowance === undefined) {
      // If we have a quote, user already went through the flow, so check if they need approval
      // Otherwise default to true for safety
      console.warn('⚠️ Allowance check returned undefined. Assuming approval needed for safety.');
      setNeedsApproval(true);
      return;
    }
    
    console.log('🔍 Allowance check:', {
      currentAllowance: currentAllowance?.toString(),
      amountIn,
      tokenSymbol: tokenIn?.symbol,
      spender: approvalSpenderAddress
    });
    
    try {
      const decimals = tokenIn.decimals || 6;
      const amountWei = parseUnits(amountIn, decimals);
      // Normalize allowance to BigInt for reliable comparison
      const toBigInt = (v) => {
        try {
          if (v == null) return 0n;
          if (typeof v === 'bigint') return v;
          if (typeof v === 'string') return v.startsWith('0x') ? BigInt(v) : BigInt(v);
          if (typeof v === 'number') return BigInt(v);
          if (v._hex) return BigInt(v._hex);
          if (v.toString) return BigInt(v.toString());
        } catch (e) {
          return 0n;
        }
        return 0n;
      };

      const allowanceBig = toBigInt(currentAllowance);
      const amountBig = toBigInt(amountWei);

      const needsApprove = allowanceBig < amountBig;
      console.log('💰 Approval decision:', {
        allowanceBig: allowanceBig.toString(),
        amountBig: amountBig.toString(),
        needsApproval: needsApprove
      });
      setNeedsApproval(needsApprove);
    } catch (e) {
      console.error('Error checking approval:', e);
      setNeedsApproval(true); // On error, assume approval needed for safety
    }
  }, [
    amountIn,
    confidentialApprovalRequired,
    currentAllowance,
    isConfidentialMode,
    isZeroTollGasless,
    refetchAllowance,
    tokenIn,
    zeroTollApprovalRequired,
  ]);
  
  // Handle approval success
  useEffect(() => {
    if (approveSuccess && approvalPending) {
      setApprovalPending(false);
      refetchAllowance();
      toast.success('🎉 Approval confirmed! You can now execute the swap.');
    }
  }, [approveSuccess, approvalPending, refetchAllowance]);

  const isNativeOutput = tokenOut.isNative;
  const wrappedOutputSymbol = isNativeOutput ? tokenOut.symbol.replace(/^(POL|ETH)$/, 'W$1') : null;
  const confidentialExecution = confidentialGasless.lastStatus?.execution?.liveExecution;
  const confidentialTxLinks = [
    confidentialGasless.lastStatus?.contractRef?.submitTxHash && {
      label: 'Submit',
      hash: confidentialGasless.lastStatus.contractRef.submitTxHash,
    },
    confidentialExecution?.releaseInputTxHash && {
      label: 'Release Input',
      hash: confidentialExecution.releaseInputTxHash,
    },
    confidentialExecution?.swapTxHash && {
      label: 'Swap',
      hash: confidentialExecution.swapTxHash,
    },
    confidentialExecution?.returnOutputTxHash && {
      label: 'Return Output',
      hash: confidentialExecution.returnOutputTxHash,
    },
    confidentialExecution?.recordExecutionTxHash && {
      label: 'Record Execution',
      hash: confidentialExecution.recordExecutionTxHash,
    },
    confidentialExecution?.requestDecryptionTxHash && {
      label: 'Request Decryption',
      hash: confidentialExecution.requestDecryptionTxHash,
    },
    confidentialGasless.lastStatus?.result?.finalizeTxHash && {
      label: 'Finalize',
      hash: confidentialGasless.lastStatus.result.finalizeTxHash,
    },
  ].filter(Boolean);

  const buildStandardQuoteIntent = () => ({
    user: address || '0x1234567890123456789012345678901234567890',
    tokenIn: tokenIn.symbol,
    amtIn: parseFloat(amountIn),
    tokenOut: tokenOut.symbol,
    minOut: parseFloat(amountIn) * 0.995,
    srcChainId: fromChain.id,
    dstChainId: toChain.id,
    feeMode,
    feeCap: parseFloat(feeCap),
    deadline: Math.floor(Date.now() / 1000) + 600,
    nonce: Date.now()
  });

  const requestStandardQuote = async () => {
    const response = await axios.post(`${API}/quote`, { intent: buildStandardQuoteIntent() });
    const quoteData = response.data;

    if (!quoteData?.success) {
      throw new Error(quoteData?.reason || 'No quote available');
    }

    return quoteData;
  };

  const getQuotedMinOutUnits = (quoteData, decimalsOut, slippageBps = 9500n) => {
    const numericNetOut = Number(quoteData?.netOut);
    if (!Number.isFinite(numericNetOut) || numericNetOut <= 0) {
      throw new Error('Quote did not include a usable output amount. Please refresh the quote and try again.');
    }

    const normalizedQuote = numericNetOut.toFixed(Math.min(decimalsOut, 12));
    const quotedUnits = parseUnits(normalizedQuote, decimalsOut);
    const minOutUnits = (quotedUnits * slippageBps) / 10000n;

    if (minOutUnits <= 0n) {
      throw new Error('Quoted minimum output is too small. Try a larger amount.');
    }

    return minOutUnits;
  };

  const handleGetQuote = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (![80002, 11155111, 421614, 11155420].includes(chain?.id)) {
      toast.error('Please switch to supported testnet');
      return;
    }

    const amount = parseFloat(amountIn);
    if (!amountIn || isNaN(amount) || amount <= 0 || amount > 1e12) {
      toast.error('Enter a valid amount');
      return;
    }
    
    const cap = parseFloat(feeCap);
    if (isNaN(cap) || cap <= 0 || cap > 1e6) {
      toast.error('Enter a valid fee cap');
      return;
    }

    setLoading(true);
    try {
      if (isConfidentialMode) {
        if (tokenIn.isNative) {
          toast.error('Confidential Gasless Intent currently supports ERC-20 input tokens only.');
          return;
        }

        const confidentialQuote = await confidentialGasless.getQuote({
          user: address || '0x1234567890123456789012345678901234567890',
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: parseFloat(amountIn),
          srcChainId: fromChain.id,
          dstChainId: toChain.id,
          feeMode,
          feeCap: parseFloat(feeCap),
        });

        setQuote(confidentialQuote);
        if (confidentialQuote.netOut !== undefined) {
          setAmountOut(Number(confidentialQuote.netOut).toFixed(6));
        }
        if (tokenOut.isNative) {
          toast.info(`🔐 Confidential mode will route through ${wrappedOutputSymbol} internally, then unwrap to native ${tokenOut.symbol} on finalization.`);
        }
        toast.success('Confidential quote received!');
        return;
      }

      const quoteData = await requestStandardQuote();
      const numericNetOut = Number(quoteData.netOut);

      setQuote(quoteData);
      if (!Number.isFinite(numericNetOut) || numericNetOut <= 0) {
        throw new Error('Quote response did not include a usable output amount.');
      }

      setAmountOut(numericNetOut.toFixed(6));
      toast.success('Quote received!');
    } catch (error) {
      console.error('Quote error:', error);
      toast.error(error.message || 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!tokenIn || tokenIn.isNative || !approvalSpenderAddress) return;
    
    setApprovalPending(true);
    
    try {
      // Ensure wallet is on the same network as the selected source chain
      if (chain?.id !== fromChain.id) {
        toast.info('🔁 Switching wallet network to match selection...');
        try {
          if (switchChain) {
            await switchChain({ chainId: fromChain.id });
          } else if (window.ethereum) {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${fromChain.id.toString(16)}` }]
            });
          }
          toast.success('✅ Network switched — please approve');
        } catch (swErr) {
          console.error('Network switch failed:', swErr);
          toast.error('Failed to switch network. Please switch network in MetaMask and retry.');
          setApprovalPending(false);
          return;
        }
      }

      const decimals = tokenIn.decimals || 6;
      const amountWei = parseUnits(amountIn, decimals);

      // Smart Wallet Batch approval path via wallet_sendCalls.
      // In normal UX we batch approve+swap together and do not show the approve button,
      // but keep this path as a fallback if approval is triggered explicitly.
      if (isGaslessMode) {
        const availability = await gaslessSwap.checkAvailability();
        console.log('🔍 Smart wallet batch availability:', availability);
        
        if (!availability.available) {
          toast.error(`Smart wallet batch not available: ${availability.reason}`);
          setApprovalPending(false);
          return;
        }
        
        toast.info(`⚡ Smart wallet approval via ${availability.chain}`);
        
        try {
          await gaslessSwap.executeApproval({
            tokenAddress: tokenIn.address,
            spender: approvalSpenderAddress,
            amount: amountWei.toString(),
            targetChainId: fromChain.id
          });

          toast.success('✅ Approval submitted! Waiting for confirmation...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          await refetchAllowance();
          setApprovalPending(false);
        } catch (gaslessError) {
          console.error('Smart wallet approval error:', gaslessError);
          toast.error(gaslessError.message || 'Smart wallet approval failed');
          setApprovalPending(false);
        }
        return;
      }

      // Standard approval (charges gas in POL/ETH)
      toast.info('🦊 Opening MetaMask... This will cost gas in POL/ETH');
      
      // CRITICAL FIX: Reset allowance to 0 first, then approve exact amount
      // This forces user to approve every single swap, preventing stale approvals
      // Step 1: Reset to 0
      console.log('🔄 Resetting allowance to 0 first...');
      const resetConfig = {
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [approvalSpenderAddress, 0n],
      };
      
      // For Amoy testnet, add minimum gas price
      if (fromChain.id === 80002) {
        resetConfig.gas = 100000n;
        resetConfig.maxFeePerGas = 50000000000n; // 50 gwei
        resetConfig.maxPriorityFeePerGas = 30000000000n; // 30 gwei
      }
      
      try {
        await approveToken(resetConfig);
        toast.info('⏳ Waiting for reset confirmation...');
        // Wait 2 seconds for reset to be mined
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (resetError) {
        console.warn('Reset failed, continuing with approval:', resetError);
        // Continue anyway - some tokens don't allow reset
      }
      
      // Step 2: Approve exact amount needed
      console.log('✅ Approving exact amount:', amountWei.toString());
      const approveConfig = {
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [approvalSpenderAddress, amountWei],
      };
      
      // For Amoy testnet, add minimum gas price to avoid 0 gas price rejection
      if (fromChain.id === 80002) {
        // Amoy polygon testnet - set minimum gas price
        approveConfig.gas = 100000n; // reasonable gas limit for ERC20 approve
        approveConfig.maxFeePerGas = 50000000000n; // 50 gwei minimum for Amoy
        approveConfig.maxPriorityFeePerGas = 30000000000n; // 30 gwei priority
        console.log('🔧 Using manual gas config for Amoy testnet:', approveConfig);
      }
      
      await approveToken(approveConfig);
      
      toast.success('✅ Approval submitted! Waiting for blockchain confirmation...');
    } catch (error) {
      console.error('Approval error:', error);
      setApprovalPending(false);
      if (error.message?.includes('User rejected') || error.message?.includes('User denied')) {
        toast.error('❌ Approval cancelled by user');
      } else {
        toast.error(error.message || 'Failed to approve token');
      }
    }
  };

  const handleGaslessExecute = async () => {
    // Smart Wallet Batch mode:
    // the wallet manages smart-account / batching behavior via wallet_sendCalls.
    try {
      if (tokenIn.isNative) {
        toast.error('Use the wrapped input token for Smart Wallet Batch mode.');
        return;
      }

      if (tokenOut.isNative) {
        toast.error('Smart Wallet Batch currently supports ERC-20 / wrapped-token output only. Use WETH/WPOL instead of native output.');
        return;
      }

      if (!tokenIn.address?.startsWith('0x') || !tokenOut.address?.startsWith('0x')) {
        toast.error('Invalid token addresses for smart wallet batch.');
        return;
      }

      const availability = await gaslessSwap.checkAvailability();
      if (!availability.available) {
        toast.error(availability.reason || 'Smart wallet batch is not available.');
        return;
      }

      toast.info('⚡ Smart Wallet Batch will bundle approve + swap in one wallet flow.');

      const decimals = tokenIn.decimals || 6;
      const amountWei = parseUnits(amountIn, decimals);
      const decimalsOut = tokenOut.decimals || 18;
      const amountAfterFeeWei = amountWei * 995n / 1000n;

      let expectedOutputWei;
      if (decimalsOut >= decimals) {
        expectedOutputWei = amountAfterFeeWei * BigInt(10 ** (decimalsOut - decimals));
      } else {
        expectedOutputWei = amountAfterFeeWei / BigInt(10 ** (decimals - decimalsOut));
      }
      const minOut = expectedOutputWei * 90n / 100n;

      const { routerHub, swapCallData } = buildRouterExecution({
        tokenInAddress: tokenIn.address,
        tokenOutAddress: tokenOut.address,
        amountWei,
        minOutWei: minOut,
      });

      setGaslessStatus('Waiting for wallet confirmation for approve + swap batch...');

      await gaslessSwap.executeBatch({
        tokenAddress: tokenIn.address,
        spender: routerHub,
        amount: amountWei.toString(),
        routerHub,
        swapCallData,
        targetChainId: fromChain.id,
      });

      toast.success('Smart wallet batch submitted. Check your wallet activity for confirmation.');
      
    } catch (error) {
      console.error('Smart wallet batch error:', error);
      setGaslessStatus('');
      toast.error(error.message || 'Smart wallet batch failed');
    }
  };

  const handleConfidentialGasless = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.error('Please enter an amount to swap');
      return;
    }

    if (fromChain.id !== 11155111) {
      toast.error('Confidential Gasless Intent currently uses Fhenix on Sepolia only.');
      return;
    }

    if (tokenIn.isNative) {
      toast.error('Use an ERC-20 input token for the confidential staged flow.');
      return;
    }

    setLoading(true);
    setTxHash(null);
    setGaslessStatus('Preparing confidential staged execution...');

    try {
      let confidentialQuote = quote;

      if (!confidentialQuote || confidentialQuote.mode !== 'CONFIDENTIAL_GASLESS_INTENT') {
        setGaslessStatus('Fetching confidential quote from the backend...');
        confidentialQuote = await confidentialGasless.getQuote({
          user: address,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: parseFloat(amountIn),
          srcChainId: fromChain.id,
          dstChainId: toChain.id,
          feeMode,
          feeCap: parseFloat(feeCap),
        });
        setQuote(confidentialQuote);
      }

      const quotedAmountOut = Number(confidentialQuote.netOut || amountOut || 0);
      const suggestedMinOut = Number(
        confidentialQuote.suggestedConfidentialMinOut || quotedAmountOut * 0.95
      );
      const amountInUnits = parseUnits(
        amountIn,
        tokenIn.decimals || 18
      ).toString();
      const quotedAmountOutDisplay = quotedAmountOut.toFixed(
        Math.min(tokenOut.decimals || 18, 6)
      );
      const quotedAmountOutUnits = parseUnits(
        quotedAmountOutDisplay,
        tokenOut.decimals || 18
      ).toString();
      const estimatedFeeToken = Number(confidentialQuote.estimatedFeeToken || 0);
      const estimatedFeeTokenDisplay = estimatedFeeToken.toFixed(
        Math.min(tokenOut.decimals || 18, 6)
      );
      const estimatedFeeTokenUnits = estimatedFeeToken > 0
        ? parseUnits(
            estimatedFeeTokenDisplay,
            tokenOut.decimals || 18
          ).toString()
        : '0';
      const minAmountOutDisplay = suggestedMinOut.toFixed(
        Math.min(tokenOut.decimals || 18, 6)
      );
      const minAmountOutUnits = parseUnits(
        minAmountOutDisplay,
        tokenOut.decimals || 18
      ).toString();

      if (!quotedAmountOut || Number.isNaN(quotedAmountOut)) {
        throw new Error('Confidential quote is missing a net output amount.');
      }

      if (tokenOut.isNative) {
        toast.info(`💰 Confidential mode will settle through ${wrappedOutputSymbol} internally, then unwrap to native ${tokenOut.symbol} on finalization.`);
      }

      if (confidentialSupportsGaslessFunding) {
        toast.info(
          confidentialFundingMode === 'permit2'
            ? '🔄 This confidential input supports Permit2. If you already gave the one-time Permit2 approval, you will only sign a gasless spending authorization here.'
            : '⚡ This confidential input supports ERC-2612 permit. You will sign a gasless permit instead of sending an approval transaction.'
        );
      }

      const result = await confidentialGasless.executeConfidentialSwap({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn,
        amountInUnits,
        quotedAmountOut: quotedAmountOut.toString(),
        quotedAmountOutUnits,
        estimatedFeeToken: estimatedFeeTokenDisplay,
        estimatedFeeTokenUnits,
        minAmountOut: minAmountOutDisplay,
        minAmountOutUnits,
        srcChainId: fromChain.id,
        dstChainId: toChain.id,
        feeMode,
        feeCap,
        fundingMode: confidentialSupportsGaslessFunding ? confidentialFundingMode : 'approval',
        fundingSpender: confidentialEscrowAddress,
      });

      if (result.stage === 'finalized_success') {
        toast.success('🔐 Confidential staged settlement finalized successfully.');
      } else if (result.stage === 'refunded') {
        toast.warning('🔐 Confidential intent refunded after the staged verdict.');
      } else {
        toast.info('🔐 Confidential intent submitted. Continue watching the staged status panel.');
      }
    } catch (error) {
      console.error('Confidential gasless error:', error);
      setGaslessStatus('');
      toast.error(error.message || 'Confidential gasless intent failed');
    } finally {
      setLoading(false);
    }
  };

  // ZeroToll Gasless (works on Sepolia and Amoy with zTokens)
  const handleZeroTollGasless = async () => {
    // Validate inputs first
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.error('Please enter an amount to swap');
      return;
    }

    if (!intentGasless.isSupported) {
      toast.error('ZeroToll gasless not supported on this chain');
      return;
    }

    if (tokenIn.isNative) {
      toast.error('ZeroToll gasless currently supports wrapped/ERC-20 input tokens only.');
      return;
    }

    // Check permit type for the token
    const permitType = intentGasless.getPermitType(tokenIn.address);
    
    if (permitType === 'none') {
      toast.error(`${tokenIn.symbol} doesn't support gasless. Use zTokens (⚡) or Permit2 tokens (🔄).`);
      return;
    }

    setGaslessStatus('Checking balance...');
    
    try {
      const balance = await intentGasless.getTokenBalance(tokenIn.address);
      const decimals = tokenIn.decimals || 18;
      const amountWei = parseUnits(amountIn, decimals);
      
      if (balance < amountWei) {
        toast.error(`Insufficient ${tokenIn.symbol} balance`);
        setGaslessStatus('');
        return;
      }

      setGaslessStatus('Getting live quote...');
      const quoteData = await requestStandardQuote();
      setQuote(quoteData);

      const numericNetOut = Number(quoteData.netOut);
      if (Number.isFinite(numericNetOut) && numericNetOut > 0) {
        setAmountOut(numericNetOut.toFixed(6));
      }

      const decimalsOut = tokenOut.decimals || 18;
      const minOut = getQuotedMinOutUnits(quoteData, decimalsOut, 9500n);
      const gaslessTokenOutAddress = tokenOut.isNative ? NATIVE_EIP7702_ADDRESS : tokenOut.address;
      let result;

      if (permitType === 'erc2612') {
        // ERC-2612 permit - fully gasless
        setGaslessStatus('Sign Permit + Swap Intent in MetaMask (NO GAS!)...');
        toast.info('⚡ Sign 2 messages in MetaMask - you pay ZERO gas!');
        if (tokenOut.isNative) {
          toast.info(`💰 ZeroToll will route through ${wrappedOutputSymbol} internally, then unwrap to native ${tokenOut.symbol} before delivery.`);
        }
        
        result = await intentGasless.submitSwapWithPermit({
          tokenIn: tokenIn.address,
          tokenOut: gaslessTokenOutAddress,
          amountIn: amountWei.toString(),
          minAmountOut: minOut.toString(),
          deadlineMinutes: 30
        });
      } else if (permitType === 'permit2') {
        // Permit2 - gasless after one-time approval
        setGaslessStatus('Sign Permit2 + Swap Intent in MetaMask...');
        toast.info('🔄 Sign 2 messages in MetaMask - gasless via Permit2!');
        if (tokenOut.isNative) {
          toast.info(`💰 ZeroToll will route through ${wrappedOutputSymbol} internally, then unwrap to native ${tokenOut.symbol} before delivery.`);
        }
        
        result = await intentGasless.submitSwapWithPermit2({
          tokenIn: tokenIn.address,
          tokenOut: gaslessTokenOutAddress,
          amountIn: amountWei.toString(),
          minAmountOut: minOut.toString(),
          deadlineMinutes: 30
        });
      }

      setGaslessStatus('Swap submitted! Waiting for confirmation...');
      const displayHash = result.userOpHash || result.txHash;
      toast.success(`🎉 Gasless swap submitted! Hash: ${displayHash?.slice(0, 10)}...`);
      setTxHash(displayHash);

      // Poll for confirmation and get actual txHash
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await intentGasless.checkStatus(result.requestId);
        console.log('📊 ZeroToll swap status:', status);
        
        if (status.txHash) {
          setTxHash(status.txHash);
        }
        
        if (status.status === 'confirmed') {
          setGaslessStatus('✓ Swap confirmed! You paid ZERO gas!');
          toast.success('🎉 Gasless swap confirmed! You paid $0 in gas!');
          return;
        } else if (status.status === 'failed') {
          const failureMessage = status.reason
            ? `Swap failed on-chain: ${status.reason}`
            : 'Swap failed on-chain';
          setGaslessStatus(failureMessage);
          toast.error(failureMessage);
          return;
        }
      }
      setGaslessStatus('Check explorer for status');
    } catch (error) {
      console.error('ZeroToll gasless error:', error);
      setGaslessStatus('');
      toast.error(error.message || 'ZeroToll gasless failed');
    }
  };

  // Custom EIP-7702 mode for embedded/programmatic wallets that expose raw authorization signing.
  const handleEIP7702Swap = async () => {
    setLoading(true);
    setGaslessStatus('Preparing Custom EIP-7702 swap...');
    
    try {
      // Validate inputs
      if (!amountIn || parseFloat(amountIn) <= 0) {
        toast.error('Enter a valid amount');
        setLoading(false);
        return;
      }

      if (!tokenIn || !tokenOut) {
        toast.error('Select tokens');
        setLoading(false);
        return;
      }

      // Fetch quote first if not available
      if (!quote || !quote.amountOut || isNaN(parseFloat(quote.amountOut))) {
        toast.info('Fetching quote from Pyth oracle...');
        setGaslessStatus('Fetching quote from Pyth price feed...');
        
        try {
          await handleGetQuote();
          // Wait a bit for quote to be set
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error('Failed to fetch quote:', err);
          toast.warning('Could not fetch quote, using estimate');
        }
      }

      // Parse amount
      const amount = parseUnits(amountIn, tokenIn.decimals || 18);
      
      // Calculate minOut from quote (with 5% slippage)
      let minOut = 0n;
      if (quote && quote.amountOut && !isNaN(parseFloat(quote.amountOut))) {
        minOut = BigInt(Math.floor(parseFloat(quote.amountOut) * 0.95));
        console.log('Using quote from Pyth:', { amountOut: quote.amountOut, minOut: minOut.toString() });
      } else {
        // Fallback: estimate 1:1 ratio with 5% slippage
        const estimatedOut = amount * 95n / 100n;
        minOut = estimatedOut;
        console.warn('No quote available, using estimate:', minOut.toString());
        toast.warning('Using estimated output (quote unavailable)');
      }

      if (tokenIn.isNative) {
        toast.error('Use the wrapped input token for Custom EIP-7702 mode.');
        setLoading(false);
        return;
      }

      toast.info('🚀 Starting Custom EIP-7702 swap');
      setGaslessStatus('Step 1/3: Signing custom EIP-7702 authorization...');

      // Convert token addresses for EIP-7702
      const getTokenAddress = (token) => {
        if (token.isNative || token.address === 'NATIVE') {
          return NATIVE_EIP7702_ADDRESS;
        }
        return token.address;
      };

      const tokenInAddress = getTokenAddress(tokenIn);
      const tokenOutAddress = getTokenAddress(tokenOut);
      const { routerHub, adapter, routeData } = buildRouterExecution({
        tokenInAddress,
        tokenOutAddress,
        amountWei: amount,
        minOutWei: minOut,
      });

      console.log('🔍 Token addresses:', {
        tokenIn: { symbol: tokenIn.symbol, original: tokenIn.address, actual: tokenInAddress },
        tokenOut: { 
          symbol: tokenOut.symbol, 
          original: tokenOut.address, 
          actual: tokenOutAddress,
          willUnwrap: tokenOutAddress === NATIVE_EIP7702_ADDRESS ? '✅ Yes - you will receive native ' + tokenOut.symbol : '❌ No'
        }
      });

      // Show user-friendly message for native output
      if (tokenOutAddress === NATIVE_EIP7702_ADDRESS) {
        toast.info(`💰 You will receive native ${tokenOut.symbol} in your wallet!`);
      }

      // Execute custom EIP-7702 swap
      const result = await eip7702Swap.executeSwap({
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn: amount,
        minAmountOut: minOut,
        routerHub,
        adapter,
        routeData
      });

      if (result && result.txHash) {
        setTxHash(result.txHash);
        
        // Show explorer link
        const explorerUrl = result.explorerUrl || 
          (chain?.id === 80002 
            ? `https://amoy.polygonscan.com/tx/${result.txHash}`
            : `https://sepolia.etherscan.io/tx/${result.txHash}`);
        
        toast.success(
          <div>
            <div>🎉 EIP-7702 swap successful! 50% gas savings!</div>
            <a 
              href={explorerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#60a5fa', textDecoration: 'underline' }}
            >
              View on Explorer →
            </a>
          </div>,
          { duration: 10000 }
        );
        
        setGaslessStatus(
          <div>
            ✅ Swap complete - 
            <a 
              href={explorerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#60a5fa', marginLeft: '4px' }}
            >
              View TX
            </a>
          </div>
        );
      } else {
        toast.success('✅ Custom EIP-7702 swap submitted!');
        setGaslessStatus('Check explorer for status');
      }

    } catch (error) {
      console.error('EIP-7702 gasless error:', error);
      setGaslessStatus('');
      toast.error(error.message || 'EIP-7702 gasless failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (isConfidentialMode) {
      return await handleConfidentialGasless();
    }

    // If EIP-7702 mode is enabled, use EIP-7702 swap
    if (isEIP7702Mode) {
      if (!isCustomEip7702Eligible) {
        toast.error('Custom EIP-7702 is disabled for the current wallet connection. Use ZeroToll Gasless, Smart Wallet Batch, or connect an embedded/programmatic wallet.');
        return;
      }
      if (!eip7702Swap.isSupported) {
        toast.error('EIP-7702 not supported on this chain. Switch to Amoy or Sepolia.');
        return;
      }
      return await handleEIP7702Swap();
    }

    // If ZeroToll gasless mode is enabled, check if token supports gasless
    if (isZeroTollGasless) {
      const permitType = intentGasless.getPermitType(tokenIn.address);
      if (permitType === 'erc2612' || permitType === 'permit2') {
        return await handleZeroTollGasless();
      }
      // Token doesn't support gasless - show warning but continue with traditional
      toast.warning(`${tokenIn.symbol} doesn't support gasless. Proceeding with traditional swap.`);
    }

    if (!quote) {
      toast.error('Get a quote first');
      return;
    }

    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    // If gasless mode, use different execution path
    if (isGaslessMode) {
      return await handleGaslessExecute();
    }
    
    // Ensure wallet network matches the selected source chain
    if (chain?.id !== fromChain.id) {
      toast.info('🔁 Switching wallet network to match selected chain...');
      try {
        if (switchChain) {
          await switchChain({ chainId: fromChain.id });
        } else if (window.ethereum) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${fromChain.id.toString(16)}` }]
          });
        }
        toast.success('✅ Network switched — continue to execute');
      } catch (swErr) {
        console.error('Network switch failed:', swErr);
        toast.error('Failed to switch network. Please switch network in MetaMask and retry.');
        return;
      }
    }

    // Re-check allowance immediately before executing
    if (!tokenIn.isNative) {
      try {
        await refetchAllowance();
      } catch (e) {
        console.warn('Failed to refetch allowance', e);
      }
    }

    // CRITICAL: Check approval before executing swap
    // Skip for gasless modes (ZeroToll and EIP-7702) as they use ERC-2612 Permit
    if (needsApproval && !tokenIn.isNative && !isZeroTollGasless && !isEIP7702Mode) {
      toast.error('⚠️ Please approve token spending first');
      return;
    }

    setLoading(true);
    toast.info('🦊 Preparing swap transaction...');
    
    try {
      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}`;
      const feeToken = feeMode === 'INPUT' ? tokenIn.symbol : 
                       feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) :
                       feeMode === 'STABLE' ? 'USDC' : 'POL';
      
      const userOp = {
        sender: address,
        nonce: Date.now(),
        feeMode,
        feeToken,
        callData: {
          tokenIn: tokenIn.symbol,
          amtIn: parseFloat(amountIn),
          tokenOut: tokenOut.symbol,
          minOut: parseFloat(amountOut) * 0.95,
          feeCap: parseFloat(feeCap),
          srcChainId: fromChain.id,
          dstChainId: toChain.id
        }
      };

      const response = await axios.post(`${API}/execute`, { intentId, userOp });
      
      if (response.data && response.data.success) {
        setTxHash(response.data.txHash);
        if (response.data.status === 'demo') {
          toast.success('✅ Demo swap executed! (No real transaction)');
        } else {
          toast.success(`🎉 Swap executed! Block: ${response.data.blockNumber || 'pending'}`);
        }
      } else {
        toast.error(response.data?.detail || response.data?.message || 'Execution failed');
      }
    } catch (error) {
      console.error('Execute error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to execute swap';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      <header className="border-b border-white/10 backdrop-blur-sm bg-zt-ink/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zt-paper/70 hover:text-zt-aqua transition-colors"
            data-testid="back-home-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-lg font-semibold">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ZeroToll" className="w-8 h-8" />
            <span className="text-xl font-bold text-zt-paper">ZeroToll</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/market')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors hidden md:block"
            >
              Market
            </button>
            <button
              onClick={() => navigate('/pool')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors hidden md:block"
            >
              Pool
            </button>
            <button
              onClick={() => navigate('/history')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors hidden md:block"
              data-testid="view-history-btn"
            >
              History
            </button>
            <button
              onClick={() => navigate('/faucet')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors hidden md:block"
            >
              Faucet
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="glass-strong p-8 rounded-3xl">
          <h1 className="text-3xl font-bold mb-2 text-zt-paper">Gasless Cross-Chain Swap</h1>
          <p className="text-zt-paper/60 mb-6">Pay fees in any token you swap—use input, skim from output (even native via wrapped), or stick to native gas. Fee capped on-chain, unused refunded.</p>

          {/* Execution Mode Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">
              Execution Mode <span className="text-zt-paper/40 font-normal">(pick the control plane that matches your wallet)</span>
            </label>

            <button
              onClick={() => activateExecutionMode(EXECUTION_MODES.ZEROTOLL)}
              className={`w-full glass p-4 rounded-xl transition-all text-left mb-3 ${
                isZeroTollGasless
                  ? 'border-2 border-green-500 bg-green-500/10'
                  : 'border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <div className={`font-semibold ${isZeroTollGasless ? 'text-green-400' : 'text-zt-paper'}`}>
                      ZeroToll Gasless (ERC-4337) {isZeroTollGasless && <span className="text-xs ml-2">✓ Active</span>}
                    </div>
                    <div className="text-xs text-zt-paper/50">Recommended. ZeroToll sponsors gas and recoups gas + protocol fee from swap tokens.</div>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${isZeroTollGasless ? 'bg-green-500' : 'bg-white/20'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${isZeroTollGasless ? 'translate-x-6 ml-0.5' : 'ml-0.5'}`} />
                </div>
              </div>
            </button>

            <button
              onClick={() => activateExecutionMode(EXECUTION_MODES.CONFIDENTIAL)}
              className={`w-full glass p-4 rounded-xl transition-all text-left mb-3 ${
                isConfidentialMode
                  ? 'border-2 border-cyan-500 bg-cyan-500/10'
                  : 'border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <div className={`font-semibold ${isConfidentialMode ? 'text-cyan-300' : 'text-zt-paper'}`}>
                      Confidential Gasless Intent {isConfidentialMode && <span className="text-xs ml-2">✓ Active</span>}
                    </div>
                    <div className="text-xs text-zt-paper/50">Buildathon mode on Sepolia. ZeroToll keeps sponsorship economics, while the confidential path is modeled as staged settlement.</div>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${isConfidentialMode ? 'bg-cyan-500' : 'bg-white/20'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${isConfidentialMode ? 'translate-x-6 ml-0.5' : 'ml-0.5'}`} />
                </div>
              </div>
            </button>

            <button
              onClick={() => activateExecutionMode(EXECUTION_MODES.SMART_WALLET)}
              className={`w-full glass p-4 rounded-xl transition-all text-left mb-3 ${
                isGaslessMode
                  ? 'border-2 border-yellow-500 bg-yellow-500/10'
                  : 'border border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🪪</span>
                  <div>
                    <div className={`font-semibold ${isGaslessMode ? 'text-yellow-300' : 'text-zt-paper'}`}>
                      Smart Wallet Batch {isGaslessMode && <span className="text-xs ml-2">✓ Active</span>}
                    </div>
                    <div className="text-xs text-zt-paper/50">Wallet-native smart account flow via `wallet_sendCalls`. Great for batch UX, but sponsorship stays wallet-controlled.</div>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${isGaslessMode ? 'bg-yellow-500' : 'bg-white/20'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${isGaslessMode ? 'translate-x-6 ml-0.5' : 'ml-0.5'}`} />
                </div>
              </div>
            </button>

            {isCustomEip7702Eligible ? (
              <button
                onClick={() => activateExecutionMode(EXECUTION_MODES.CUSTOM_7702)}
                className={`w-full glass p-4 rounded-xl transition-all text-left ${
                  isEIP7702Mode
                    ? 'border-2 border-blue-500 bg-blue-500/10'
                    : 'border border-white/10 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <div className={`font-semibold ${isEIP7702Mode ? 'text-blue-400' : 'text-zt-paper'}`}>
                        Custom EIP-7702 {isEIP7702Mode && <span className="text-xs ml-2">✓ Active</span>}
                      </div>
                      <div className="text-xs text-zt-paper/50">
                        Experimental. ZeroToll chooses the delegate contract, so only certain embedded/programmatic wallets are suitable.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors ${isEIP7702Mode ? 'bg-blue-500' : 'bg-white/20'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${isEIP7702Mode ? 'translate-x-6 ml-0.5' : 'ml-0.5'}`} />
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left text-sm text-blue-100">
                <div className="font-semibold text-blue-300">Custom EIP-7702 hidden for this wallet</div>
                <div className="mt-1 text-xs text-blue-100/80">
                  Current connector: {connector?.name || 'unknown wallet'}.
                  Browser-RPC wallets like this do not expose the raw authorization signing that ZeroToll custom EIP-7702 needs.
                </div>
              </div>
            )}

            {/* Mode Description */}
            <div className="mt-3 text-xs text-zt-paper/60">
              {!isZeroTollGasless && !isEIP7702Mode && !isGaslessMode && !isConfidentialMode ? (
                <span>💳 Traditional swap active. You pay gas in native token and approve separately when needed.</span>
              ) : isZeroTollGasless ? (
                <div>
                  <span className="text-green-400">⚡ ZeroToll Gasless (ERC-4337) active - our paymaster sponsors your gas. Best with zTokens (⚡).</span>
                  {intentGasless.feeEstimate && (
                    <span className="block mt-1 text-yellow-400">
                      💰 Service fee: ~${intentGasless.feeEstimate.feeUSD?.toFixed(4)} ({intentGasless.feeEstimate.feeFormatted} {tokenIn?.symbol}) - 2x gas cost
                    </span>
                  )}
                </div>
              ) : isConfidentialMode ? (
                <div>
                  <span className="text-cyan-300">🔐 Confidential Gasless Intent active - staged settlement path for the Fhenix buildathon track.</span>
                  <span className="block mt-1 text-zt-paper/50">
                    Sepolia runtime now uses real CoFHE browser encryption for `minOut`, and the live path can now drive escrow settlement demos on-chain.
                  </span>
                  <span className="block mt-1 text-cyan-200">
                    Live today: staged escrow demos with ERC-20 input, including native output delivery via wrapped routing and final-step unwrap.
                  </span>
                  {confidentialFundingMode === 'erc2612' ? (
                    <span className="block mt-1 text-green-300">
                      Funding step: this token can use a signed ERC-2612 permit to the escrow, so no upfront approval transaction is required.
                    </span>
                  ) : confidentialFundingMode === 'permit2' ? (
                    <span className="block mt-1 text-yellow-300">
                      Funding step: this token can use a signed Permit2 authorization for confidential submission, but Permit2 still needs a one-time token approval if you have not granted it before.
                    </span>
                  ) : confidentialApprovalRequired ? (
                    <span className="block mt-1 text-yellow-300">
                      Current limitation: the first ERC20 approval/spending-cap transaction to the escrow contract is still a normal on-chain approval paid by the user in native gas.
                    </span>
                  ) : null}
                  <span className="block mt-1 text-yellow-200">
                    {confidentialFundingMode === 'erc2612'
                      ? 'Sponsorship begins from the staged confidential submit/execute/finalize lifecycle after you sign the permit payload.'
                      : confidentialFundingMode === 'permit2'
                        ? 'After the one-time Permit2 approval exists, sponsorship begins from the staged confidential submit/execute/finalize lifecycle and subsequent runs only need signed Permit2 payloads.'
                      : 'Sponsorship starts after approval. The staged submit/execute/finalize lifecycle is the sponsored part.'}
                  </span>
                  {confidentialFundingMode !== 'erc2612' && (
                    <span className="block mt-1 text-yellow-300">
                      For a truly approval-free confidential run from step zero today, use an ERC-2612 input token such as zUSDC.
                    </span>
                  )}
                  {confidentialRecommendedInput && (
                    <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-3">
                      <div className="text-cyan-200">
                        Recommended input for zero-gas entry: switch from {tokenIn.symbol} to {confidentialRecommendedInput.symbol}.
                      </div>
                      <button
                        type="button"
                        onClick={() => setTokenIn(confidentialRecommendedInput)}
                        className="mt-2 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                      >
                        Use {confidentialRecommendedInput.symbol} Instead
                      </button>
                    </div>
                  )}
                  {confidentialGasless.quote?.estimatedFeeUSD && (
                    <span className="block mt-1 text-cyan-200">
                      Estimated sponsored cost + protocol fee: ~${Number(confidentialGasless.quote.estimatedFeeUSD).toFixed(4)}
                    </span>
                  )}
                </div>
              ) : isGaslessMode ? (
                <div>
                  <span className="text-yellow-300">🪪 Smart Wallet Batch active - approve + swap will be batched through the wallet when supported.</span>
                  <span className="block mt-1 text-zt-paper/50">
                    Gas may still be paid by the wallet account or wallet-native token-fee system. This is not the same as ZeroToll-sponsored gasless.
                  </span>
                  {smartWalletAvailability?.note && (
                    <span className="block mt-1 text-yellow-200">{smartWalletAvailability.note}</span>
                  )}
                </div>
              ) : (
                <div>
                  <span className="text-blue-400">🚀 Custom EIP-7702 active - delegate authorization is signed for a ZeroToll-selected contract.</span>
                  <span className="block mt-1 text-blue-300">
                    Best reserved for embedded/programmatic wallets. Browser extension wallets often block the raw authorization flow.
                  </span>
                </div>
              )}
            </div>

            {isGaslessMode && smartWalletAvailability && (
              <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-zt-paper/75">
                <div className="font-semibold text-yellow-300 mb-1">Smart Wallet Batch status</div>
                {smartWalletAvailability.available ? (
                  <>
                    <div>Network: {smartWalletAvailability.chain || fromChain.name}</div>
                    <div>Smart account: {smartWalletAvailability.isSmartAccount ? 'enabled' : 'not yet enabled in wallet'}</div>
                    <div>
                      Wallet note: {smartWalletAvailability.note || 'Wallet controls whether gas is paid normally or via wallet-native token fee support.'}
                    </div>
                  </>
                ) : (
                  <div>{smartWalletAvailability.reason || 'Capability check failed.'}</div>
                )}
              </div>
            )}
          </div>

          {/* Network Mismatch Warning Banner */}
          {showNetworkWarning && isConnected && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-yellow-500/50 bg-yellow-500/10">
              <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 text-sm text-zt-paper/90">
                <strong className="text-yellow-400">Wrong Network!</strong> Your wallet is on <strong>{chain?.name || 'unknown network'}</strong>, but you selected <strong>{fromChain.name}</strong>.
                <br />
                <span className="text-xs text-zt-paper/70">MetaMask should prompt you to switch. If not, please switch manually.</span>
              </div>
            </div>
          )}

          {/* From Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">From</label>
            <div className="glass p-4 rounded-xl">
              <div className="flex justify-between mb-3">
                <select
                  value={fromChain.id}
                  onChange={async (e) => {
                    const newChainId = parseInt(e.target.value);
                    const newChain = chains.find(c => c.id === newChainId);
                    if (newChain) {
                      // First update UI state
                      setFromChain(newChain);
                      // Then switch wallet if connected and on different chain
                      if (isConnected && chain?.id !== newChainId && switchChain) {
                        try {
                          await switchChain({ chainId: newChainId });
                        } catch (err) {
                          console.error('Failed to switch chain:', err);
                          toast.error('Please switch network in your wallet');
                        }
                      }
                    }
                  }}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="from-chain-select"
                >
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id} className="bg-zt-ink text-zt-paper">{chain.logo} {chain.name}</option>
                  ))}
                </select>
                <select
                  value={tokenIn.symbol}
                  onChange={(e) => setTokenIn(fromChain.tokens.find(t => t.symbol === e.target.value))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="token-in-select"
                  title={getPermitTooltip(tokenIn)}
                >
                  {fromChain.tokens.map(token => (
                    <option key={token.symbol} value={token.symbol} className="bg-zt-ink text-zt-paper">
                      {token.logo} {token.symbol} {getPermitIndicator(token)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-3xl font-bold text-zt-paper outline-none"
                data-testid="amount-in-input"
              />
            </div>
            {/* Permit Type Legend - Show when ZeroToll gasless is active */}
            {isZeroTollGasless && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zt-paper/60">
                <span title="ERC-2612 permit - fully gasless">⚡ Fully gasless</span>
                <span title="Permit2 - gasless after approval">🔄 Permit2</span>
                <span title="Requires approval transaction">⚠️ Needs approval</span>
              </div>
            )}
          </div>

          <div className="flex justify-center my-4">
            <button
              onClick={async () => {
                // Swap chains and tokens
                const tempChain = fromChain;
                const tempToken = tokenIn;
                setFromChain(toChain);
                setToChain(tempChain);
                setTokenIn(tokenOut);
                setTokenOut(tempToken);
                setAmountOut('');
                setQuote(null);
                // Switch wallet to new fromChain (which was toChain)
                if (isConnected && chain?.id !== toChain.id && switchChain) {
                  try {
                    await switchChain({ chainId: toChain.id });
                  } catch (err) {
                    console.error('Failed to switch chain:', err);
                    toast.error('Please switch network in your wallet');
                  }
                }
              }}
              className="w-12 h-12 rounded-full bg-zt-violet hover:bg-zt-violet/80 flex items-center justify-center transition-all hover:rotate-180 cursor-pointer"
              title="Swap tokens"
            >
              <ArrowDownUp className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* To Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">To</label>
            <div className="glass p-4 rounded-xl">
              <div className="flex justify-between mb-3">
                <select
                  value={toChain.id}
                  onChange={(e) => setToChain(chains.find(c => c.id === parseInt(e.target.value)))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="to-chain-select"
                >
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id} className="bg-zt-ink text-zt-paper">{chain.logo} {chain.name}</option>
                  ))}
                </select>
                <select
                  value={tokenOut.symbol}
                  onChange={(e) => setTokenOut(toChain.tokens.find(t => t.symbol === e.target.value))}
                  className="bg-white/5 text-zt-paper font-semibold outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10 hover:border-zt-aqua/30 transition-colors"
                  data-testid="token-out-select"
                  title={getPermitTooltip(tokenOut)}
                >
                  {toChain.tokens.map(token => (
                    <option key={token.symbol} value={token.symbol} className="bg-zt-ink text-zt-paper">
                      {token.logo} {token.symbol} {getPermitIndicator(token)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={amountOut}
                placeholder="0.00"
                readOnly
                className="w-full bg-transparent text-3xl font-bold text-zt-paper/50 outline-none"
                data-testid="amount-out-display"
              />
            </div>
            {isNativeOutput && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zt-aqua">
                <Zap className="w-3 h-3" />
                <span>Will unwrap to {tokenOut.symbol} on completion</span>
              </div>
            )}
          </div>

          {isZeroTollGasless && (
            <div className="mb-6">
              <div className="glass p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                <div className="flex items-start gap-3 text-xs">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-zt-paper/80">
                    <div className="font-semibold text-green-400 mb-1">ZeroToll Gasless status</div>
                    {intentGasless.isGaslessToken(tokenIn?.address) ? (
                      <>
                        <div>{tokenIn?.symbol} can use permit-based gasless flow on {fromChain.name}.</div>
                        <div className="mt-1">You will sign off-chain approvals/intents, then ZeroToll submits the sponsored execution.</div>
                        {intentGasless.feeEstimate && (
                          <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-yellow-400 font-medium">Service fee (gas + protocol):</span>
                              <span className="font-mono">
                                ~${intentGasless.feeEstimate.feeUSD?.toFixed(4)} ({intentGasless.feeEstimate.feeFormatted} {tokenIn?.symbol})
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-zt-paper/55">
                              Deducted from swap tokens and aligned with treasury / gas-pool economics.
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-yellow-200">
                        {tokenIn?.symbol} is not currently configured for ZeroToll gasless. Choose a token with ⚡ or 🔄 in the selector.
                      </div>
                    )}
                    {gaslessStatus && (
                      <div className="mt-2 rounded bg-zt-aqua/10 p-2 text-zt-aqua">
                        {gaslessStatus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isConfidentialMode && (
            <div className="mb-6">
              <div className="glass p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                <div className="flex items-start gap-3 text-xs">
                  <Info className="w-4 h-4 text-cyan-300 flex-shrink-0 mt-0.5" />
                  <div className="text-zt-paper/80">
                    <div className="font-semibold text-cyan-300 mb-1">Confidential Gasless Intent status</div>
                    <div>
                      This mode is staged on purpose: encrypt a private threshold, sponsor execution, wait for decryption readiness, then finalize success or refund.
                    </div>
                    <div className="mt-1 text-zt-paper/60">
                      Runtime today: real CoFHE encryption on Sepolia + escrow-backed lifecycle tracking. This is still a demo-oriented staged path, not a production-ready confidential router.
                    </div>
                    <div className="mt-1 text-yellow-200">
                      Important: if approval is required, that approval transaction still costs the user native gas. ZeroToll only sponsors the staged confidential execution after approval exists.
                    </div>
                    {confidentialRecommendedInput && (
                      <div className="mt-1 text-green-200">
                        If you want confidential mode to be gasless from step zero, switch the input token to {confidentialRecommendedInput.symbol}. That token supports ERC-2612 permit instead of a setup approval transaction.
                      </div>
                    )}
                    {confidentialGasless.intentId && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-cyan-100">
                        Intent ID: <span className="font-mono">{confidentialGasless.intentId}</span>
                      </div>
                    )}
                    {confidentialGasless.lastStatus?.privacy && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        Client mode: {confidentialGasless.lastStatus.privacy.clientEncryptionMode}
                        <br />
                        Enforcement: {confidentialGasless.lastStatus.privacy.enforcementMode}
                      </div>
                    )}
                    {quote?.contract && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        ConfidentialIntentEscrow: {quote.contract.confidentialIntentEscrow || 'not deployed in shared config'}
                        <br />
                        Runtime path: {quote.contract.liveSubmitMode || (quote.contract.ready ? 'contract address configured' : 'backend staged scaffold still active')}
                        <br />
                        Funding mode: {confidentialFundingMode === 'erc2612'
                          ? 'ERC-2612 signed permit'
                          : confidentialFundingMode === 'permit2'
                            ? 'Permit2 signed authorization (requires one-time Permit2 setup approval)'
                            : 'ERC-20 approval'}
                        {confidentialApprovalRequired && (
                          <>
                            <br />
                            Approval spender: {approvalSpenderAddress}
                          </>
                        )}
                      </div>
                    )}
                    {quote?.delivery && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        Delivery: {quote.delivery.willUnwrapNative
                          ? `${quote.delivery.executionTokenOutSymbol} internally, then unwrap to native ${quote.delivery.requestedTokenOutSymbol}`
                          : `Direct ${quote.delivery.requestedTokenOutSymbol} transfer`}
                      </div>
                    )}
                    {quote?.liveExecutionHint?.adapter && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        Execution venue: {quote.liveExecutionHint.adapter}
                        {quote.liveExecutionHint.quoteSource && (
                          <>
                            <br />
                            Quote source: {quote.liveExecutionHint.quoteSource}
                          </>
                        )}
                        {quote.liveExecutionHint.adapter === 'SmartDexAdapter' && (
                          <>
                            <br />
                            Live venue note: SmartDexAdapter uses a Uniswap-first route with internal liquidity fallback. This is the non-mock path for standard Sepolia pairs, and confidential quotes now try to read the live pool price instead of a generic oracle-only estimate.
                          </>
                        )}
                        {quote.liveExecutionHint.adapter === 'MockDEXAdapter' && (
                          <>
                            <br />
                            Demo note: this venue is on-chain but uses mocked liquidity for buildathon demonstration.
                          </>
                        )}
                        {quote.liveExecutionHint.adapter === 'InventoryOperator' && (
                          <>
                            <br />
                            Demo note: this mixed-pair confidential path is currently fulfilled from operator inventory instead of a direct live adapter.
                            {quote.liveExecutionHint.operatorInventoryBalance && (
                              <>
                                <br />
                                Operator inventory: {quote.liveExecutionHint.operatorInventoryBalance} {quote.delivery?.executionTokenOutSymbol}
                              </>
                            )}
                            {quote.liveExecutionHint.reason && (
                              <>
                                <br />
                                Current readiness: {quote.liveExecutionHint.reason}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {confidentialGasless.lastStatus?.execution?.liveExecution?.adapterKind && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        Finalized path: {confidentialGasless.lastStatus.execution.liveExecution.adapterKind}
                        {confidentialGasless.lastStatus.execution.liveExecution.adapterKind === 'smartDex' && (
                          <>
                            <br />
                            This finalized through SmartDexAdapter, the live Uniswap-first venue for standard Sepolia pairs.
                          </>
                        )}
                        {confidentialGasless.lastStatus.execution.liveExecution.adapterKind === 'mockDex' && (
                          <>
                            <br />
                            This finalized through MockDEXAdapter demo liquidity, not a production market venue.
                          </>
                        )}
                      </div>
                    )}
                    {confidentialTxLinks.length > 0 && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        <div className="font-semibold text-cyan-200 mb-2">Confidential transaction links</div>
                        <div className="space-y-1">
                          {confidentialTxLinks.map((item) => {
                            const url = getExplorerTxUrl(fromChain.id, item.hash);
                            return (
                              <div key={`${item.label}-${item.hash}`} className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-zt-paper/65">{item.label}</span>
                                {url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                                  >
                                    {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                                  </a>
                                ) : (
                                  <span className="font-mono text-cyan-300">
                                    {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {gaslessStatus && (
                      <div className="mt-2 rounded bg-zt-aqua/10 p-2 text-zt-aqua">
                        {gaslessStatus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isGaslessMode && (
            <div className="mb-6">
              <div className="glass p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-start gap-3 text-xs">
                  <Info className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
                  <div className="text-zt-paper/80">
                    <div className="font-semibold text-yellow-300 mb-1">Smart Wallet Batch status</div>
                    <div>
                      Approve + swap will be bundled through the wallet using `wallet_sendCalls` when the wallet supports it.
                    </div>
                    <div className="mt-1 text-zt-paper/60">
                      This improves UX, but gas payment remains wallet-controlled rather than ZeroToll-controlled.
                    </div>
                    {smartWalletAvailability?.note && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-zt-paper/75">
                        {smartWalletAvailability.note}
                      </div>
                    )}
                    {gaslessSwap.statusMessage && (
                      <div className="mt-2 rounded bg-zt-aqua/10 p-2 text-zt-aqua">
                        {gaslessSwap.statusMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isEIP7702Mode && (
            <div className="mb-6">
              <div className="glass p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <div className="flex items-start gap-3 text-xs">
                  <AlertTriangle className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
                  <div className="text-zt-paper/80">
                    <div className="font-semibold text-blue-300 mb-1">Custom EIP-7702 requirements</div>
                    <div>
                      This mode needs a wallet that exposes raw EIP-7702 authorization signing for an app-selected delegate.
                    </div>
                    <div className="mt-1 text-zt-paper/60">
                      Recommended wallet categories: Privy embedded, Magic embedded, Turnkey, or similar programmatic signers.
                    </div>
                    {!isCustomEip7702Eligible && (
                      <div className="mt-2 rounded bg-black/20 p-2 text-blue-200">
                        Current connector: {connector?.name || 'unknown wallet'}.
                        This connection exposes a browser RPC account, so Custom EIP-7702 is intentionally disabled here.
                      </div>
                    )}
                    {gaslessStatus && (
                      <div className="mt-2 rounded bg-zt-aqua/10 p-2 text-zt-aqua">
                        {gaslessStatus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gas Payment Mode Selector - Traditional mode only */}
          {!isGaslessMode && !isZeroTollGasless && !isEIP7702Mode && !isConfidentialMode && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">
              Fee Payment Mode
              <span className="ml-2 text-xs text-zt-aqua cursor-help" title="Choose how to pay transaction fees">ⓘ</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {feeModes.map((mode) => {
                const isAvailable = tokenIn.feeModes.includes(mode.id);
                const isDisabled = !isAvailable;
                return (
                  <button
                    key={mode.id}
                    onClick={() => !isDisabled && setFeeMode(mode.id)}
                    disabled={isDisabled}
                    className={`p-4 rounded-xl text-left transition-all ${
                      feeMode === mode.id
                        ? 'glass-strong border-2 border-zt-violet'
                        : isDisabled
                        ? 'glass border border-white/5 opacity-40 cursor-not-allowed'
                        : 'glass border border-white/5 hover:border-zt-aqua/30'
                    }`}
                    data-testid={`fee-mode-${mode.id.toLowerCase()}`}
                    title={isDisabled ? `Not available for ${tokenIn.symbol} (no oracle/low liquidity)` : ''}
                  >
                    <div className="font-semibold text-zt-paper mb-1">
                      {mode.label}
                      {isDisabled && <span className="ml-2 text-xs text-red-400">⚠️</span>}
                    </div>
                    <div className="text-xs text-zt-paper/60">{mode.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-zt-paper/50">
                ℹ️ Some modes disabled for tokens without oracle or low liquidity
              </p>
              <button
                onClick={() => setShowExplainer(!showExplainer)}
                className="text-zt-aqua text-xs flex items-center gap-1 hover:text-zt-violet transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                {showExplainer ? 'Hide' : 'How it works'}
              </button>
            </div>
            {showExplainer && (
              <div className="mt-4">
                <FeeModeExplainer mode={feeMode} />
              </div>
            )}
          </div>
          )}

          {/* Fee Cap - Traditional mode only */}
          {!isGaslessMode && !isZeroTollGasless && !isEIP7702Mode && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-2">
              Max Fee Cap (
              {feeMode === 'INPUT' ? tokenIn.symbol : 
               feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) : 
               feeMode === 'STABLE' ? 'USDC' : 'POL/ETH'})
              <span className="ml-2 text-xs text-zt-aqua cursor-help" title="Surplus auto-refunded on-chain">ⓘ</span>
            </label>
            <input
              type="number"
              value={feeCap}
              onChange={(e) => setFeeCap(e.target.value)}
              placeholder="e.g. 3.0"
              className="w-full glass p-4 rounded-xl bg-transparent text-zt-paper outline-none"
              data-testid="fee-cap-input"
            />
            <p className="text-xs text-zt-paper/50 mt-2">
              ✅ Fee ≤ cap enforced on-chain. Unused amount refunded in fee token.
            </p>
          </div>
          )}

          {/* Info Banners - Traditional mode with OUTPUT fee */}
          {!isGaslessMode && !isZeroTollGasless && !isEIP7702Mode && feeMode === 'OUTPUT' && isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output-fee + Unwrap:</strong> Fee skimmed from wrapped output ({wrappedOutputSymbol}) before unwrapping to native {tokenOut.symbol}.
              </div>
            </div>
          )}
          {!isGaslessMode && !isZeroTollGasless && !isEIP7702Mode && feeMode === 'OUTPUT' && !isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output Mode:</strong> Fee skimmed from output tokens on destination before crediting net amount.
              </div>
            </div>
          )}
          {!isGaslessMode && !isZeroTollGasless && !isEIP7702Mode && feeMode === 'INPUT' && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-violet/30">
              <Info className="w-5 h-5 text-zt-violet flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-violet">Input Mode:</strong> You'll sign Permit2 to lock fee from input token on source. Non-custodial, one-time approval.
              </div>
            </div>
          )}

          {/* Quote Info */}
          {quote && !isGaslessMode && !isEIP7702Mode && (
            <div className="mb-6 glass p-4 rounded-xl space-y-2 text-sm border border-zt-violet/30">
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Relayer:</span>
                <span className="text-zt-aqua font-mono">{quote.relayer?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Fee Token:</span>
                <span className="text-zt-paper font-semibold">
                  {feeMode === 'INPUT' ? tokenIn.symbol : 
                   feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) : 
                   feeMode === 'STABLE' ? 'USDC' : 'POL/ETH'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Estimated Fee:</span>
                <span className="text-zt-paper">{quote.estimatedFee || '~0.5'} ({quote.feeUSD || '$0.50'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Oracle:</span>
                <span className="text-zt-aqua text-xs">
                  {quote.oracleSource || 'Pyth'} 
                  {quote.priceAge && <span className="text-zt-paper/50 ml-1">(age {quote.priceAge}s)</span>}
                  {quote.confidence && <span className="text-zt-paper/50 ml-1">(conf {quote.confidence}%)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zt-paper/70">Net Receives:</span>
                <span className="text-zt-aqua font-semibold">{amountOut} {tokenOut.symbol}</span>
              </div>
              {quote.includesPriceUpdate && (
                <div className="pt-2 border-t border-white/10 text-xs text-zt-paper/60">
                  ℹ️ Includes on-chain price update fee (Pyth)
                </div>
              )}
              <div className="pt-2 border-t border-white/10 text-xs text-zt-paper/60">
                ✅ Fee ≤ cap. Surplus auto-refunded in fee token.
              </div>
            </div>
          )}

          {/* Gasless Swap Status */}
          {isGaslessMode && gaslessSwap.status && (
            <GaslessSwapStatus
              status={gaslessSwap.status}
              message={gaslessSwap.statusMessage}
              txHash={gaslessSwap.txHash}
              chainId={fromChain.id}
            />
          )}

          {isConfidentialMode && confidentialGasless.intentId && (
            <div className="mb-6 glass p-4 rounded-xl flex items-center gap-3 border border-cyan-500/30">
              <CheckCircle className="w-6 h-6 text-cyan-300 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-zt-paper font-semibold">
                  {confidentialGasless.lastStatus?.stage === 'finalized_success'
                    ? '🔐 Confidential Intent Finalized'
                    : confidentialGasless.lastStatus?.stage === 'refunded'
                    ? '🔐 Confidential Intent Refunded'
                    : '🔐 Confidential Intent In Flight'}
                </p>
                <p className="text-zt-paper/70 text-sm font-mono mb-2">
                  {confidentialGasless.intentId.slice(0, 18)}...
                </p>
                <p className="text-cyan-300 text-sm mb-2">
                  {confidentialGasless.lastStatus?.statusMessage || confidentialGasless.statusMessage}
                </p>
                {confidentialGasless.lastStatus?.execution && (
                  <div className="text-xs text-zt-paper/65">
                    {confidentialGasless.lastStatus.execution.liveExecution ? 'Latest gross output' : 'Simulated gross output'}: {confidentialGasless.lastStatus.execution.grossAmountOut} {tokenOut.symbol}
                  </div>
                )}
                {confidentialTxLinks.length > 0 && (
                  <div className="mt-3 grid gap-1 text-xs">
                    {confidentialTxLinks.map((item) => {
                      const url = getExplorerTxUrl(fromChain.id, item.hash);
                      return (
                        <div key={`banner-${item.label}-${item.hash}`} className="flex items-center justify-between gap-3">
                          <span className="text-zt-paper/60">{item.label}</span>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                            >
                              {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                            </a>
                          ) : (
                            <span className="font-mono text-cyan-300">
                              {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Message - Show for both traditional and ZeroToll gasless modes */}
          {txHash && (
            <div className="mb-6 glass p-4 rounded-xl flex items-center gap-3 border border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-zt-paper font-semibold">
                  {isZeroTollGasless
                    ? '⚡ ZeroToll Gasless Submitted!'
                    : isGaslessMode
                    ? '🪪 Smart Wallet Batch Submitted!'
                    : isEIP7702Mode
                    ? '🚀 Custom EIP-7702 Submitted!'
                    : 'Swap Submitted!'}
                </p>
                <p className="text-zt-paper/70 text-sm font-mono mb-2">{txHash.slice(0, 20)}...</p>
                {gaslessStatus && (
                  <p className="text-green-400 text-sm mb-2">{gaslessStatus}</p>
                )}
                {txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div className="flex gap-2">
                    {/* Show only source chain explorer for same-chain swaps */}
                    {fromChain.id === toChain.id ? (
                      <a 
                        href={fromChain.id === 11155111 
                          ? `https://sepolia.etherscan.io/tx/${txHash}`
                          : fromChain.id === 80002
                          ? `https://amoy.polygonscan.com/tx/${txHash}`
                          : fromChain.id === 421614
                          ? `https://sepolia.arbiscan.io/tx/${txHash}`
                          : `https://sepolia-optimism.etherscan.io/tx/${txHash}`
                        }
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-zt-aqua text-xs hover:text-zt-violet transition-colors"
                      >
                        View on {fromChain.name} Explorer →
                      </a>
                    ) : (
                      /* Show both explorers for cross-chain swaps */
                      <>
                        <a 
                          href={fromChain.id === 11155111 
                            ? `https://sepolia.etherscan.io/tx/${txHash}`
                            : fromChain.id === 80002
                            ? `https://amoy.polygonscan.com/tx/${txHash}`
                            : fromChain.id === 421614
                            ? `https://sepolia.arbiscan.io/tx/${txHash}`
                            : `https://sepolia-optimism.etherscan.io/tx/${txHash}`
                          }
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-zt-aqua text-xs hover:text-zt-violet transition-colors"
                        >
                          View on {fromChain.name} Explorer →
                        </a>
                        <span className="text-zt-paper/50 text-xs">•</span>
                        <a 
                          href={toChain.id === 11155111 
                            ? `https://sepolia.etherscan.io/tx/${txHash}`
                            : toChain.id === 80002
                            ? `https://amoy.polygonscan.com/tx/${txHash}`
                            : toChain.id === 421614
                            ? `https://sepolia.arbiscan.io/tx/${txHash}`
                            : `https://sepolia-optimism.etherscan.io/tx/${txHash}`
                          }
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-zt-violet text-xs hover:text-zt-aqua transition-colors"
                        >
                          View on {toChain.name} Explorer →
                        </a>
                      </>
                    )}
                  </div>
                )}
                {txHash === '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <p className="text-yellow-400 text-xs">⚠️ Demo mode - No real transaction sent</p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleGetQuote}
              disabled={loading}
              className="flex-1 btn-secondary hover-glow"
              data-testid="get-quote-btn"
            >
              {loading ? <Loader2 className="inline w-5 h-5 animate-spin" /> : 'Get Quote'}
            </button>
            
            {/* Show Approve button if needed, otherwise Execute */}
            {/* Confidential intent now only needs approval for tokens without Permit2 / ERC-2612 funding support. */}
            {showApprovalAction ? (
              <button
                onClick={handleApprove}
                disabled={approvalPending || loading}
                className="flex-1 btn-primary hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="approve-token-btn"
              >
                {approvalPending ? (
                  <>
                    <Loader2 className="inline w-5 h-5 animate-spin mr-2" />
                    Approving...
                  </>
                ) : (
                  zeroTollApprovalRequired
                    ? `One-time Approve ${tokenIn.symbol} to Permit2`
                    : confidentialApprovalRequired
                    ? (confidentialFundingMode === 'permit2'
                        ? `One-time Approve ${tokenIn.symbol} to Permit2`
                        : `Approve ${tokenIn.symbol} to Escrow`)
                    : `Approve ${tokenIn.symbol}`
                )}
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={(loading || gaslessSwap.isLoading || intentGasless.isLoading || eip7702Swap.loading || confidentialGasless.isLoading) || (!quote && !isZeroTollGasless && !isEIP7702Mode && !isGaslessMode && !isConfidentialMode) || showApprovalAction || (fromChain.id !== toChain.id)}
                className="flex-1 btn-primary hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="execute-swap-btn"
                title={
                  fromChain.id !== toChain.id ? 'Cross-chain swaps not yet supported' :
                  showApprovalAction
                    ? (
                        zeroTollApprovalRequired
                          ? 'Please complete the one-time Permit2 approval first'
                          : confidentialApprovalRequired
                          ? (confidentialFundingMode === 'permit2'
                              ? 'Please complete the one-time Permit2 approval first'
                              : 'Please approve the ConfidentialIntentEscrow spender first')
                          : 'Please approve token first'
                      )
                    :
                  ''
                }
              >
                {(loading || gaslessSwap.isLoading || intentGasless.isLoading || confidentialGasless.isLoading) ? (
                  <Loader2 className="inline w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {(isGaslessMode || isZeroTollGasless || isEIP7702Mode || isConfidentialMode) && <Zap className="w-4 h-4" />}
                    {isEIP7702Mode
                      ? '🚀 Execute Custom EIP-7702'
                      : isConfidentialMode
                      ? '🔐 Execute Confidential Intent'
                      : isZeroTollGasless
                      ? '⚡ Execute ZeroToll Gasless'
                      : isGaslessMode
                      ? '🪪 Execute Smart Wallet Batch'
                      : 'Execute Swap'}
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Cross-Chain Warning Banner */}
          {fromChain.id !== toChain.id && (
            <div className="mt-4 glass p-4 rounded-xl flex items-start gap-3 border border-orange-500/30 bg-orange-500/5">
              <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-orange-400">Cross-Chain Swaps Currently Unavailable:</strong> Cross-chain bridging is not yet implemented. MockBridgeAdapter only simulates bridging for testing. Please use same-chain swaps for now (e.g., USDC → WETH on Sepolia, or USDC → WMATIC on Amoy).
                <br />
                <span className="text-xs text-zt-paper/60 mt-1 block">ℹ️ Real bridge integration (Polygon PoS Portal) coming soon!</span>
              </div>
            </div>
          )}
          
          {/* Approval Info Banner - Don't show for mode-managed flows */}
          {showApprovalAction && (
            <div className="mt-4 glass p-4 rounded-xl flex items-start gap-3 border border-yellow-500/30">
              <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-yellow-400">Approval Required:</strong>{' '}
                {zeroTollApprovalRequired
                  ? `Permit2 needs a one-time token approval before ZeroToll gasless execution can pull ${tokenIn.symbol}.`
                  : confidentialApprovalRequired
                    ? (confidentialFundingMode === 'permit2'
                        ? `Permit2 needs a one-time token approval before confidential submission can pull ${tokenIn.symbol}.`
                        : `Approve the ConfidentialIntentEscrow spender before executing the confidential flow.`)
                    : `You need to approve the RouterHub contract to spend your ${tokenIn.symbol} before executing the swap.`}
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Execution</p>
              <p className={`text-lg font-bold ${
                isZeroTollGasless ? 'text-green-400' :
                isGaslessMode ? 'text-yellow-300' :
                isEIP7702Mode ? 'text-blue-400' :
                'text-zt-violet'
              }`}>
                {isZeroTollGasless
                  ? 'ERC-4337'
                  : isGaslessMode
                  ? 'Wallet Batch'
                  : isEIP7702Mode
                  ? 'Custom 7702'
                  : 'Traditional'}
              </p>
            </div>
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Supported Tokens</p>
              <p className="text-zt-aqua text-lg font-bold">{fromChain.tokens.length + toChain.tokens.length}</p>
            </div>
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Success Rate</p>
              <p className="text-zt-aqua text-lg font-bold">99.8%</p>
            </div>
          </div>
          
          <div className="glass p-4 rounded-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zt-paper/70">Network:</span>
              <span className="text-zt-paper font-semibold">
                {fromChain.name} → {toChain.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-zt-paper/70">Fee Path:</span>
              <span className="text-zt-aqua font-semibold">
                {isZeroTollGasless
                  ? `${tokenIn.symbol} recoup`
                  : isGaslessMode
                  ? 'Wallet-controlled'
                  : isEIP7702Mode
                  ? 'Custom delegate flow'
                  : feeMode === 'INPUT'
                  ? tokenIn.symbol
                  : feeMode === 'OUTPUT'
                  ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol)
                  : feeMode === 'STABLE'
                  ? 'USDC'
                  : 'POL/ETH'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-zt-paper/70">Cap Enforcement:</span>
              <span className="text-green-400 font-semibold">✓ On-chain</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Swap;
