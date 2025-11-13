import type { AppProps } from 'next/app';
// import { PrivyProvider } from '@privy-io/react-auth';
import '../styles/globals.css';

function MycelixMusicApp({ Component, pageProps }: AppProps) {
  // Temporarily disabled Privy for UI demo
  // TODO: Add NEXT_PUBLIC_PRIVY_APP_ID to .env.local
  return (
    // <PrivyProvider
    //   appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'test-app-id'}
    //   config={{
    //     appearance: {
    //       theme: 'dark',
    //       accentColor: '#8B5CF6',
    //     },
    //     loginMethods: ['wallet', 'email'],
    //   }}
    // >
      <Component {...pageProps} />
    // </PrivyProvider>
  );
}

export default MycelixMusicApp;
