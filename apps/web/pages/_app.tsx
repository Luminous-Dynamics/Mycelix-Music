import type { AppProps } from 'next/app';
import { PrivyProvider } from '@privy-io/react-auth';
import '../styles/globals.css';

function MycelixMusicApp({ Component, pageProps }: AppProps) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'clzxv89ey0089l80fyukufq9a'}
      config={{
        // Visual customization
        appearance: {
          theme: 'dark',
          accentColor: '#8B5CF6', // Purple to match Mycelix branding
          logo: 'https://music.mycelix.net/logo.png',
          walletList: ['metamask', 'coinbase_wallet', 'wallet_connect', 'rainbow', 'phantom'],
        },

        // Login methods - show all wallet options
        loginMethods: ['wallet', 'email', 'sms', 'google', 'discord'],

        // Wallet configuration
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // Create embedded wallet for social logins
          requireUserPasswordOnCreate: false,
        },

        // Supported chains
        supportedChains: [
          {
            id: 1,
            name: 'Ethereum'
          },
          {
            id: 100,
            name: 'Gnosis Chain' // For production (lower fees)
          },
          {
            id: 31337,
            name: 'Localhost' // For development
          },
          // TODO: Add Flow blockchain support once Privy adds it
          // {
          //   id: 545,
          //   name: 'Flow Mainnet'
          // },
        ],

        // Default chain
        defaultChain: process.env.NEXT_PUBLIC_CHAIN_ID === '31337'
          ? { id: 31337, name: 'Localhost' }
          : { id: 100, name: 'Gnosis Chain' },
      }}
    >
      <Component {...pageProps} />
    </PrivyProvider>
  );
}

export default MycelixMusicApp;
