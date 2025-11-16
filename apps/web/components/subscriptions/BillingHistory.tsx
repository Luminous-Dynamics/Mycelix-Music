/**
 * Billing History Component
 * Displays transaction history for user's subscription
 */

import React, { useState } from 'react';
import { useTransactions } from '../../hooks/useSubscription';

interface BillingHistoryProps {
  userAddress: string;
  limit?: number;
}

export default function BillingHistory({ userAddress, limit = 20 }: BillingHistoryProps) {
  const { data, isLoading, error } = useTransactions(userAddress, limit);
  const [expandedTransaction, setExpandedTransaction] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-xl font-semibold text-red-900 mb-2">
          Error Loading Billing History
        </h3>
        <p className="text-red-700">
          Failed to load your billing history. Please try again later.
        </p>
      </div>
    );
  }

  const transactions = data?.transactions || [];

  if (transactions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No Transactions Yet
        </h3>
        <p className="text-gray-600">
          Your billing history will appear here once you have subscription transactions.
        </p>
      </div>
    );
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'charge':
        return '💳';
      case 'renewal':
        return '🔄';
      case 'upgrade':
        return '⬆️';
      case 'downgrade':
        return '⬇️';
      case 'refund':
        return '💰';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'failed':
        return 'red';
      case 'refunded':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'charge':
        return 'Initial Charge';
      case 'renewal':
        return 'Renewal';
      case 'upgrade':
        return 'Tier Upgrade';
      case 'downgrade':
        return 'Tier Downgrade';
      case 'refund':
        return 'Refund';
      default:
        return type;
    }
  };

  const totalSpent = transactions
    .filter((t) => t.status === 'completed' && t.transaction_type !== 'refund')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalRefunded = transactions
    .filter((t) => t.status === 'refunded' || t.transaction_type === 'refund')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">
        Billing History
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-600 mb-2">Total Transactions</div>
          <div className="text-3xl font-bold text-gray-900">{transactions.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-600 mb-2">Total Spent</div>
          <div className="text-3xl font-bold text-green-600">
            ${totalSpent.toFixed(2)}
          </div>
        </div>
        {totalRefunded > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Total Refunded</div>
            <div className="text-3xl font-bold text-blue-600">
              ${totalRefunded.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const statusColor = getStatusColor(transaction.status);
                const isExpanded = expandedTransaction === transaction.id;

                return (
                  <React.Fragment key={transaction.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">
                            {getTransactionIcon(transaction.transaction_type)}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {getTransactionTypeLabel(transaction.transaction_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ${parseFloat(transaction.amount).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800`}
                        >
                          {transaction.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(transaction.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() =>
                            setExpandedTransaction(isExpanded ? null : transaction.id)
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">
                                  Transaction ID
                                </div>
                                <div className="text-sm text-gray-900 font-mono">
                                  #{transaction.id}
                                </div>
                              </div>

                              {transaction.transaction_hash && (
                                <div>
                                  <div className="text-xs font-medium text-gray-500 mb-1">
                                    Transaction Hash
                                  </div>
                                  <div className="text-sm text-gray-900 font-mono break-all">
                                    {transaction.transaction_hash}
                                  </div>
                                </div>
                              )}

                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">
                                  Subscription ID
                                </div>
                                <div className="text-sm text-gray-900">
                                  #{transaction.subscription_id}
                                </div>
                              </div>

                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">
                                  Created At
                                </div>
                                <div className="text-sm text-gray-900">
                                  {new Date(transaction.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {transaction.transaction_hash && (
                              <div className="pt-3 border-t border-gray-200">
                                <a
                                  href={`https://etherscan.io/tx/${transaction.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View on Etherscan
                                  <svg
                                    className="ml-1 h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-8 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {transactions.length} of {data?.total || transactions.length} transactions
        </div>
        <button className="py-2 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors">
          Export as CSV
        </button>
      </div>

      {/* Tax Information */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">
          📊 Tax Information
        </h3>
        <p className="text-blue-700 text-sm">
          You can export your billing history for tax purposes. All amounts are in USD.
          For specific tax questions, please consult with a tax professional.
        </p>
      </div>
    </div>
  );
}
