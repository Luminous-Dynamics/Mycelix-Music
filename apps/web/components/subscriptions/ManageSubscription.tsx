/**
 * Manage Subscription Component
 * Allows users to manage their current subscription
 */

import React, { useState } from 'react';
import {
  useSubscription,
  useSubscriptionManagement,
  useDaysUntilRenewal,
  useNeedsRenewal,
  useTierInfo,
} from '../../hooks/useSubscription';

interface ManageSubscriptionProps {
  userAddress: string;
  onUpdate?: () => void;
}

export default function ManageSubscription({ userAddress, onUpdate }: ManageSubscriptionProps) {
  const { data: subscription, isLoading, refetch } = useSubscription(userAddress);
  const management = useSubscriptionManagement(userAddress);
  const daysUntilRenewal = useDaysUntilRenewal(subscription);
  const needsRenewal = useNeedsRenewal(subscription);
  const tierInfo = useTierInfo(subscription?.tier);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState('');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscription || subscription.status !== 'active') {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-xl font-semibold text-yellow-900 mb-2">
          No Active Subscription
        </h3>
        <p className="text-yellow-700">
          You don't have an active subscription. Choose a plan to get started!
        </p>
      </div>
    );
  }

  const handleRenew = async () => {
    try {
      await management.renew(transactionHash || undefined);
      alert('Subscription renewed successfully!');
      setTransactionHash('');
      refetch();
      onUpdate?.();
    } catch (error: any) {
      alert(`Renewal failed: ${error.message}`);
    }
  };

  const handleCancel = async () => {
    try {
      await management.cancel();
      alert('Subscription cancelled. You can continue using it until the end of your billing period.');
      setShowCancelConfirm(false);
      refetch();
      onUpdate?.();
    } catch (error: any) {
      alert(`Cancellation failed: ${error.message}`);
    }
  };

  const handleUpgrade = async (newTier: string) => {
    try {
      await management.upgrade(newTier, transactionHash || undefined);
      alert(`Successfully upgraded to ${newTier}!`);
      setUpgradeTarget(null);
      setTransactionHash('');
      refetch();
      onUpdate?.();
    } catch (error: any) {
      alert(`Upgrade failed: ${error.message}`);
    }
  };

  const handleDowngrade = async (newTier: string) => {
    try {
      await management.downgrade(newTier);
      alert(`Downgrade scheduled. Your plan will change to ${newTier} at the next billing cycle.`);
      setDowngradeTarget(null);
      refetch();
      onUpdate?.();
    } catch (error: any) {
      alert(`Downgrade failed: ${error.message}`);
    }
  };

  const handleToggleAutoRenew = async () => {
    try {
      await management.setAutoRenew(!subscription.auto_renew);
      alert(`Auto-renewal ${!subscription.auto_renew ? 'enabled' : 'disabled'}`);
      refetch();
      onUpdate?.();
    } catch (error: any) {
      alert(`Failed to update auto-renewal: ${error.message}`);
    }
  };

  const tierOptions = {
    BASIC: { name: 'Basic', price: 5 },
    PREMIUM: { name: 'Premium', price: 10 },
    ARTIST_SUPPORTER: { name: 'Artist Supporter', price: 15 },
  };

  const getUpgradeOptions = () => {
    const tiers = Object.keys(tierOptions) as Array<keyof typeof tierOptions>;
    return tiers.filter((t) => {
      const tierPrices = { BASIC: 5, PREMIUM: 10, ARTIST_SUPPORTER: 15 };
      const currentPrice = tierPrices[subscription.tier as keyof typeof tierPrices] || 0;
      return tierPrices[t] > currentPrice;
    });
  };

  const getDowngradeOptions = () => {
    const tiers = Object.keys(tierOptions) as Array<keyof typeof tierOptions>;
    return tiers.filter((t) => {
      const tierPrices = { BASIC: 5, PREMIUM: 10, ARTIST_SUPPORTER: 15 };
      const currentPrice = tierPrices[subscription.tier as keyof typeof tierPrices] || 0;
      return tierPrices[t] < currentPrice;
    });
  };

  const upgradeOptions = getUpgradeOptions();
  const downgradeOptions = getDowngradeOptions();

  const statusColors = {
    active: 'green',
    cancelled: 'yellow',
    expired: 'red',
    paused: 'gray',
  };

  const statusColor = statusColors[subscription.status] || 'gray';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">
        Manage Your Subscription
      </h2>

      {/* Current Subscription Status */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {tierInfo?.name || subscription.tier} Plan
            </h3>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${statusColor}-100 text-${statusColor}-800`}>
                {subscription.status.toUpperCase()}
              </span>
              {subscription.auto_renew && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Auto-Renewal ON
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              ${tierInfo?.price || 0}
              <span className="text-lg text-gray-600 ml-1">/mo</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Started</div>
            <div className="font-semibold text-gray-900">
              {new Date(subscription.start_date).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Last Billing</div>
            <div className="font-semibold text-gray-900">
              {new Date(subscription.last_billing_date).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Next Billing</div>
            <div className="font-semibold text-gray-900">
              {new Date(subscription.next_billing_date).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Days Until Renewal</div>
            <div className={`font-semibold ${needsRenewal ? 'text-orange-600' : 'text-gray-900'}`}>
              {daysUntilRenewal} days
              {needsRenewal && ' (Renewal Due Soon!)'}
            </div>
          </div>
        </div>

        {tierInfo?.features && (
          <div className="border-t pt-6">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Your Plan Includes:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {tierInfo.features.map((feature, idx) => (
                <div key={idx} className="flex items-center text-gray-700">
                  <svg
                    className="h-5 w-5 text-green-600 mr-2"
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
        )}
      </div>

      {/* Renewal Section */}
      {needsRenewal && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
          <h3 className="text-xl font-semibold text-orange-900 mb-4">
            ⚠️ Renewal Due Soon
          </h3>
          <p className="text-orange-700 mb-4">
            Your subscription will renew in {daysUntilRenewal} days. Make sure you have sufficient funds.
          </p>
          <div className="space-y-4">
            <input
              type="text"
              value={transactionHash}
              onChange={(e) => setTransactionHash(e.target.value)}
              placeholder="Transaction hash (optional)"
              className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent"
            />
            <button
              onClick={handleRenew}
              disabled={management.isPending}
              className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {management.isPending ? 'Processing...' : 'Renew Now'}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Options */}
      {upgradeOptions.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Upgrade Your Plan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upgradeOptions.map((tier) => {
              const option = tierOptions[tier];
              return (
                <div
                  key={tier}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-600 transition-colors"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold text-gray-900">{option.name}</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${option.price}
                      <span className="text-sm text-gray-600">/mo</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setUpgradeTarget(tier)}
                    disabled={management.isPending}
                    className="w-full py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Upgrade to {option.name}
                  </button>
                </div>
              );
            })}
          </div>

          {upgradeTarget && (
            <div className="mt-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-3">
                Confirm Upgrade to {tierOptions[upgradeTarget as keyof typeof tierOptions].name}
              </h4>
              <p className="text-blue-700 mb-4">
                You'll be charged the pro-rated difference for the remaining days in your billing cycle.
              </p>
              <input
                type="text"
                value={transactionHash}
                onChange={(e) => setTransactionHash(e.target.value)}
                placeholder="Transaction hash (optional)"
                className="w-full px-4 py-2 mb-4 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpgrade(upgradeTarget)}
                  disabled={management.isPending}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {management.isPending ? 'Processing...' : 'Confirm Upgrade'}
                </button>
                <button
                  onClick={() => {
                    setUpgradeTarget(null);
                    setTransactionHash('');
                  }}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Downgrade Options */}
      {downgradeOptions.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Downgrade Your Plan
          </h3>
          <p className="text-gray-600 mb-4">
            Downgrades take effect at your next billing cycle. No refunds for the current period.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {downgradeOptions.map((tier) => {
              const option = tierOptions[tier];
              return (
                <div
                  key={tier}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold text-gray-900">{option.name}</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${option.price}
                      <span className="text-sm text-gray-600">/mo</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDowngradeTarget(tier)}
                    disabled={management.isPending}
                    className="w-full py-2 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Downgrade to {option.name}
                  </button>
                </div>
              );
            })}
          </div>

          {downgradeTarget && (
            <div className="mt-6 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-900 mb-3">
                Confirm Downgrade to {tierOptions[downgradeTarget as keyof typeof tierOptions].name}
              </h4>
              <p className="text-yellow-700 mb-4">
                Your plan will change at the next billing cycle. You can continue using your current plan until then.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDowngrade(downgradeTarget)}
                  disabled={management.isPending}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-yellow-900 bg-yellow-200 hover:bg-yellow-300 transition-colors disabled:opacity-50"
                >
                  {management.isPending ? 'Processing...' : 'Confirm Downgrade'}
                </button>
                <button
                  onClick={() => setDowngradeTarget(null)}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-Renewal Toggle */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Auto-Renewal
            </h3>
            <p className="text-gray-600">
              {subscription.auto_renew
                ? 'Your subscription will automatically renew each month'
                : 'Auto-renewal is disabled. Your subscription will expire at the end of the billing period'}
            </p>
          </div>
          <button
            onClick={handleToggleAutoRenew}
            disabled={management.isPending}
            className={`relative inline-flex h-12 w-24 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
              subscription.auto_renew ? 'bg-blue-600' : 'bg-gray-200'
            } disabled:opacity-50`}
          >
            <span
              className={`pointer-events-none inline-block h-11 w-11 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                subscription.auto_renew ? 'translate-x-12' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Cancel Subscription */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Cancel Subscription
        </h3>
        <p className="text-gray-600 mb-4">
          You can cancel your subscription anytime. You'll continue to have access until the end of your billing period.
        </p>

        {!showCancelConfirm ? (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="py-2 px-6 rounded-lg font-semibold text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
          >
            Cancel Subscription
          </button>
        ) : (
          <div className="p-6 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-900 mb-3">
              Are you sure you want to cancel?
            </h4>
            <p className="text-red-700 mb-4">
              You'll lose access to premium features at the end of your billing period on{' '}
              {new Date(subscription.next_billing_date).toLocaleDateString()}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={management.isPending}
                className="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {management.isPending ? 'Processing...' : 'Yes, Cancel Subscription'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
