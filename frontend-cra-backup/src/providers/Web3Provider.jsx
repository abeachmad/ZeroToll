import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { polygonAmoy, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

const config = createConfig({
  chains: [polygonAmoy, sepolia],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({ projectId, showQrModal: true })
  ],
  transports: {
    [polygonAmoy.id]: http(process.env.REACT_APP_RPC_AMOY),
    [sepolia.id]: http(process.env.REACT_APP_RPC_SEPOLIA)
  }
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
