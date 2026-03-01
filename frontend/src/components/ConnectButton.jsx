import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Wallet, ChevronDown, LogOut, Network } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Modal from './ui/Modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const ConnectButton = () => {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const handleConnect = (connector) => {
    try {
      connect({ connector });
      setShowModal(false);
    } catch (error) {
      console.error('Connect error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
    }
  };

  const handleSwitchNetwork = async (chainId) => {
    try {
      toast({
        title: "Switching Network",
        description: "Please approve in MetaMask...",
      });
      await switchChain({ chainId });
      toast({
        title: "Network Switched",
        description: `Connected to ${chainId === 80002 ? 'Polygon Amoy' : 'Ethereum Sepolia'}`,
      });
    } catch (error) {
      console.error('Switch network error:', error);
      toast({
        title: "Network Switch Failed",
        description: error.message || "Please switch network manually in MetaMask",
        variant: "destructive"
      });
    }
  };

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
          data-testid="connect-wallet-btn"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>

        <Modal open={showModal} onClose={() => setShowModal(false)}>
          <h2 className="text-2xl font-bold text-zt-paper mb-6">Connect Wallet</h2>
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector)}
                className="w-full glass p-4 rounded-xl hover:border-zt-violet border border-white/10 transition-all text-left flex items-center gap-3"
                data-testid={`connector-${connector.id}`}
              >
                <Wallet className="w-5 h-5 text-zt-aqua" />
                <div>
                  <p className="text-zt-paper font-semibold">{connector.name}</p>
                  <p className="text-zt-paper/50 text-xs">
                    {connector.id === 'injected' ? 'MetaMask, OKX, Phantom, Trust' : 'Scan QR with mobile wallet'}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="mt-6 w-full btn-secondary"
          >
            Cancel
          </button>
        </Modal>
      </>
    );
  }

  const chainName = chain?.id === 80002 ? 'Amoy' : chain?.id === 11155111 ? 'Sepolia' : 'Unknown';
  const isWrongNetwork = chain?.id !== 80002 && chain?.id !== 11155111;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-xl glass border transition-all ${
              isWrongNetwork ? 'border-red-500/50' : 'border-white/10 hover:border-zt-aqua/50'
            }`}
            data-testid="account-button"
          >
            <div className={`w-2 h-2 rounded-full ${isWrongNetwork ? 'bg-red-500' : 'bg-green-400'}`}></div>
            <span className="text-zt-paper font-mono text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${isWrongNetwork ? 'bg-red-500/20 text-red-400' : 'bg-zt-violet/20 text-zt-violet'}`}>
              {chainName}
            </span>
            <ChevronDown className="w-4 h-4 text-zt-paper/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 glass-strong border-white/10 z-[20002]" align="end">
          <div className="p-4 border-b border-white/10">
            <p className="text-zt-paper/50 text-xs mb-1">Connected Address</p>
            <p className="text-zt-paper font-mono text-sm">{address}</p>
          </div>
          <div className="p-2">
            <p className="text-zt-paper/50 text-xs px-2 mb-2">Switch Network</p>
            <DropdownMenuItem
              onClick={() => handleSwitchNetwork(80002)}
              className={`cursor-pointer ${
                chain?.id === 80002 ? 'bg-zt-violet/20' : ''
              }`}
            >
              <Network className="w-4 h-4 text-zt-violet" />
              <span className="text-zt-paper">Polygon Amoy</span>
              {chain?.id === 80002 && <span className="ml-auto text-zt-aqua text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSwitchNetwork(11155111)}
              className={`cursor-pointer ${
                chain?.id === 11155111 ? 'bg-zt-violet/20' : ''
              }`}
            >
              <Network className="w-4 h-4 text-zt-aqua" />
              <span className="text-zt-paper">Ethereum Sepolia</span>
              {chain?.id === 11155111 && <span className="ml-auto text-zt-aqua text-xs">✓</span>}
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="bg-white/10" />
          <div className="p-2">
            <DropdownMenuItem
              onClick={() => disconnect()}
              className="cursor-pointer text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {isWrongNetwork && (
        <div className="fixed bottom-4 right-4 w-80 glass-strong p-4 rounded-xl border border-red-500/50 shadow-2xl animate-slideInRight z-[100]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-red-400 text-xl">⚠️</span>
            </div>
            <div className="flex-1">
              <p className="text-red-400 font-semibold text-sm mb-1">Wrong Network Detected</p>
              <p className="text-zt-paper/70 text-xs mb-3">
                Please switch to Polygon Amoy or Ethereum Sepolia to use ZeroToll
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSwitchNetwork(80002)}
                  className="flex-1 bg-zt-violet/20 hover:bg-zt-violet/30 text-zt-violet px-3 py-2 rounded-lg text-xs font-medium transition-all"
                >
                  Switch to Amoy
                </button>
                <button
                  onClick={() => handleSwitchNetwork(11155111)}
                  className="flex-1 bg-zt-aqua/20 hover:bg-zt-aqua/30 text-zt-aqua px-3 py-2 rounded-lg text-xs font-medium transition-all"
                >
                  Switch to Sepolia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConnectButton;
