import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownUp, Loader2, CheckCircle, Info, HelpCircle, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { ethers } from 'ethers';
import FeeModeExplainer from '../components/FeeModeExplainer';
import ConnectButton from '../components/ConnectButton';
import GaslessSwapStatus from '../components/GaslessSwapStatus';
import { useGaslessSwap } from '../hooks/useGaslessSwap';
import { useTrueGaslessSwap } from '../hooks/useTrueGaslessSwap';
import { useWorkingGasless, EIP7702_SUPPORTED_CHAINS } from '../hooks/useWorkingGasless';
import { useIntentGasless } from '../hooks/useIntentGasless';
import amoyTokens from '../config/tokenlists/zerotoll.tokens.amoy.json';
import sepoliaTokens from '../config/tokenlists/zerotoll.tokens.sepolia.json';
import arbitrumSepoliaTokens from '../config/tokenlists/zerotoll.tokens.arbitrum-sepolia.json';
import optimismSepoliaTokens from '../config/tokenlists/zerotoll.tokens.optimism-sepolia.json';
import contractsConfig from '../config/contracts.json';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// RouterHub addresses per chain (UPGRADED Nov 6-8, 2025 - Bug Fix: Transfer to user)
// Load from config file to avoid hardcoding
const ROUTER_HUB_ADDRESSES = {
  80002: contractsConfig.amoy.routerHub,          // Amoy RouterHub v1.4
  11155111: contractsConfig.sepolia.routerHub,    // Sepolia RouterHub v1.4 (Nov 8)
  421614: "0x...",  // Arbitrum Sepolia (if deployed)
  11155420: "0x..."  // Optimism Sepolia (if deployed)
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

const Swap = () => {
  const navigate = useNavigate();
  const { address, isConnected, chain } = useAccount();
  
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
  
  // Gasless mode toggle
  const [isGaslessMode, setIsGaslessMode] = useState(false);
  const [isTrueGasless, setIsTrueGasless] = useState(true); // Default to TRUE gasless
  const [isZeroTollGasless, setIsZeroTollGasless] = useState(false); // ZeroToll intent-based gasless
  const [gaslessStatus, setGaslessStatus] = useState('');
  const gaslessSwap = useGaslessSwap();
  const trueGaslessSwap = useTrueGaslessSwap();
  const workingGasless = useWorkingGasless(); // NEW: Actually working gasless hook
  const intentGasless = useIntentGasless(); // ZeroToll gasless (works on Sepolia and Amoy)
  
  // Check if current chain supports true gasless (Gnosis/Base only)
  const isGaslessChain = EIP7702_SUPPORTED_CHAINS.includes(chain?.id);
  
  // Approval state
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  
  // Network mismatch state
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  
  // Get RouterHub address for current chain
  const routerHubAddress = ROUTER_HUB_ADDRESSES[fromChain?.id];
  
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
    args: address && routerHubAddress ? [address, routerHubAddress] : undefined,
    enabled: Boolean(address && routerHubAddress && tokenIn && !tokenIn.isNative),
  });

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
      routerHub: routerHubAddress
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
  }, [amountIn, currentAllowance, tokenIn, refetchAllowance]);
  
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
      const intent = {
        user: address || '0x1234567890123456789012345678901234567890',
        tokenIn: tokenIn.symbol,
        amtIn: parseFloat(amountIn),
        tokenOut: tokenOut.symbol,
        minOut: parseFloat(amountIn) * 0.995,
        srcChainId: fromChain.id,  // ✅ FIX: Send source chain ID
        dstChainId: toChain.id,
        feeMode,
        feeCap: parseFloat(feeCap),
        deadline: Math.floor(Date.now() / 1000) + 600,
        nonce: Date.now()
      };

      const response = await axios.post(`${API}/quote`, { intent });
      
      if (response.data.success) {
        const quoteData = response.data;
        setQuote(quoteData);
        
        // CRITICAL: Use backend's netOut for correct price conversion
        if (quoteData.netOut !== undefined) {
          setAmountOut(quoteData.netOut.toFixed(6));
        } else {
          setAmountOut((parseFloat(amountIn) * 0.995).toFixed(6));
        }
        
        toast.success('Quote received!');
      } else {
        toast.error(response.data.reason || 'No quote available');
      }
    } catch (error) {
      console.error('Quote error:', error);
      toast.error('Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!tokenIn || tokenIn.isNative || !routerHubAddress) return;
    
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

      // If gasless mode, use TRUE gasless approval via ZeroToll paymaster
      if (isGaslessMode && isTrueGasless) {
        // Check TRUE gasless availability first
        const availability = await trueGaslessSwap.checkAvailability();
        console.log('🔍 TRUE Gasless availability:', availability);
        
        if (!availability.available || !availability.gasless) {
          toast.error(`TRUE Gasless not available: ${availability.reason}`);
          setApprovalPending(false);
          return;
        }
        
        toast.info(`🎉 TRUE GASLESS approval on ${availability.chain} - You pay $0 in gas!`);
        
        try {
          // Use TRUE gasless approval via ZeroToll paymaster
          await trueGaslessSwap.executeGaslessApproval({
            tokenAddress: tokenIn.address,
            spender: routerHubAddress,
            amount: amountWei.toString()
          });

          toast.success('🎉 TRUE GASLESS approval successful! You paid $0 in gas!');
          
          // Wait for approval to be confirmed
          await new Promise(resolve => setTimeout(resolve, 3000));
          await refetchAllowance();
          
          setApprovalPending(false);
        } catch (gaslessError) {
          console.error('TRUE gasless approval error:', gaslessError);
          toast.error(gaslessError.message || 'TRUE gasless approval failed');
          setApprovalPending(false);
        }
        return;
      }
      
      // Fallback to EIP-5792 batch mode (still requires gas but batches calls)
      if (isGaslessMode) {
        const availability = await gaslessSwap.checkAvailability();
        console.log('🔍 Batch mode availability:', availability);
        
        if (!availability.available) {
          toast.error(`Batch mode not available: ${availability.reason}`);
          setApprovalPending(false);
          return;
        }
        
        toast.info(`⚡ Batch approval on ${availability.chain} (requires gas)`);
        
        try {
          await gaslessSwap.executeApproval({
            tokenAddress: tokenIn.address,
            spender: routerHubAddress,
            amount: amountWei.toString(),
            targetChainId: fromChain.id
          });

          toast.success('✅ Approval submitted! Waiting for confirmation...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          await refetchAllowance();
          setApprovalPending(false);
        } catch (gaslessError) {
          console.error('Batch approval error:', gaslessError);
          toast.error(gaslessError.message || 'Batch approval failed');
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
        args: [routerHubAddress, 0n],
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
        args: [routerHubAddress, amountWei],
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

  // TRUE GASLESS execution using ZeroToll paymaster - USER PAYS $0 GAS!
  const handleTrueGaslessExecute = async () => {
    try {
      toast.info('🎉 Executing TRUE GASLESS swap - You pay $0 in gas!');
      
      // Native tokens don't work with gasless
      if (tokenIn.isNative) {
        toast.error('❌ Native tokens cannot be used with gasless. Use WPOL/WETH instead.');
        return;
      }

      // Validate addresses
      if (!tokenIn.address?.startsWith('0x') || !tokenOut.address?.startsWith('0x')) {
        toast.error('❌ Invalid token addresses');
        return;
      }

      const decimals = tokenIn.decimals || 6;
      const amountWei = parseUnits(amountIn, decimals);
      const minAmountOut = parseUnits((parseFloat(amountOut) * 0.50).toString(), tokenOut.decimals || 6);
      
      // Build swap callData
      const routerHubInterface = new ethers.Interface([
        "function executeRoute(tuple(address user, address tokenIn, uint256 amtIn, address tokenOut, uint256 minOut, uint64 dstChainId, uint64 deadline, address feeToken, uint8 feeMode, uint256 feeCapToken, bytes routeHint, uint256 nonce) intent, address adapter, bytes routeData) external returns (uint256)"
      ]);
      
      const adapterInterface = new ethers.Interface([
        "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) external payable returns (uint256 amountOut)"
      ]);
      
      const intent = {
        user: address,
        tokenIn: tokenIn.address,
        amtIn: amountWei,
        tokenOut: tokenOut.address,
        minOut: minAmountOut,
        dstChainId: toChain.id,
        deadline: Math.floor(Date.now() / 1000) + 600,
        feeToken: tokenIn.address,
        feeMode: 1,
        feeCapToken: parseUnits(feeCap, 18),
        routeHint: '0x',
        nonce: BigInt(Date.now())
      };

      const mockAdapter = fromChain.id === 80002 
        ? '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1'
        : '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';
      
      const routeData = adapterInterface.encodeFunctionData("swap", [
        tokenIn.address,
        tokenOut.address,
        amountWei,
        minAmountOut,
        routerHubAddress,
        intent.deadline
      ]);
      
      const swapCallData = routerHubInterface.encodeFunctionData("executeRoute", [
        intent,
        mockAdapter,
        routeData
      ]);

      // Execute TRUE gasless batch (approve + swap) - $0 gas!
      console.log('📤 Executing TRUE GASLESS batch via ZeroToll paymaster');
      
      await trueGaslessSwap.executeGaslessBatch({
        tokenAddress: tokenIn.address,
        spender: routerHubAddress,
        amount: amountWei.toString(),
        routerHub: routerHubAddress,
        swapCallData
      });

      toast.success('🎉 TRUE GASLESS swap successful! You paid $0 in gas!');
      
    } catch (error) {
      console.error('TRUE gasless error:', error);
      toast.error(error.message || 'TRUE gasless swap failed');
    }
  };

  const handleGaslessExecute = async () => {
    // Relayer mode now uses the same backend relayer as ZeroToll mode
    // Both modes achieve TRUE gasless swaps via the backend Smart Account + ZeroToll paymaster
    try {
      // Native tokens (POL/ETH) don't work with gasless swaps - need wrapped version
      if (tokenIn.isNative) {
        toast.error('❌ Native tokens (POL/ETH) cannot be used with gasless swaps. Please use WPOL/WETH instead.');
        return;
      }

      // Validate token addresses
      if (!tokenIn.address || tokenIn.address === 'NATIVE' || !tokenIn.address.startsWith('0x')) {
        toast.error('❌ Invalid input token address. Please select a different token.');
        return;
      }
      if (!tokenOut.address || tokenOut.address === 'NATIVE' || !tokenOut.address.startsWith('0x')) {
        toast.error('❌ Invalid output token address. Please select a different token.');
        return;
      }

      // Check permit type for the token
      const permitType = intentGasless.getPermitType(tokenIn.address);
      
      if (permitType === 'none') {
        toast.error(`${tokenIn.symbol} doesn't support gasless. Use zTokens (⚡) or Permit2 tokens (🔄).`);
        return;
      }

      // Use the same backend relayer as ZeroToll mode
      toast.info('🔄 Relayer mode - submitting gasless swap via backend relayer...');
      
      const decimals = tokenIn.decimals || 6;
      const amountWei = parseUnits(amountIn, decimals);
      
      // Calculate minAmountOut with proper decimal conversion (same as ZeroToll mode)
      const decimalsOut = tokenOut.decimals || 18;
      const slippageTolerance = 0.90; // 10% slippage tolerance
      
      const amountAfterFeeWei = amountWei * 995n / 1000n;
      let expectedOutputWei;
      if (decimalsOut >= decimals) {
        expectedOutputWei = amountAfterFeeWei * BigInt(10 ** (decimalsOut - decimals));
      } else {
        expectedOutputWei = amountAfterFeeWei / BigInt(10 ** (decimals - decimalsOut));
      }
      const minOut = expectedOutputWei * 90n / 100n;

      let result;
      if (permitType === 'erc2612') {
        // ERC-2612 permit - fully gasless (relayer pays)
        setGaslessStatus('Sign Permit + Swap Intent in MetaMask (NO GAS!)...');
        toast.info('⚡ Sign 2 messages in MetaMask - relayer pays gas for you!');
        
        result = await intentGasless.submitSwapWithPermit({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: amountWei.toString(),
          minAmountOut: minOut.toString(),
          deadlineMinutes: 30,
          mode: 'relayer'  // Use relayer EOA to pay gas
        });
      } else if (permitType === 'permit2') {
        // Permit2 - gasless (relayer pays)
        setGaslessStatus('Sign Permit2 + Swap Intent in MetaMask...');
        toast.info('🔄 Sign 2 messages in MetaMask - relayer pays gas for you!');
        
        result = await intentGasless.submitSwapWithPermit2({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: amountWei.toString(),
          minAmountOut: minOut.toString(),
          deadlineMinutes: 30,
          mode: 'relayer'  // Use relayer EOA to pay gas
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
        console.log('📊 Swap status:', status);
        
        if (status.txHash) {
          setTxHash(status.txHash);
        }
        
        if (status.status === 'confirmed') {
          setGaslessStatus('✓ Swap confirmed! You paid ZERO gas!');
          toast.success('🎉 Gasless swap confirmed! You paid $0 in gas!');
          return;
        } else if (status.status === 'failed') {
          setGaslessStatus('Swap failed on-chain');
          toast.error('Swap failed on-chain');
          return;
        }
      }
      setGaslessStatus('Check explorer for status');
      
    } catch (error) {
      console.error('Gasless swap error:', error);
      setGaslessStatus('');
      toast.error(error.message || 'Gasless swap failed');
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

      // Calculate minAmountOut with proper decimal conversion
      // Router test mode formula:
      //   fee = amountIn * 0.5%
      //   amountAfterFee = amountIn - fee
      //   if decimalsOut >= decimalsIn: amountOut = amountAfterFee * 10^(decimalsOut - decimalsIn)
      //   if decimalsOut < decimalsIn:  amountOut = amountAfterFee / 10^(decimalsIn - decimalsOut)
      const decimalsOut = tokenOut.decimals || 18;
      const slippageTolerance = 0.90; // 10% slippage tolerance for test mode
      
      // amountWei is already in input token's smallest unit (wei)
      // Router takes 0.5% fee
      const amountAfterFeeWei = amountWei * 995n / 1000n;
      
      // Apply decimal conversion (same as router)
      let expectedOutputWei;
      if (decimalsOut >= decimals) {
        // Output has more decimals - multiply
        expectedOutputWei = amountAfterFeeWei * BigInt(10 ** (decimalsOut - decimals));
      } else {
        // Output has fewer decimals - divide
        expectedOutputWei = amountAfterFeeWei / BigInt(10 ** (decimals - decimalsOut));
      }
      
      // Apply slippage tolerance (multiply by 90, divide by 100)
      const minOut = expectedOutputWei * 90n / 100n;
      let result;

      if (permitType === 'erc2612') {
        // ERC-2612 permit - fully gasless
        setGaslessStatus('Sign Permit + Swap Intent in MetaMask (NO GAS!)...');
        toast.info('⚡ Sign 2 messages in MetaMask - you pay ZERO gas!');
        
        result = await intentGasless.submitSwapWithPermit({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: amountWei.toString(),
          minAmountOut: minOut.toString(),
          deadlineMinutes: 30
        });
      } else if (permitType === 'permit2') {
        // Permit2 - gasless after one-time approval
        setGaslessStatus('Sign Permit2 + Swap Intent in MetaMask...');
        toast.info('🔄 Sign 2 messages in MetaMask - gasless via Permit2!');
        
        result = await intentGasless.submitSwapWithPermit2({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
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
          setGaslessStatus('Swap failed on-chain');
          toast.error('Swap failed on-chain');
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

  const handleExecute = async () => {
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
    if (needsApproval && !tokenIn.isNative) {
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

          {/* Gasless Mode Toggle - Single option */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">
              Gasless Mode <span className="text-zt-paper/40 font-normal">(ZeroToll pays gas for you)</span>
            </label>
            <button
              onClick={() => {
                setIsZeroTollGasless(!isZeroTollGasless);
                setIsGaslessMode(false); // Disable old relayer mode
              }}
              className={`w-full glass p-4 rounded-xl transition-all text-left ${
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
                      ZeroToll Gasless {isZeroTollGasless && <span className="text-xs ml-2">✓ Active</span>}
                    </div>
                    <div className="text-xs text-zt-paper/50">Sign 2 messages, pay $0 gas - we sponsor it!</div>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${isZeroTollGasless ? 'bg-green-500' : 'bg-white/20'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${isZeroTollGasless ? 'translate-x-6 ml-0.5' : 'ml-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Mode Description */}
            <div className="mt-3 text-xs text-zt-paper/60">
              {!isZeroTollGasless ? (
                <span>💳 Traditional swap - you pay gas in native token (ETH/POL). Toggle above to enable gasless.</span>
              ) : (
                <span className="text-green-400">⚡ ZeroToll Gasless active - our paymaster sponsors your gas. Best with zTokens (⚡). Click to disable.</span>
              )}
            </div>
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

          {/* OLD: TRUE Gasless Mode Toggle (EIP-7702) - HIDDEN, not working on testnets */}
          {false && <div className="mb-6">
            <div className={`glass p-4 rounded-xl border ${isGaslessChain ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className={`w-5 h-5 ${isGaslessChain ? 'text-green-400' : 'text-yellow-400'}`} />
                  <div>
                    <div className="font-semibold text-zt-paper">
                      {isGaslessChain 
                        ? (trueGaslessSwap.isSmartAccount ? '🎉 TRUE Gasless Mode' : '⚡ Gasless Available')
                        : '⚡ Batch Mode Only'}
                    </div>
                    <div className="text-xs text-zt-paper/60">
                      {isGaslessChain 
                        ? (trueGaslessSwap.isSmartAccount 
                          ? 'Pay $0 in gas fees! Sponsored by ZeroToll' 
                          : 'Enable Smart Account for $0 gas')
                        : 'Testnets: Batch approve+swap (gas required)'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsGaslessMode(!isGaslessMode)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    isGaslessMode ? (isGaslessChain ? 'bg-green-500' : 'bg-yellow-500') : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      isGaslessMode ? 'translate-x-7' : ''
                    }`}
                  />
                </button>
              </div>
              
              {/* Chain Support Warning */}
              {isGaslessMode && !isGaslessChain && (
                <div className="mt-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold text-yellow-400 mb-1">⚠️ Testnet Limitation</div>
                      <div className="text-zt-paper/70">
                        MetaMask does not support EIP-7702 gasless on {chain?.name || 'this network'}.
                        <br />
                        <span className="text-zt-paper/50">
                          Batch mode will combine approve+swap into one transaction, but you will pay gas.
                        </span>
                        <br />
                        <span className="text-green-400 mt-1 block">
                          ✅ For TRUE gasless ($0 gas), use Gnosis Chain or Base.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Smart Account Status Indicator */}
              {isGaslessMode && isConnected && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    {trueGaslessSwap.isSmartAccount ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-semibold">🎉 TRUE GASLESS Ready!</span>
                      </>
                    ) : trueGaslessSwap.needsUpgrade ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400 font-semibold">Smart Account Not Enabled</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 text-zt-aqua animate-spin" />
                        <span className="text-sm text-zt-paper/70">Checking status...</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2 text-xs text-zt-paper/80">
                    <Info className="w-4 h-4 text-zt-aqua flex-shrink-0 mt-0.5" />
                    <div>
                      {trueGaslessSwap.isSmartAccount ? (
                        <>
                          <div className="font-semibold text-green-400 mb-1">🎉 TRUE GASLESS Available!</div>
                          <ul className="space-y-1 text-zt-paper/70">
                            <li>• <strong className="text-green-400">You pay $0 in gas fees!</strong></li>
                            <li>• Gas sponsored by ZeroToll paymaster</li>
                            <li>• Approve + Swap in ONE gasless transaction</li>
                            <li>• Same wallet address, enhanced capabilities</li>
                          </ul>
                          <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/30">
                            <span className="text-green-400 font-medium">✅ Gas: $0 (Sponsored)</span>
                            <span className="text-zt-paper/60 block">ZeroToll paymaster covers all gas costs!</span>
                          </div>
                        </>
                      ) : trueGaslessSwap.needsUpgrade ? (
                        <>
                          <div className="font-semibold text-yellow-400 mb-1">⚡ Smart Account Required for Gasless</div>
                          <ul className="space-y-1 text-zt-paper/70">
                            <li>• Enable Smart Account in MetaMask settings</li>
                            <li>• Or use MetaMask's upgrade prompt on first tx</li>
                            <li>• After upgrade, all transactions are FREE!</li>
                          </ul>
                          <div className="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                            <span className="text-yellow-400 font-medium">⚠️ Upgrade needed for gasless</span>
                            <span className="text-zt-paper/60 block">Enable Smart Account to unlock $0 gas fees!</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-zt-paper/60">Checking Smart Account status...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {!isGaslessMode && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-start gap-2 text-xs text-zt-paper/60">
                    <Info className="w-4 h-4 text-zt-aqua flex-shrink-0 mt-0.5" />
                    <div>
                      Standard mode: Approve and swap are separate transactions.
                      <span className="block mt-1 text-zt-aqua">Toggle batch mode ON to combine into one transaction!</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>}

          {/* ZeroToll Gasless (zTokens on Sepolia or Amoy) */}
          {(fromChain.id === 11155111 || fromChain.id === 80002) && intentGasless.isGaslessToken(tokenIn?.address) && (
            <div className="mb-6">
              <div className="glass p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="font-semibold text-green-400">⚡ ZeroToll Gasless Available!</div>
                      <div className="text-xs text-zt-paper/60">
                        {tokenIn?.symbol} supports ERC-2612 Permit - swap with ZERO gas!
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsZeroTollGasless(!isZeroTollGasless)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      isZeroTollGasless ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        isZeroTollGasless ? 'translate-x-7' : ''
                      }`}
                    />
                  </button>
                </div>
                
                {isZeroTollGasless && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-start gap-2 text-xs">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-zt-paper/80">
                        <div className="font-semibold text-green-400 mb-1">How it works:</div>
                        <ul className="space-y-1 text-zt-paper/70">
                          <li>1. Sign Permit (approves token transfer - no gas)</li>
                          <li>2. Sign Swap Intent (authorizes swap - no gas)</li>
                          <li>3. ZeroToll executes on-chain (we pay gas!)</li>
                        </ul>
                        <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/30">
                          <span className="text-green-400 font-medium">✅ You pay: $0 | ZeroToll pays: All gas</span>
                        </div>
                      </div>
                    </div>
                    {gaslessStatus && (
                      <div className="mt-2 p-2 bg-zt-aqua/10 rounded text-xs text-zt-aqua">
                        {gaslessStatus}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gas Payment Mode Selector - Only show in Relayer mode */}
          {isGaslessMode && !isZeroTollGasless && (
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

          {/* Fee Cap - Only show in Relayer mode */}
          {isGaslessMode && !isZeroTollGasless && (
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

          {/* Info Banners - Only show in Relayer mode with OUTPUT fee */}
          {isGaslessMode && !isZeroTollGasless && feeMode === 'OUTPUT' && isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output-fee + Unwrap:</strong> Fee skimmed from wrapped output ({wrappedOutputSymbol}) before unwrapping to native {tokenOut.symbol}.
              </div>
            </div>
          )}
          {isGaslessMode && !isZeroTollGasless && feeMode === 'OUTPUT' && !isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output Mode:</strong> Fee skimmed from output tokens on destination before crediting net amount.
              </div>
            </div>
          )}
          {isGaslessMode && !isZeroTollGasless && feeMode === 'INPUT' && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-violet/30">
              <Info className="w-5 h-5 text-zt-violet flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-violet">Input Mode:</strong> You'll sign Permit2 to lock fee from input token on source. Non-custodial, one-time approval.
              </div>
            </div>
          )}

          {/* Quote Info */}
          {quote && (
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

          {/* Success Message - Show for both traditional and ZeroToll gasless modes */}
          {txHash && (
            <div className="mb-6 glass p-4 rounded-xl flex items-center gap-3 border border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-zt-paper font-semibold">
                  {isZeroTollGasless ? '⚡ Gasless Swap Submitted!' : 'Swap Submitted!'}
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
            {/* Skip approval for ZeroToll gasless (uses ERC-2612 Permit) */}
            {needsApproval && !tokenIn.isNative && !isZeroTollGasless ? (
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
                  `Approve ${tokenIn.symbol}`
                )}
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={(loading || gaslessSwap.isLoading || intentGasless.isLoading) || (!quote && !isZeroTollGasless) || (needsApproval && !tokenIn.isNative && !isGaslessMode && !isZeroTollGasless) || (fromChain.id !== toChain.id)}
                className="flex-1 btn-primary hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="execute-swap-btn"
                title={
                  fromChain.id !== toChain.id ? 'Cross-chain swaps not yet supported' :
                  needsApproval && !tokenIn.isNative && !isGaslessMode && !isZeroTollGasless ? 'Please approve token first' : 
                  ''
                }
              >
                {(loading || gaslessSwap.isLoading || intentGasless.isLoading) ? (
                  <Loader2 className="inline w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {(isGaslessMode || isZeroTollGasless) && <Zap className="w-4 h-4" />}
                    {isZeroTollGasless ? '⚡ Execute Gasless (No Approval!)' : isGaslessMode ? 'Execute Gasless Swap' : 'Execute Swap'}
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
          
          {/* Approval Info Banner - Don't show for ZeroToll gasless (uses Permit) */}
          {needsApproval && !tokenIn.isNative && !isZeroTollGasless && (
            <div className="mt-4 glass p-4 rounded-xl flex items-start gap-3 border border-yellow-500/30">
              <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-yellow-400">Approval Required:</strong> You need to approve the RouterHub contract to spend your {tokenIn.symbol} before executing the swap.
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="glass p-4 rounded-xl">
              <p className="text-zt-paper/70 text-sm mb-1">Current Mode</p>
              <p className={`text-lg font-bold ${
                feeMode === 'INPUT' ? 'text-zt-violet' :
                feeMode === 'OUTPUT' ? 'text-zt-aqua' :
                feeMode === 'STABLE' ? 'text-blue-400' :
                'text-gray-400'
              }`}>{feeMode}</p>
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
              <span className="text-zt-paper/70">Fee Token:</span>
              <span className="text-zt-aqua font-semibold">
                {feeMode === 'INPUT' ? tokenIn.symbol : 
                 feeMode === 'OUTPUT' ? (isNativeOutput ? wrappedOutputSymbol : tokenOut.symbol) : 
                 feeMode === 'STABLE' ? 'USDC' : 'POL/ETH'}
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
