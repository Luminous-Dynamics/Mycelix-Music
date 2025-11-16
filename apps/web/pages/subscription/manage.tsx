/**
 * Manage Subscription Page
 * View and manage current subscription
 */

import React from 'react';
import { useAccount } from 'wagmi';
import { ManageSubscription } from '../../components/subscriptions';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ManageSubscriptionPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  if (!isConnected) {
    return (
      <>
        <Head>
          <title>Manage Subscription - Mycelix Music</title>
        </Head>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to manage your subscription
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

  const handleUpdate = () => {
    // Optionally refresh or show success message
    console.log('Subscription updated');
  };

  return (
    <>
      <Head>
        <title>Manage Subscription - Mycelix Music</title>
        <meta name="description" content="Manage your Mycelix Music subscription" />
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
              <span className="text-gray-900 font-semibold">Manage Subscription</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-8">
          <ManageSubscription
            userAddress={address!}
            onUpdate={handleUpdate}
          />
        </div>

        {/* Quick Links */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/subscription/billing">
                <a className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-600 transition-colors group">
                  <svg className="h-6 w-6 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-blue-600">Billing History</div>
                    <div className="text-xs text-gray-600">View past transactions</div>
                  </div>
                </a>
              </Link>

              <Link href="/subscribe">
                <a className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-600 transition-colors group">
                  <svg className="h-6 w-6 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-blue-600">View All Plans</div>
                    <div className="text-xs text-gray-600">Compare subscription tiers</div>
                  </div>
                </a>
              </Link>

              <Link href="/dashboard">
                <a className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-600 transition-colors group">
                  <svg className="h-6 w-6 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-blue-600">Dashboard</div>
                    <div className="text-xs text-gray-600">Back to main dashboard</div>
                  </div>
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
