/**
 * Billing History Page
 * View transaction history for subscriptions
 */

import React from 'react';
import { useAccount } from 'wagmi';
import { BillingHistory } from '../../components/subscriptions';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function BillingHistoryPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  if (!isConnected) {
    return (
      <>
        <Head>
          <title>Billing History - Mycelix Music</title>
        </Head>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to view billing history
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Billing History - Mycelix Music</title>
        <meta name="description" content="View your Mycelix Music billing history and transactions" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Navigation Breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/dashboard">
                <a className="text-gray-600 hover:text-gray-900">Dashboard</a>
              </Link>
              <span className="text-gray-400">/</span>
              <Link href="/subscription/manage">
                <a className="text-gray-600 hover:text-gray-900">Manage Subscription</a>
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-semibold">Billing History</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-8">
          <BillingHistory userAddress={address!} limit={50} />
        </div>
      </div>
    </>
  );
}
