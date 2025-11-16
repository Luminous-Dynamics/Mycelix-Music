/**
 * Subscribe Page
 * Browse and select subscription tiers
 */

import React from 'react';
import { useAccount } from 'wagmi';
import { SubscriptionPlans } from '../components/subscriptions';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function SubscribePage() {
  const { address } = useAccount();
  const router = useRouter();

  const handleSubscribeSuccess = () => {
    // Redirect to manage subscription page after successful subscription
    router.push('/subscription/manage');
  };

  return (
    <>
      <Head>
        <title>Subscribe - Mycelix Music</title>
        <meta name="description" content="Choose your Mycelix Music subscription plan and support artists" />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <SubscriptionPlans
          userAddress={address}
          onSubscribeSuccess={handleSubscribeSuccess}
        />
      </div>
    </>
  );
}
