import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Wallet, ChevronDown, LogOut, Network } from 'lucide-react';

const ConnectButton = () => {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleConnect = (connector) => {
    connect({ connector });
    setShowModal(false);
  };

  const handleSwitchNetwork = (chainId) => {
    switchChain({ chainId });
    setShowMenu(false);
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

        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="glass-strong p-8 rounded-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
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
            </div>
          </div>
        )}
      </>
    );
  }

  const chainName = chain?.id === 80002 ? 'Amoy' : chain?.id === 11155111 ? 'Sepolia' : 'Unknown';
  const isWrongNetwork = chain?.id !== 80002 && chain?.id !== 11155111;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
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

      {showMenu && (
        <div className="absolute right-0 mt-2 w-64 glass-strong rounded-xl border border-white/10 overflow-hidden z-50">
          <div className="p-4 border-b border-white/10">
            <p className="text-zt-paper/50 text-xs mb-1">Connected Address</p>
            <p className="text-zt-paper font-mono text-sm">{address}</p>
          </div>
          
          <div className="p-2">
            <p className="text-zt-paper/50 text-xs px-2 mb-2">Switch Network</p>
            <button
              onClick={() => handleSwitchNetwork(80002)}
              className={`w-full p-3 rounded-lg text-left hover:bg-white/5 transition-colors flex items-center gap-2 ${
                chain?.id === 80002 ? 'bg-zt-violet/20' : ''
              }`}
            >
              <Network className="w-4 h-4 text-zt-violet" />
              <span className="text-zt-paper">Polygon Amoy</span>
              {chain?.id === 80002 && <span className="ml-auto text-zt-aqua text-xs">✓</span>}
            </button>
            <button
              onClick={() => handleSwitchNetwork(11155111)}
              className={`w-full p-3 rounded-lg text-left hover:bg-white/5 transition-colors flex items-center gap-2 ${
                chain?.id === 11155111 ? 'bg-zt-violet/20' : ''
              }`}
            >
              <Network className="w-4 h-4 text-zt-aqua" />
              <span className="text-zt-paper">Ethereum Sepolia</span>
              {chain?.id === 11155111 && <span className="ml-auto text-zt-aqua text-xs">✓</span>}
            </button>
          </div>

          <div className="p-2 border-t border-white/10">
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full p-3 rounded-lg text-left hover:bg-red-500/10 transition-colors flex items-center gap-2 text-red-400"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}

      {isWrongNetwork && (
        <div className="absolute top-full right-0 mt-2 w-64 glass-strong p-4 rounded-xl border border-red-500/50">
          <p className="text-red-400 text-sm mb-2">⚠️ Wrong Network</p>
          <p className="text-zt-paper/70 text-xs mb-3">Please switch to Polygon Amoy or Ethereum Sepolia</p>
          <button
            onClick={() => handleSwitchNetwork(80002)}
            className="w-full btn-primary text-sm"
          >
            Switch to Amoy
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectButton;
