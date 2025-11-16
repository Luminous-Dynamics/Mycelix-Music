/**
 * Fan Engagement Component
 * Manage messages, patrons, moderation, and follower insights
 */

import React, { useState } from 'react';
import {
  usePatrons,
  useCreatorMessages,
  useSendMessage,
  useModerateComment,
  useBanUser,
  useUnbanUser,
} from '../../hooks/useCreator';

interface FanEngagementProps {
  artistAddress: string;
}

export default function FanEngagement({ artistAddress }: FanEngagementProps) {
  const [activeTab, setActiveTab] = useState<'messages' | 'patrons' | 'moderation'>('messages');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageData, setMessageData] = useState({
    messageType: 'announcement' as 'announcement' | 'patron_only' | 'all_followers',
    subject: '',
    content: '',
    targetTiers: [] as string[],
  });

  const { data: patrons, isLoading: patronsLoading } = usePatrons(artistAddress);
  const { data: messages, isLoading: messagesLoading } = useCreatorMessages(artistAddress);
  const sendMessage = useSendMessage();
  const moderateComment = useModerateComment();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();

  const handleSendMessage = async () => {
    try {
      await sendMessage.mutateAsync({
        artistAddress,
        messageType: messageData.messageType,
        subject: messageData.subject,
        content: messageData.content,
        targetTiers: messageData.targetTiers,
      });
      alert('Message sent successfully!');
      setShowMessageModal(false);
      setMessageData({
        messageType: 'announcement',
        subject: '',
        content: '',
        targetTiers: [],
      });
    } catch (error: any) {
      alert(`Failed to send message: ${error.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Fan Engagement</h1>
        <p className="text-gray-600">Connect with your fans, manage patrons, and moderate content</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          {[
            { id: 'messages' as const, label: 'Messages', icon: '📧' },
            { id: 'patrons' as const, label: 'Patrons', icon: '⭐' },
            { id: 'moderation' as const, label: 'Moderation', icon: '🛡️' },
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

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Your Messages</h2>
            <button
              onClick={() => setShowMessageModal(true)}
              className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              + New Message
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {messagesLoading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {messages.map((message) => (
                  <div key={message.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{message.subject}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            message.message_type === 'announcement'
                              ? 'bg-blue-100 text-blue-800'
                              : message.message_type === 'patron_only'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {message.message_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">
                            {new Date(message.sent_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {message.read_count || 0} reads
                      </div>
                    </div>
                    <p className="text-gray-700 line-clamp-2">{message.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-600">
                <p className="mb-4">No messages sent yet</p>
                <button
                  onClick={() => setShowMessageModal(true)}
                  className="inline-block px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Send Your First Message
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patrons Tab */}
      {activeTab === 'patrons' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Patrons</h2>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {patronsLoading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : patrons && patrons.length > 0 ? (
              <div>
                <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Total Patrons</div>
                      <div className="text-3xl font-bold text-gray-900">{patrons.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Monthly Revenue</div>
                      <div className="text-3xl font-bold text-green-600">
                        ${patrons.reduce((sum, p) => sum + parseFloat(p.tier_price), 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Active Tiers</div>
                      <div className="text-3xl font-bold text-purple-600">
                        {new Set(patrons.map(p => p.tier)).size}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {patrons.map((patron) => (
                    <div key={patron.patron_address} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {patron.patron_address.slice(0, 6)}...{patron.patron_address.slice(-4)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
                              Tier {patron.tier}
                            </span>
                            <span className="text-sm text-gray-600">
                              ${parseFloat(patron.tier_price).toFixed(2)}/month
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Since</div>
                          <div className="font-semibold text-gray-900">
                            {new Date(patron.start_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-600">
                <p>No patrons yet. Encourage your fans to support you!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === 'moderation' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Content Moderation</h2>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-600">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Moderation Tools</h3>
            <p className="mb-4">Manage comments and ban users from the song comment sections</p>
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Send Message to Fans</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                <select
                  value={messageData.messageType}
                  onChange={(e) => setMessageData({
                    ...messageData,
                    messageType: e.target.value as typeof messageData.messageType
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="announcement">Announcement (All Fans)</option>
                  <option value="all_followers">All Followers</option>
                  <option value="patron_only">Patrons Only</option>
                </select>
              </div>
              {messageData.messageType === 'patron_only' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Tiers</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((tier) => (
                      <label key={tier} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={messageData.targetTiers.includes(tier.toString())}
                          onChange={(e) => {
                            const tiers = e.target.checked
                              ? [...messageData.targetTiers, tier.toString()]
                              : messageData.targetTiers.filter(t => t !== tier.toString());
                            setMessageData({ ...messageData, targetTiers: tiers });
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Tier {tier}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={messageData.subject}
                  onChange={(e) => setMessageData({ ...messageData, subject: e.target.value })}
                  placeholder="Message subject..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                <textarea
                  value={messageData.content}
                  onChange={(e) => setMessageData({ ...messageData, content: e.target.value })}
                  placeholder="Write your message..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  rows={8}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowMessageModal(false)}
                className="px-6 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sendMessage.isPending || !messageData.subject || !messageData.content}
                className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {sendMessage.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
