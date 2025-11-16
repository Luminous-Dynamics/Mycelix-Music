/**
 * Creator Songs Page
 * Manage songs, drafts, and scheduled releases
 */

import React from 'react';
import { useAccount } from 'wagmi';
import { SongManager } from '../../components/creator';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function CreatorSongsPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  if (!isConnected) {
    return (
      <>
        <Head>
          <title>Manage Songs - Mycelix Music</title>
        </Head>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to manage your songs
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
        <title>Manage Songs - Mycelix Music</title>
        <meta name="description" content="Manage your songs, drafts, and scheduled releases" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Navigation Breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/creator/dashboard">
                <a className="text-gray-600 hover:text-gray-900">Creator Dashboard</a>
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-semibold">Song Manager</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <SongManager artistAddress={address!} />
      </div>
    </>
  );
}
