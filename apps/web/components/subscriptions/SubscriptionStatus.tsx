/**
 * Subscription Status Widget
 * Compact component showing current subscription status
 */

import React from 'react';
import {
  useSubscription,
  useDaysUntilRenewal,
  useNeedsRenewal,
  useTierInfo,
} from '../../hooks/useSubscription';
import Link from 'next/link';

interface SubscriptionStatusProps {
  userAddress?: string;
  compact?: boolean;
  showUpgradeButton?: boolean;
}

export default function SubscriptionStatus({
  userAddress,
  compact = false,
  showUpgradeButton = true,
}: SubscriptionStatusProps) {
  const { data: subscription, isLoading } = useSubscription(userAddress);
  const daysUntilRenewal = useDaysUntilRenewal(subscription);
  const needsRenewal = useNeedsRenewal(subscription);
  const tierInfo = useTierInfo(subscription?.tier);

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-lg h-24 w-full"></div>
    );
  }

  // No subscription or free tier
  if (!subscription || subscription.tier === 'FREE' || subscription.status !== 'active') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900 mb-1">
              Free Tier
            </div>
            <div className="text-sm text-gray-600">
              Upgrade for unlimited streaming
            </div>
          </div>
          <Link href="/subscribe">
            <a className="py-2 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all">
              Upgrade
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const statusColors = {
    active: 'green',
    cancelled: 'yellow',
    expired: 'red',
    paused: 'gray',
  };

  const statusColor = statusColors[subscription.status] || 'gray';

  const tierColors = {
    BASIC: 'blue',
    PREMIUM: 'purple',
    ARTIST_SUPPORTER: 'pink',
  };

  const tierColor = tierColors[subscription.tier as keyof typeof tierColors] || 'gray';

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${tierColor}-100 text-${tierColor}-800`}>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-semibold">{tierInfo?.name || subscription.tier}</span>
        </div>
        {needsRenewal && (
          <span className="text-xs text-orange-600 font-medium">
            Renews in {daysUntilRenewal}d
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-2 border-${tierColor}-200`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-${tierColor}-100 text-${tierColor}-800`}>
              {tierInfo?.name || subscription.tier}
            </div>
            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800`}>
              {subscription.status}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${tierInfo?.price || 0}
            <span className="text-sm text-gray-600 font-normal ml-1">/month</span>
          </div>
        </div>
        {showUpgradeButton && subscription.tier !== 'ARTIST_SUPPORTER' && (
          <Link href="/subscription/manage">
            <a className="py-2 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all text-sm">
              Upgrade
            </a>
          </Link>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Next Billing</span>
          <span className="font-semibold text-gray-900">
            {new Date(subscription.next_billing_date).toLocaleDateString()}
          </span>
        </div>

        {needsRenewal && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <svg
              className="h-5 w-5 text-orange-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-semibold text-orange-900">
                Renewal Due in {daysUntilRenewal} days
              </div>
              <div className="text-xs text-orange-700">
                Make sure you have sufficient funds
              </div>
            </div>
          </div>
        )}

        <div className={`p-3 bg-${tierColor}-50 rounded-lg`}>
          <div className="text-xs font-medium text-gray-600 mb-2">
            Plan Features:
          </div>
          <div className="space-y-1">
            {tierInfo?.features.slice(0, 3).map((feature, idx) => (
              <div key={idx} className="flex items-center text-xs text-gray-700">
                <svg
                  className={`h-3 w-3 text-${tierColor}-600 mr-1.5`}
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
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 flex justify-between">
          <Link href="/subscription/manage">
            <a className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Manage Subscription
            </a>
          </Link>
          <Link href="/subscription/billing">
            <a className="text-sm font-medium text-gray-600 hover:text-gray-800">
              Billing History
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
