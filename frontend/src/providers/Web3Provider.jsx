import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { polygonAmoy, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

const config = createConfig({
  // Sepolia first - wagmi uses first chain as default
  chains: [sepolia, polygonAmoy],
  connectors: [
    injected({ 
      shimDisconnect: true,
      // Don't auto-switch chains
      target: 'metaMask'
    }),
    walletConnect({ projectId, showQrModal: true })
  ],
  transports: {
    [sepolia.id]: http(process.env.REACT_APP_RPC_SEPOLIA),
    [polygonAmoy.id]: http(process.env.REACT_APP_RPC_AMOY)
  },
  // Disable sync with URL to prevent chain switching issues
  syncConnectedChain: true
});

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config };
