/**
 * Subscription Plans Component
 * Displays available subscription tiers and features
 */

import React, { useState } from 'react';
import { useSubscriptionTiers, useSubscribe, useSubscription } from '../../hooks/useSubscription';

interface SubscriptionPlansProps {
  userAddress?: string;
  onSubscribeSuccess?: () => void;
}

export default function SubscriptionPlans({ userAddress, onSubscribeSuccess }: SubscriptionPlansProps) {
  const { data: tiers, isLoading: tiersLoading } = useSubscriptionTiers();
  const { data: currentSubscription } = useSubscription(userAddress);
  const subscribe = useSubscribe();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState('');

  const handleSubscribe = async (tier: string) => {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setSelectedTier(tier);
      await subscribe.mutateAsync({
        userAddress,
        tier,
        transactionHash: transactionHash || undefined,
        autoRenew: true,
      });

      alert(`Successfully subscribed to ${tier} tier!`);
      setTransactionHash('');
      onSubscribeSuccess?.();
    } catch (error: any) {
      alert(`Subscription failed: ${error.message}`);
    } finally {
      setSelectedTier(null);
    }
  };

  if (tiersLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tierFeatures = {
    FREE: [
      'Pay-per-stream model',
      'Standard quality (128kbps)',
      'Ads supported',
      'Basic features',
    ],
    BASIC: [
      'Unlimited streaming',
      'Standard quality (256kbps)',
      'Ad-free experience',
      'Support artists',
    ],
    PREMIUM: [
      'Unlimited streaming',
      'High quality (320kbps/FLAC)',
      'Offline playback',
      'Ad-free experience',
      'Exclusive content',
    ],
    ARTIST_SUPPORTER: [
      'All Premium features',
      'High quality audio',
      'Offline playback',
      'Ad-free experience',
      '10% to artist patronage pool',
      'Support your favorite artists',
      'Early access to releases',
    ],
  };

  const tierPrices = {
    FREE: 0,
    BASIC: 5,
    PREMIUM: 10,
    ARTIST_SUPPORTER: 15,
  };

  const tierNames = {
    FREE: 'Free',
    BASIC: 'Basic',
    PREMIUM: 'Premium',
    ARTIST_SUPPORTER: 'Artist Supporter',
  };

  const tierColors = {
    FREE: 'gray',
    BASIC: 'blue',
    PREMIUM: 'purple',
    ARTIST_SUPPORTER: 'pink',
  };

  const allTiers = ['FREE', 'BASIC', 'PREMIUM', 'ARTIST_SUPPORTER'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h2>
        <p className="text-xl text-gray-600">
          Support artists while enjoying unlimited music
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {allTiers.map((tierKey) => {
          const tier = tierKey as keyof typeof tierFeatures;
          const price = tierPrices[tier];
          const name = tierNames[tier];
          const features = tierFeatures[tier];
          const color = tierColors[tier];
          const isCurrentTier = currentSubscription?.tier === tier;
          const isPremiumTier = tier === 'PREMIUM';

          return (
            <div
              key={tier}
              className={`relative rounded-2xl shadow-xl overflow-hidden ${
                isPremiumTier
                  ? 'ring-4 ring-purple-600 transform scale-105'
                  : 'ring-1 ring-gray-200'
              }`}
            >
              {isPremiumTier && (
                <div className="absolute top-0 right-0 bg-purple-600 text-white px-4 py-1 text-sm font-bold rounded-bl-lg">
                  POPULAR
                </div>
              )}

              <div className={`bg-${color}-50 p-8`}>
                <h3 className={`text-2xl font-bold text-${color}-900 mb-2`}>
                  {name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-gray-900">
                    ${price}
                  </span>
                  {price > 0 && (
                    <span className="text-gray-600 ml-2">/month</span>
                  )}
                </div>

                {isCurrentTier && (
                  <div className="mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      ✓ Current Plan
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white p-8">
                <ul className="space-y-4 mb-8">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg
                        className={`h-6 w-6 text-${color}-600 mr-3 flex-shrink-0`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier === 'FREE' ? (
                  <button
                    className="w-full py-3 px-6 rounded-lg font-semibold text-gray-700 bg-gray-100 cursor-not-allowed"
                    disabled
                  >
                    Default Plan
                  </button>
                ) : isCurrentTier ? (
                  <button
                    className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-gray-400 cursor-not-allowed"
                    disabled
                  >
                    Active
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={subscribe.isPending && selectedTier === tier}
                    className={`w-full py-3 px-6 rounded-lg font-semibold text-white bg-${color}-600 hover:bg-${color}-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {subscribe.isPending && selectedTier === tier ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin h-5 w-5 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Subscribing...
                      </span>
                    ) : (
                      `Subscribe to ${name}`
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction Hash Input (optional) */}
      {userAddress && !currentSubscription && (
        <div className="mt-12 max-w-md mx-auto">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Hash (optional)
          </label>
          <input
            type="text"
            value={transactionHash}
            onChange={(e) => setTransactionHash(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          <p className="mt-2 text-sm text-gray-500">
            If you've already made a payment, enter the transaction hash here
          </p>
        </div>
      )}

      {/* Revenue Distribution Info */}
      <div className="mt-16 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
          How Your Subscription Supports Artists
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">70%</div>
            <div className="text-gray-700 font-medium">To Artists</div>
            <div className="text-sm text-gray-600 mt-2">
              Distributed based on plays
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">20%</div>
            <div className="text-gray-700 font-medium">Platform Operations</div>
            <div className="text-sm text-gray-600 mt-2">
              Infrastructure & development
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-pink-600 mb-2">10%</div>
            <div className="text-gray-700 font-medium">Artist Patronage Pool</div>
            <div className="text-sm text-gray-600 mt-2">
              Artist Supporter tier only
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-16">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Frequently Asked Questions
        </h3>
        <div className="space-y-4 max-w-3xl mx-auto">
          <details className="bg-white rounded-lg shadow-md p-6">
            <summary className="font-semibold text-gray-900 cursor-pointer">
              How is the 70% artist share distributed?
            </summary>
            <p className="mt-3 text-gray-600">
              Each month, 70% of all subscription revenue goes into an artist pool.
              This pool is then distributed to artists based on their share of total plays.
              For example, if an artist's songs account for 10% of all plays, they receive 10% of the artist pool.
            </p>
          </details>

          <details className="bg-white rounded-lg shadow-md p-6">
            <summary className="font-semibold text-gray-900 cursor-pointer">
              Can I upgrade or downgrade my plan?
            </summary>
            <p className="mt-3 text-gray-600">
              Yes! You can upgrade anytime (pro-rated charge for the difference).
              Downgrades take effect at your next billing cycle.
            </p>
          </details>

          <details className="bg-white rounded-lg shadow-md p-6">
            <summary className="font-semibold text-gray-900 cursor-pointer">
              What's the Artist Supporter tier patronage pool?
            </summary>
            <p className="mt-3 text-gray-600">
              10% of Artist Supporter subscriptions go to a special patronage pool
              that provides additional support to artists. This helps support emerging
              artists and funds special projects.
            </p>
          </details>

          <details className="bg-white rounded-lg shadow-md p-6">
            <summary className="font-semibold text-gray-900 cursor-pointer">
              Can I still use pay-per-stream?
            </summary>
            <p className="mt-3 text-gray-600">
              Yes! The Free tier uses our pay-per-stream model. You can also
              combine a subscription with artist-specific patronage to support
              your favorite artists directly.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
