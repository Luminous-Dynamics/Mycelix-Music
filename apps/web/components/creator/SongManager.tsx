/**
 * Song Manager Component
 * Manage songs, drafts, scheduled releases, and bulk operations
 */

import React, { useState } from 'react';
import {
  useSongDrafts,
  useSaveDraft,
  useUpdateDraft,
  useDeleteDraft,
  useScheduledReleases,
  useScheduleRelease,
  useCancelScheduledRelease,
} from '../../hooks/useCreator';

interface SongManagerProps {
  artistAddress: string;
}

export default function SongManager({ artistAddress }: SongManagerProps) {
  const [activeTab, setActiveTab] = useState<'published' | 'drafts' | 'scheduled'>('published');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    songMetadata: '',
    releaseDate: '',
    autoPublish: true,
    notifyFollowers: true,
  });

  const { data: drafts, isLoading: draftsLoading } = useSongDrafts(artistAddress);
  const { data: scheduled, isLoading: scheduledLoading } = useScheduledReleases(artistAddress);
  const saveDraft = useSaveDraft();
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const scheduleRelease = useScheduleRelease();
  const cancelScheduled = useCancelScheduledRelease();

  const handleSelectSong = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSongs.size === 0) {
      // Select all in current tab
      const allIds = new Set<string>();
      if (activeTab === 'drafts' && drafts) {
        drafts.forEach((draft) => allIds.add(draft.id.toString()));
      } else if (activeTab === 'scheduled' && scheduled) {
        scheduled.forEach((item) => allIds.add(item.id.toString()));
      }
      setSelectedSongs(allIds);
    } else {
      setSelectedSongs(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedSongs.size} item(s)?`)) return;

    try {
      if (activeTab === 'drafts') {
        for (const id of selectedSongs) {
          await deleteDraft.mutateAsync(Number(id));
        }
      } else if (activeTab === 'scheduled') {
        for (const id of selectedSongs) {
          await cancelScheduled.mutateAsync(Number(id));
        }
      }
      setSelectedSongs(new Set());
      alert('Bulk delete completed!');
    } catch (error: any) {
      alert(`Bulk delete failed: ${error.message}`);
    }
  };

  const handleScheduleRelease = async () => {
    try {
      await scheduleRelease.mutateAsync({
        artistAddress,
        songMetadata: JSON.parse(scheduleData.songMetadata),
        releaseDate: scheduleData.releaseDate,
        autoPublish: scheduleData.autoPublish,
        notifyFollowers: scheduleData.notifyFollowers,
      });
      alert('Release scheduled successfully!');
      setShowScheduleModal(false);
      setScheduleData({
        songMetadata: '',
        releaseDate: '',
        autoPublish: true,
        notifyFollowers: true,
      });
    } catch (error: any) {
      alert(`Failed to schedule release: ${error.message}`);
    }
  };

  const tabs = [
    { id: 'published' as const, label: 'Published Songs', count: 0 },
    { id: 'drafts' as const, label: 'Drafts', count: drafts?.length || 0 },
    { id: 'scheduled' as const, label: 'Scheduled', count: scheduled?.length || 0 },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Song Manager</h1>
        <p className="text-gray-600">Manage your published songs, drafts, and scheduled releases</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedSongs(new Set());
              }}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedSongs.size > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-blue-900">
              {selectedSongs.size} item(s) selected
            </span>
            <button
              onClick={() => setSelectedSongs(new Set())}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear Selection
            </button>
          </div>
          <div className="flex gap-3">
            {activeTab === 'drafts' && (
              <button className="px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">
                Publish Selected
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              disabled={saveDraft.isPending || deleteDraft.isPending}
              className="px-4 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={handleSelectAll}
          className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          {selectedSongs.size > 0 ? 'Deselect All' : 'Select All'}
        </button>
        {activeTab === 'scheduled' && (
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            + Schedule New Release
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {activeTab === 'published' && (
          <div className="p-8 text-center text-gray-600">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Published Songs</h3>
            <p className="mb-4">View and manage your published songs from the main artist page.</p>
            <a
              href={`/artist/${artistAddress}`}
              className="inline-block px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              View Artist Profile
            </a>
          </div>
        )}

        {activeTab === 'drafts' && (
          <div>
            {draftsLoading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : drafts && drafts.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedSongs.has(draft.id.toString())}
                        onChange={() => handleSelectSong(draft.id.toString())}
                        className="mt-1 h-5 w-5 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{draft.title || 'Untitled Draft'}</h3>
                            <p className="text-sm text-gray-600">Version {draft.version}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => alert('Edit draft functionality')}
                              className="px-3 py-1 rounded-lg font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this draft?')) {
                                  try {
                                    await deleteDraft.mutateAsync(draft.id);
                                    alert('Draft deleted!');
                                  } catch (error: any) {
                                    alert(`Failed to delete: ${error.message}`);
                                  }
                                }
                              }}
                              className="px-3 py-1 rounded-lg font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          Last updated: {new Date(draft.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {draft.metadata && typeof draft.metadata === 'object' && (
                          <div className="flex flex-wrap gap-2">
                            {(draft.metadata as any).genre && (
                              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                                {(draft.metadata as any).genre}
                              </span>
                            )}
                            {(draft.metadata as any).tags && Array.isArray((draft.metadata as any).tags) && (
                              (draft.metadata as any).tags.map((tag: string) => (
                                <span key={tag} className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                                  {tag}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-600">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Drafts</h3>
                <p>Start creating a new song to save it as a draft.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div>
            {scheduledLoading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : scheduled && scheduled.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {scheduled.map((item) => {
                  const releaseDate = new Date(item.release_date);
                  const isPast = releaseDate < new Date();
                  const daysUntil = Math.ceil((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={item.id}
                      className="p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={selectedSongs.has(item.id.toString())}
                          onChange={() => handleSelectSong(item.id.toString())}
                          className="mt-1 h-5 w-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {(item.song_metadata as any)?.title || 'Untitled Release'}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  item.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : item.status === 'published'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.status.toUpperCase()}
                                </span>
                                {!isPast && (
                                  <span className="text-sm text-gray-600">
                                    Releases in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => alert('Edit scheduled release')}
                                className="px-3 py-1 rounded-lg font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Cancel this scheduled release?')) {
                                    try {
                                      await cancelScheduled.mutateAsync(item.id);
                                      alert('Scheduled release cancelled!');
                                    } catch (error: any) {
                                      alert(`Failed to cancel: ${error.message}`);
                                    }
                                  }
                                }}
                                className="px-3 py-1 rounded-lg font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Release Date:</span>
                              <span className="ml-2 font-semibold text-gray-900">
                                {releaseDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Auto-Publish:</span>
                              <span className="ml-2 font-semibold text-gray-900">
                                {item.auto_publish ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                          {item.song_metadata && typeof item.song_metadata === 'object' && (
                            <div className="flex flex-wrap gap-2">
                              {(item.song_metadata as any).genre && (
                                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                                  {(item.song_metadata as any).genre}
                                </span>
                              )}
                              {item.notify_followers && (
                                <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                                  📧 Notify Followers
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-600">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scheduled Releases</h3>
                <p className="mb-4">Schedule your next release to automate the publishing process.</p>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="inline-block px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Schedule a Release
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule Release Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Schedule New Release</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Song Metadata (JSON)
                </label>
                <textarea
                  value={scheduleData.songMetadata}
                  onChange={(e) => setScheduleData({ ...scheduleData, songMetadata: e.target.value })}
                  placeholder='{"title": "Song Title", "genre": "Rock", "cid": "ipfs://..."}'
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono text-sm"
                  rows={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Release Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleData.releaseDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, releaseDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scheduleData.autoPublish}
                    onChange={(e) => setScheduleData({ ...scheduleData, autoPublish: e.target.checked })}
                    className="h-5 w-5 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Auto-publish at release time</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scheduleData.notifyFollowers}
                    onChange={(e) => setScheduleData({ ...scheduleData, notifyFollowers: e.target.checked })}
                    className="h-5 w-5 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Notify followers</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-6 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleRelease}
                disabled={scheduleRelease.isPending || !scheduleData.songMetadata || !scheduleData.releaseDate}
                className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {scheduleRelease.isPending ? 'Scheduling...' : 'Schedule Release'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
