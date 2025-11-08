import React, { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import contracts from '../config/contracts.json';

// FeeVault4626 ABI (minimal for UI)
const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonReentrant',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonReentrant',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'getVaultMetrics',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'tvl', type: 'uint256' },
      { name: 'apr', type: 'uint256' },
      { name: 'totalShares', type: 'uint256' },
      { name: 'sharePrice', type: 'uint256' },
    ],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

import ConnectButton from '../components/ConnectButton';
import vaultsConfig from '../config/vaults.json';

// USDC addresses per chain - Load from config
const USDC_ADDRESSES = vaultsConfig.USDC;

export default function Vault() {
  const { address, chain } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState('deposit');
  const [txStatus, setTxStatus] = useState(null);

  // Get contract addresses
  const chainKey = chain?.id === 11155111 ? 'sepolia' :
                   chain?.id === 80002 ? 'amoy' :
                   chain?.id === 421614 ? 'arbitrumSepolia' :
                   chain?.id === 11155420 ? 'optimismSepolia' : null;

  const vaultAddress = chainKey ? contracts[chainKey]?.feeVault : null;
  const usdcAddress = chain?.id ? USDC_ADDRESSES[chain.id] : null;

  // Read vault metrics
  const { data: vaultMetrics, refetch: refetchMetrics } = useContractRead({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getVaultMetrics',
    watch: true,
    enabled: !!vaultAddress,
  });

  // Read user's vault shares
  const { data: userShares, refetch: refetchShares } = useContractRead({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: [address],
    watch: true,
    enabled: !!vaultAddress && !!address,
  });

  // Read user's USDC balance
  const { data: usdcBalance, refetch: refetchUSDC } = useContractRead({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    watch: true,
    enabled: !!usdcAddress && !!address,
  });

  // Read USDC allowance
  const { data: usdcAllowance } = useContractRead({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address, vaultAddress],
    enabled: !!usdcAddress && !!vaultAddress && !!address,
  });

  // Convert user shares to assets
  const { data: userAssets } = useContractRead({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: [userShares || 0n],
    enabled: !!vaultAddress && !!userShares && userShares > 0n,
  });

  // Approve USDC
  const { write: approveUSDC, data: approveData } = useContractWrite({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  const { isLoading: isApproving } = useWaitForTransaction({
    hash: approveData?.hash,
    onSuccess: () => {
      setTxStatus({ type: 'success', message: 'USDC approved successfully!' });
      setTimeout(() => setTxStatus(null), 3000);
    },
  });

  // Deposit to vault
  const { write: depositVault, data: depositData } = useContractWrite({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'deposit',
  });

  const { isLoading: isDepositing } = useWaitForTransaction({
    hash: depositData?.hash,
    onSuccess: () => {
      setTxStatus({ type: 'success', message: 'Deposit successful! You are now earning yield.' });
      setDepositAmount('');
      refetchMetrics();
      refetchShares();
      refetchUSDC();
      setTimeout(() => setTxStatus(null), 5000);
    },
  });

  // Withdraw from vault
  const { write: withdrawVault, data: withdrawData } = useContractWrite({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'withdraw',
  });

  const { isLoading: isWithdrawing } = useWaitForTransaction({
    hash: withdrawData?.hash,
    onSuccess: () => {
      setTxStatus({ type: 'success', message: 'Withdrawal successful!' });
      setWithdrawAmount('');
      refetchMetrics();
      refetchShares();
      refetchUSDC();
      setTimeout(() => setTxStatus(null), 5000);
    },
  });

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setTxStatus({ type: 'error', message: 'Please enter a valid amount' });
      return;
    }

    const amount = parseUnits(depositAmount, 6); // USDC has 6 decimals

    // Check if approval needed
    if (!usdcAllowance || usdcAllowance < amount) {
      approveUSDC({
        args: [vaultAddress, amount * 2n], // Approve 2x for future deposits
      });
    } else {
      depositVault({
        args: [amount, address],
      });
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setTxStatus({ type: 'error', message: 'Please enter a valid amount' });
      return;
    }

    const amount = parseUnits(withdrawAmount, 6);

    withdrawVault({
      args: [amount, address, address],
    });
  };

  // Parse metrics
  const tvl = vaultMetrics ? formatUnits(vaultMetrics[0], 6) : '0';
  const apr = vaultMetrics ? Number(vaultMetrics[1]) / 100 : 0; // Convert bps to percentage
  const userBalance = userAssets ? formatUnits(userAssets, 6) : '0';
  const usdcBal = usdcBalance ? formatUnits(usdcBalance, 6) : '0';

  if (!vaultAddress || vaultAddress === 'TBD_AFTER_DEPLOYMENT') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>
            ⚠️ Vault not deployed on this network yet. Please deploy Wave-3 contracts first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">ZeroToll Fee Vault</h1>

      {/* Vault Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-600">Total Value Locked</h3>
          <p className="text-3xl font-bold text-blue-600">${Number(tvl).toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">USDC</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-600">Current APR</h3>
          <p className="text-3xl font-bold text-green-600">{apr.toFixed(2)}%</p>
          <p className="text-sm text-gray-500 mt-1">Annualized</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-600">Your Balance</h3>
          <p className="text-3xl font-bold text-purple-600">${Number(userBalance).toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">USDC deposited</p>
        </Card>
      </div>

      {/* Deposit/Withdraw Interface */}
      <Card className="p-6">
        <div className="flex border-b mb-6">
          <button
            className={`px-6 py-3 font-semibold ${activeTab === 'deposit' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('deposit')}
          >
            Deposit
          </button>
          <button
            className={`px-6 py-3 font-semibold ${activeTab === 'withdraw' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('withdraw')}
          >
            Withdraw
          </button>
        </div>

        {txStatus && (
          <Alert className={`mb-4 ${txStatus.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
            <AlertDescription>{txStatus.message}</AlertDescription>
          </Alert>
        )}

        {activeTab === 'deposit' ? (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Deposit Amount (USDC)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Available: {Number(usdcBal).toLocaleString()} USDC
              </p>
            </div>

            <Button
              onClick={handleDeposit}
              disabled={isApproving || isDepositing || !address}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isApproving ? 'Approving...' : isDepositing ? 'Depositing...' : 'Deposit'}
            </Button>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold mb-2">How it works:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Deposit USDC to earn protocol fee yield</li>
                <li>• LPs receive 60% of all protocol fees</li>
                <li>• Withdraw anytime with no lock period</li>
                <li>• APR updates in real-time based on protocol usage</li>
              </ul>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Withdraw Amount (USDC)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Deposited: {Number(userBalance).toLocaleString()} USDC
              </p>
            </div>

            <Button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !address || Number(userBalance) === 0}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
            </Button>

            <div className="mt-6 p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold mb-2">Instant Withdrawals:</h4>
              <p className="text-sm text-gray-700">
                No lock period - withdraw your USDC plus earned yield anytime.
                Your share of protocol fees continues to accrue until withdrawal.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
