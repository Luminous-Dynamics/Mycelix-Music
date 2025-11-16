/**
 * Content Calendar Component
 * Plan and schedule content releases and activities
 */

import React, { useState } from 'react';
import { useContentCalendar, useAddCalendarEvent } from '../../hooks/useCreator';

interface ContentCalendarProps {
  artistAddress: string;
}

export default function ContentCalendar({ artistAddress }: ContentCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventData, setEventData] = useState({
    title: '',
    eventType: 'release' as 'release' | 'announcement' | 'social' | 'event',
    description: '',
    eventDate: '',
    metadata: '',
  });

  const { data: events, isLoading } = useContentCalendar(artistAddress);
  const addEvent = useAddCalendarEvent();

  const handleAddEvent = async () => {
    try {
      await addEvent.mutateAsync({
        artistAddress,
        ...eventData,
        metadata: eventData.metadata ? JSON.parse(eventData.metadata) : undefined,
      });
      alert('Event added to calendar!');
      setShowEventModal(false);
      setEventData({
        title: '',
        eventType: 'release',
        description: '',
        eventDate: '',
        metadata: '',
      });
    } catch (error: any) {
      alert(`Failed to add event: ${error.message}`);
    }
  };

  // Get current month events
  const currentMonthEvents = events?.filter((event) => {
    const eventDate = new Date(event.event_date);
    return (
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getFullYear() === selectedDate.getFullYear()
    );
  }) || [];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const eventColors = {
    release: 'bg-blue-600',
    announcement: 'bg-green-600',
    social: 'bg-purple-600',
    event: 'bg-pink-600',
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Content Calendar</h1>
          <p className="text-gray-600">Plan your releases and activities</p>
        </div>
        <button
          onClick={() => setShowEventModal(true)}
          className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700"
        >
          + Add Event
        </button>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex justify-between items-center">
          <button
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold">
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: getFirstDayOfMonth(selectedDate) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}
            {Array.from({ length: getDaysInMonth(selectedDate) }).map((_, idx) => {
              const day = idx + 1;
              const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
              const dayEvents = currentMonthEvents.filter((event) => {
                const eventDate = new Date(event.event_date);
                return eventDate.getDate() === day;
              });
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={day}
                  className={`aspect-square p-2 border-2 rounded-lg transition-all hover:border-blue-600 cursor-pointer ${
                    isToday ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs text-white rounded px-1 py-0.5 truncate ${
                          eventColors[event.event_type]
                        }`}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-600">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${eventColors[event.event_type]}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      <p className="text-sm text-gray-600">{event.description}</p>
                    </div>
                    <span className="text-sm text-gray-600">
                      {new Date(event.event_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">No events scheduled yet</p>
        )}
      </div>

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Calendar Event</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
                <input
                  type="text"
                  value={eventData.title}
                  onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                  placeholder="Release new single..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                  <select
                    value={eventData.eventType}
                    onChange={(e) => setEventData({ ...eventData, eventType: e.target.value as typeof eventData.eventType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="release">Release</option>
                    <option value="announcement">Announcement</option>
                    <option value="social">Social Media</option>
                    <option value="event">Live Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={eventData.eventDate}
                    onChange={(e) => setEventData({ ...eventData, eventDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  placeholder="Event details..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={4}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEventModal(false)}
                className="px-6 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                disabled={addEvent.isPending || !eventData.title || !eventData.eventDate}
                className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {addEvent.isPending ? 'Adding...' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
