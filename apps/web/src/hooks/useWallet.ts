import { useState, useEffect } from 'react';

/**
 * Mock wallet hook for UI demo
 * TODO: Replace with real Privy integration
 */

interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connecting: false,
  });

  const connect = async () => {
    setState((prev) => ({ ...prev, connecting: true }));

    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock wallet address
    setState({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      connected: true,
      connecting: false,
    });
  };

  const disconnect = () => {
    setState({
      address: null,
      connected: false,
      connecting: false,
    });
  };

  return {
    address: state.address,
    connected: state.connected,
    connecting: state.connecting,
    connect,
    disconnect,
  };
}
