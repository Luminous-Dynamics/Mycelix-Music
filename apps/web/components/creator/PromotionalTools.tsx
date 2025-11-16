/**
 * Promotional Tools Component
 * Manage campaigns, discounts, and revenue splits
 */

import React, { useState } from 'react';
import {
  useCampaigns,
  useCreateCampaign,
  useCampaignStats,
  useRevenueSplits,
  useAddSplit,
} from '../../hooks/useCreator';

interface PromotionalToolsProps {
  artistAddress: string;
}

export default function PromotionalTools({ artistAddress }: PromotionalToolsProps) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'splits'>('campaigns');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignData, setcampaignData] = useState({
    name: '',
    discountCode: '',
    discountPercentage: 10,
    validFrom: '',
    validUntil: '',
    maxUses: 100,
    applicableSongs: [] as string[],
  });

  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(artistAddress);
  const { data: splits, isLoading: splitsLoading } = useRevenueSplits(artistAddress);
  const createCampaign = useCreateCampaign();
  const addSplit = useAddSplit();

  const handleCreateCampaign = async () => {
    try {
      await createCampaign.mutateAsync({
        artistAddress,
        ...campaignData,
      });
      alert('Campaign created successfully!');
      setShowCampaignModal(false);
    } catch (error: any) {
      alert(`Failed to create campaign: ${error.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Promotional Tools</h1>
        <p className="text-gray-600">Create campaigns, manage discounts, and split revenue</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          {[
            { id: 'campaigns' as const, label: 'Discount Campaigns', icon: '🎯' },
            { id: 'splits' as const, label: 'Revenue Splits', icon: '💰' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Your Campaigns</h2>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700"
            >
              + Create Campaign
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {campaignsLoading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : campaigns && campaigns.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{campaign.campaign_name}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                            {campaign.discount_code}
                          </span>
                          <span className="text-sm text-gray-600">
                            {campaign.discount_percentage}% off
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Uses</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {campaign.current_uses}/{campaign.max_uses}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-600">
                <p className="mb-4">No campaigns yet</p>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="inline-block px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Your First Campaign
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Splits Tab */}
      {activeTab === 'splits' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Revenue Splits</h2>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-600">
            <p>Manage revenue splits for collaborations</p>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create Discount Campaign</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignData.name}
                  onChange={(e) => setcampaignData({ ...campaignData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Code</label>
                  <input
                    type="text"
                    value={campaignData.discountCode}
                    onChange={(e) => setcampaignData({ ...campaignData, discountCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount %</label>
                  <input
                    type="number"
                    value={campaignData.discountPercentage}
                    onChange={(e) => setcampaignData({ ...campaignData, discountPercentage: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCampaignModal(false)}
                className="px-6 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={createCampaign.isPending}
                className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
