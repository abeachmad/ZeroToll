import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { polygonAmoy, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

const walletConnectProjectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID?.trim();
const hasWalletConnectProjectId =
  walletConnectProjectId && walletConnectProjectId !== 'demo-project-id';

const connectors = [
  injected({
    shimDisconnect: true,
    // Don't auto-switch chains
    target: 'metaMask'
  })
];

if (hasWalletConnectProjectId) {
  connectors.push(
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true
    })
  );
} else {
  console.info(
    'WalletConnect disabled: set REACT_APP_WALLETCONNECT_PROJECT_ID to enable it.'
  );
}

const config = createConfig({
  // Sepolia first - wagmi uses first chain as default
  chains: [sepolia, polygonAmoy],
  connectors,
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
