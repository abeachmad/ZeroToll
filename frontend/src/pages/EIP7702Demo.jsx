/**
 * EIP-7702 Demo Page
 * 
 * Demonstrates EIP-7702 gasless swaps with 50% gas savings
 */

import React from 'react';
import { EIP7702SwapCard } from '../components/EIP7702SwapCard';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function EIP7702Demo() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>🚀 ZeroToll EIP-7702 Integration</h1>
        <p style={styles.subtitle}>Gasless Swaps with 50% Gas Savings</p>
      </header>

      <div style={styles.walletSection}>
        {!isConnected ? (
          <div>
            <p>Connect your wallet to start</p>
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect({ connector })}
                style={styles.connectButton}
              >
                Connect {connector.name}
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.walletInfo}>
            <p><strong>Connected:</strong> {address?.slice(0, 10)}...{address?.slice(-8)}</p>
            <p><strong>Chain:</strong> {chainId === 80002 ? 'Polygon Amoy' : chainId === 11155111 ? 'Ethereum Sepolia' : `Chain ${chainId}`}</p>
            <button onClick={() => disconnect()} style={styles.disconnectButton}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      <EIP7702SwapCard />

      <div style={styles.comparison}>
        <h2>📊 Gas Savings Comparison</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Method</th>
              <th style={styles.th}>Gas Cost</th>
              <th style={styles.th}>Savings</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>ERC-4337 (Phase 2)</td>
              <td style={styles.td}>~300,000 gas</td>
              <td style={styles.td}>Baseline</td>
              <td style={styles.td}>✅ Live</td>
            </tr>
            <tr style={styles.highlightRow}>
              <td style={styles.td}><strong>EIP-7702 (Phase 3A)</strong></td>
              <td style={styles.td}><strong>~150,000 gas</strong></td>
              <td style={styles.td}><strong style={{color: '#4CAF50'}}>50% cheaper</strong></td>
              <td style={styles.td}>✅ Live</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={styles.features}>
        <h2>✨ EIP-7702 Features</h2>
        <div style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <h3>⚡ 50% Gas Savings</h3>
            <p>No EntryPoint overhead means 50% less gas than ERC-4337</p>
          </div>
          <div style={styles.featureCard}>
            <h3>🔒 Trustless Fees</h3>
            <p>Fees calculated on-chain via Pyth oracle, capped at 1%</p>
          </div>
          <div style={styles.featureCard}>
            <h3>💰 Native Output</h3>
            <p>Automatically unwraps WETH/WPOL to native tokens</p>
          </div>
          <div style={styles.featureCard}>
            <h3>🛡️ No Frontrunning</h3>
            <p>Atomic execution prevents MEV attacks</p>
          </div>
          <div style={styles.featureCard}>
            <h3>👛 Any Wallet</h3>
            <p>Works with any EOA - no smart wallet needed</p>
          </div>
          <div style={styles.featureCard}>
            <h3>🌐 Multi-Chain</h3>
            <p>Deployed on Polygon Amoy and Ethereum Sepolia</p>
          </div>
        </div>
      </div>

      <div style={styles.contracts}>
        <h2>📝 Deployed Contracts</h2>
        <div style={styles.contractList}>
          <div style={styles.contractItem}>
            <h4>Polygon Amoy</h4>
            <p><strong>ZeroTollDelegate:</strong></p>
            <a 
              href="https://amoy.polygonscan.com/address/0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C →
            </a>
          </div>
          <div style={styles.contractItem}>
            <h4>Ethereum Sepolia</h4>
            <p><strong>ZeroTollDelegate:</strong></p>
            <a 
              href="https://sepolia.etherscan.io/address/0xcFE005B2E0013e0FF8cB0569d9b103094d423B36"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              0xcFE005B2E0013e0FF8cB0569d9b103094d423B36 →
            </a>
          </div>
        </div>
      </div>

      <footer style={styles.footer}>
        <p>Built with ❤️ by ZeroToll Team</p>
        <p>First DEX with EIP-7702 Integration</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    paddingTop: '20px'
  },
  subtitle: {
    fontSize: '18px',
    color: '#666',
    marginTop: '10px'
  },
  walletSection: {
    textAlign: 'center',
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px'
  },
  walletInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center'
  },
  connectButton: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    margin: '5px'
  },
  disconnectButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  comparison: {
    marginTop: '60px',
    textAlign: 'center'
  },
  table: {
    width: '100%',
    maxWidth: '800px',
    margin: '20px auto',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  th: {
    padding: '16px',
    backgroundColor: '#1976d2',
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'left'
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid #ddd'
  },
  highlightRow: {
    backgroundColor: '#e8f5e9'
  },
  features: {
    marginTop: '60px',
    textAlign: 'center'
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '30px'
  },
  featureCard: {
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'left'
  },
  contracts: {
    marginTop: '60px',
    textAlign: 'center'
  },
  contractList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
    marginTop: '30px'
  },
  contractItem: {
    padding: '24px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px',
    textAlign: 'left'
  },
  link: {
    color: '#1976d2',
    textDecoration: 'none',
    wordBreak: 'break-all'
  },
  footer: {
    marginTop: '80px',
    paddingTop: '40px',
    borderTop: '1px solid #ddd',
    textAlign: 'center',
    color: '#666'
  }
};
