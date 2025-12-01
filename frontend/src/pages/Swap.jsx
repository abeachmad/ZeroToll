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
  { id: 80002, name: 'Polygon Amoy', logo: '🔷', tokens: amoyTokens.tokens },
  { id: 11155111, name: 'Ethereum Sepolia', logo: '⭐', tokens: sepoliaTokens.tokens },
  { id: 421614, name: 'Arbitrum Sepolia', logo: '🔵', tokens: arbitrumSepoliaTokens.tokens },
  { id: 11155420, name: 'Optimism Sepolia', logo: '🔴', tokens: optimismSepoliaTokens.tokens }
];

const feeModes = [
  { id: 'NATIVE', label: 'Native (POL/ETH)', desc: 'Pay gas in native token' },
  { id: 'INPUT', label: 'Use Input Token', desc: 'Deduct fee from input on source' },
  { id: 'OUTPUT', label: 'Use Output Token', desc: 'Skim fee from output on dest' },
  { id: 'STABLE', label: 'Stable', desc: 'Pay in stablecoins' }
];

const Swap = () => {
  const navigate = useNavigate();
  const { address, isConnected, chain } = useAccount();
  
  const [fromChain, setFromChain] = useState(chains[0]);
  const [toChain, setToChain] = useState(chains[1]);
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
  const gaslessSwap = useGaslessSwap();
  const trueGaslessSwap = useTrueGaslessSwap();
  
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
  const { switchChain } = useSwitchChain();
  
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
  
  // AUTO-SWITCH NETWORK when chain mismatch detected
  useEffect(() => {
    if (!isConnected || !chain || !fromChain) {
      setShowNetworkWarning(false);
      return;
    }
    
    // Check if wallet network matches selected source chain
    if (chain.id !== fromChain.id) {
      setShowNetworkWarning(true);
      
      // Auto-trigger network switch
      const autoSwitch = async () => {
        try {
          toast.info(`🔁 Switching to ${fromChain.name}... Please approve in MetaMask`);
          
          if (switchChain) {
            await switchChain({ chainId: fromChain.id });
          } else if (window.ethereum) {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${fromChain.id.toString(16)}` }]
            });
          }
          
          toast.success(`✅ Network switched to ${fromChain.name}!`);
          setShowNetworkWarning(false);
        } catch (err) {
          console.error('Auto network switch failed:', err);
          if (err.code === 4001) {
            toast.error('❌ Network switch rejected. Please switch manually in MetaMask.');
          } else {
            toast.error('⚠️ Failed to switch network. Please switch manually in MetaMask.');
          }
        }
      };
      
      // Trigger auto-switch after short delay
      const timer = setTimeout(autoSwitch, 500);
      return () => clearTimeout(timer);
    } else {
      setShowNetworkWarning(false);
    }
  }, [chain, fromChain, isConnected, switchChain]);
  
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

      // If gasless mode, use TRUE gasless approval via Pimlico paymaster
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
          // Use TRUE gasless approval via Pimlico paymaster
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

  // TRUE GASLESS execution using Pimlico paymaster - USER PAYS $0 GAS!
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
      console.log('📤 Executing TRUE GASLESS batch via Pimlico paymaster');
      
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
    try {
      // Check TRUE gasless availability first
      const trueGaslessAvailability = await trueGaslessSwap.checkAvailability();
      console.log('🔍 TRUE Gasless availability:', trueGaslessAvailability);
      
      // If TRUE gasless is available and enabled, use it!
      if (isTrueGasless && trueGaslessAvailability.available && trueGaslessAvailability.gasless) {
        console.log('🎉 Using TRUE GASLESS (Pimlico paymaster)');
        return await handleTrueGaslessExecute();
      }
      
      // Fall back to batch mode (still requires gas)
      const availability = await gaslessSwap.checkAvailability();
      console.log('🔍 Batch mode availability:', availability);
      
      if (!availability.available) {
        toast.error(`Batch mode not available: ${availability.reason}`);
        return;
      }

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
      
      // Show appropriate message based on Smart Account status
      if (availability.isSmartAccount) {
        toast.info(`✅ Smart Account active - executing batch swap on ${availability.chain}...`);
      } else {
        toast.info(`⚡ First time on ${availability.chain} - MetaMask will prompt to enable Smart Account...`);
      }
      
      const decimals = tokenIn.decimals || 6;
      const amountWei = parseUnits(amountIn, decimals);
      // Use 50% of quoted amount as minOut to account for price differences
      // between backend (Pyth) and on-chain oracle (can differ 30%+ on testnet)
      const minAmountOut = parseUnits((parseFloat(amountOut) * 0.50).toString(), tokenOut.decimals || 6);
      
      // Build swap callData using ethers
      const routerHubInterface = new ethers.Interface([
        "function executeRoute(tuple(address user, address tokenIn, uint256 amtIn, address tokenOut, uint256 minOut, uint64 dstChainId, uint64 deadline, address feeToken, uint8 feeMode, uint256 feeCapToken, bytes routeHint, uint256 nonce) intent, address adapter, bytes routeData) external returns (uint256)"
      ]);
      
      // Build intent struct
      const intent = {
        user: address,
        tokenIn: tokenIn.address,
        amtIn: amountWei,
        tokenOut: tokenOut.address,
        minOut: minAmountOut,
        dstChainId: toChain.id,
        deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        feeToken: tokenIn.address,
        feeMode: 1, // TOKEN_INPUT_SOURCE
        feeCapToken: parseUnits(feeCap, 18),
        routeHint: '0x',
        nonce: BigInt(Date.now())
      };

      console.log('📋 Intent struct:', {
        user: intent.user,
        tokenIn: intent.tokenIn,
        amtIn: intent.amtIn.toString(),
        tokenOut: intent.tokenOut,
        minOut: intent.minOut.toString(),
        dstChainId: intent.dstChainId,
      });
      
      // Get adapter address from config
      const mockAdapter = fromChain.id === 80002 
        ? '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1'  // Amoy MockDEXAdapter
        : '0x86D1AA2228F3ce649d415F19fC71134264D0E84B'; // Sepolia MockDEXAdapter
      
      // Build routeData - this is the encoded call to the adapter's swap function
      // MockDEXAdapter.swap(tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline)
      const adapterInterface = new ethers.Interface([
        "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) external payable returns (uint256 amountOut)"
      ]);
      
      const routeData = adapterInterface.encodeFunctionData("swap", [
        tokenIn.address,           // tokenIn
        tokenOut.address,          // tokenOut
        amountWei,                 // amountIn
        minAmountOut,              // minAmountOut
        routerHubAddress,          // recipient (RouterHub receives output, then transfers to user)
        intent.deadline            // deadline
      ]);

      console.log('📋 Route data for adapter:', {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amountWei.toString(),
        minAmountOut: minAmountOut.toString(),
        recipient: routerHubAddress,
        deadline: intent.deadline
      });
      
      const swapCallData = routerHubInterface.encodeFunctionData("executeRoute", [
        intent,
        mockAdapter,
        routeData
      ]);
      
      // Use BATCH execution (approve + swap in one transaction) - the main benefit of EIP-7702!
      // This combines approval and swap into a single atomic transaction
      if (needsApproval && !tokenIn.isNative) {
        console.log('📦 Using batch execution (approve + swap)');
        await gaslessSwap.executeBatch({
          tokenAddress: tokenIn.address,
          spender: routerHubAddress,
          amount: amountWei.toString(),
          routerHub: routerHubAddress,
          swapCallData,
          targetChainId: fromChain.id
        });
        toast.success('🎉 Batch transaction submitted (approve + swap)!');
      } else {
        // No approval needed, just execute swap
        console.log('📤 Executing swap only (already approved)');
        await gaslessSwap.executeSwap({
          routerHub: routerHubAddress,
          swapCallData,
          targetChainId: fromChain.id
        });
        toast.success('🎉 Swap submitted! Waiting for confirmation...');
      }
      
    } catch (error) {
      console.error('Gasless swap error:', error);
      toast.error(error.message || 'Gasless swap failed');
    }
  };

  const handleExecute = async () => {
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
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="glass-strong p-8 rounded-3xl">
          <h1 className="text-3xl font-bold mb-2 text-zt-paper">Gasless Cross-Chain Swap</h1>
          <p className="text-zt-paper/60 mb-8">Pay fees in any token you swap—use input, skim from output (even native via wrapped), or stick to native gas. Fee capped on-chain, unused refunded.</p>

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
                  onChange={(e) => setFromChain(chains.find(c => c.id === parseInt(e.target.value)))}
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
                >
                  {fromChain.tokens.map(token => (
                    <option key={token.symbol} value={token.symbol} className="bg-zt-ink text-zt-paper">{token.logo} {token.symbol}</option>
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
          </div>

          <div className="flex justify-center my-4">
            <button
              onClick={() => {
                // Swap chains and tokens
                const tempChain = fromChain;
                const tempToken = tokenIn;
                setFromChain(toChain);
                setToChain(tempChain);
                setTokenIn(tokenOut);
                setTokenOut(tempToken);
                setAmountOut('');
                setQuote(null);
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
                >
                  {toChain.tokens.map(token => (
                    <option key={token.symbol} value={token.symbol} className="bg-zt-ink text-zt-paper">{token.logo} {token.symbol}</option>
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

          {/* TRUE Gasless Mode Toggle (EIP-7702 + Pimlico Paymaster) */}
          <div className="mb-6">
            <div className="glass p-4 rounded-xl border border-zt-aqua/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-zt-aqua" />
                  <div>
                    <div className="font-semibold text-zt-paper">
                      {trueGaslessSwap.isSmartAccount ? '🎉 TRUE Gasless Mode' : 'Batch Mode (EIP-7702)'}
                    </div>
                    <div className="text-xs text-zt-paper/60">
                      {trueGaslessSwap.isSmartAccount 
                        ? 'Pay $0 in gas fees! Sponsored by Pimlico' 
                        : 'Combine approve + swap in one transaction'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsGaslessMode(!isGaslessMode)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    isGaslessMode ? 'bg-zt-aqua' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      isGaslessMode ? 'translate-x-7' : ''
                    }`}
                  />
                </button>
              </div>
              
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
                            <li>• Gas sponsored by Pimlico paymaster</li>
                            <li>• Approve + Swap in ONE gasless transaction</li>
                            <li>• Same wallet address, enhanced capabilities</li>
                          </ul>
                          <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/30">
                            <span className="text-green-400 font-medium">✅ Gas: $0 (Sponsored)</span>
                            <span className="text-zt-paper/60 block">Pimlico paymaster covers all gas costs!</span>
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
          </div>          {/* Gas Payment Mode Selector */}
          {!isGaslessMode && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zt-paper/70 mb-3">
              Gas Payment Mode
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

          {/* Fee Cap - Only show in non-gasless mode */}
          {!isGaslessMode && (
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

          {/* Info Banners */}
          {!isGaslessMode && feeMode === 'OUTPUT' && isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output-fee + Unwrap:</strong> Fee skimmed from wrapped output ({wrappedOutputSymbol}) before unwrapping to native {tokenOut.symbol}.
              </div>
            </div>
          )}
          {!isGaslessMode && feeMode === 'OUTPUT' && !isNativeOutput && (
            <div className="mb-6 glass p-4 rounded-xl flex items-start gap-3 border border-zt-aqua/30">
              <Info className="w-5 h-5 text-zt-aqua flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zt-paper/80">
                <strong className="text-zt-aqua">Output Mode:</strong> Fee skimmed from output tokens on destination before crediting net amount.
              </div>
            </div>
          )}
          {feeMode === 'INPUT' && (
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

          {/* Success Message */}
          {txHash && !isGaslessMode && (
            <div className="mb-6 glass p-4 rounded-xl flex items-center gap-3 border border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-zt-paper font-semibold">Swap Submitted!</p>
                <p className="text-zt-paper/70 text-sm font-mono mb-2">{txHash.slice(0, 20)}...</p>
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
            {needsApproval && !tokenIn.isNative ? (
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
                disabled={(loading || gaslessSwap.isLoading) || !quote || (needsApproval && !tokenIn.isNative && !isGaslessMode) || (fromChain.id !== toChain.id)}
                className="flex-1 btn-primary hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="execute-swap-btn"
                title={
                  fromChain.id !== toChain.id ? 'Cross-chain swaps not yet supported' :
                  needsApproval && !tokenIn.isNative && !isGaslessMode ? 'Please approve token first' : 
                  ''
                }
              >
                {(loading || gaslessSwap.isLoading) ? (
                  <Loader2 className="inline w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isGaslessMode && <Zap className="w-4 h-4" />}
                    {isGaslessMode ? 'Execute Gasless Swap' : 'Execute Swap'}
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
          
          {/* Approval Info Banner */}
          {needsApproval && !tokenIn.isNative && (
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
