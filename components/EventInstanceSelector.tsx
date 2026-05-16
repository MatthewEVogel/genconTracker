import { EventInstance } from '@/lib/services/server/eventsListService';
import { useState } from 'react';

interface EventInstanceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  instances: EventInstance[];
  allUsers: Array<{ id: string; firstName: string; lastName: string; genConName: string }>;
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  onSelectInstance: (instanceId: string) => void;
}

// Helper to format date/time
const formatDateTime = (dateTimeStr: string | null) => {
  if (!dateTimeStr) return 'TBD';
  
  try {
    const date = new Date(dateTimeStr);
    const dayOfWeek = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: 'UTC'
    });
    
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const time = `${displayHours}:${displayMinutes} ${ampm}`;
    
    return `${dayOfWeek} ${time}`;
  } catch {
    return dateTimeStr;
  }
};

export default function EventInstanceSelector({
  isOpen,
  onClose,
  eventTitle,
  instances,
  allUsers,
  selectedUserId,
  onUserChange,
  onSelectInstance
}: EventInstanceSelectorProps) {
  if (!isOpen) return null;

  // Group instances by day for better organization
  const instancesByDay = new Map<string, EventInstance[]>();
  instances.forEach(instance => {
    if (instance.startDateTime) {
      try {
        const date = new Date(instance.startDateTime);
        const day = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        const existing = instancesByDay.get(day) || [];
        existing.push(instance);
        instancesByDay.set(day, existing);
      } catch {
        // Skip invalid dates
      }
    }
  });

  const DAYS_ORDER = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday'];
  const sortedDays = DAYS_ORDER.filter(day => instancesByDay.has(day));

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Select Event Time
            </h3>
            <p className="text-sm text-gray-600 font-medium">{eventTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* User Selector */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add event for:
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => onUserChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {allUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.genConName})
              </option>
            ))}
          </select>
        </div>

        {/* Instance List */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Choose which session you'd like to add to your schedule:
          </p>

          <div className="space-y-6">
            {sortedDays.map(day => {
              const dayInstances = instancesByDay.get(day) || [];
              // Sort instances by time
              const sortedInstances = dayInstances.sort((a, b) => {
                if (!a.startDateTime || !b.startDateTime) return 0;
                return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
              });

              return (
                <div key={day}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                    {day}
                  </h4>
                  <div className="space-y-2">
                    {sortedInstances.map(instance => (
                      <div
                        key={instance.id}
                        className={`border rounded-lg p-4 ${
                          instance.isCanceled
                            ? 'bg-red-50 border-red-200'
                            : instance.isUserEvent
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        } transition-all`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            {/* Time and Duration */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-gray-900">
                                {formatDateTime(instance.startDateTime)}
                              </span>
                              {instance.duration && (
                                <span className="text-sm text-gray-500">
                                  ({instance.duration})
                                </span>
                              )}
                              {instance.isUserEvent && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✓ In Schedule
                                </span>
                              )}
                              {instance.isCanceled && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  CANCELED
                                </span>
                              )}
                            </div>

                            {/* Location and Capacity */}
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              {instance.location && (
                                <span>📍 {instance.location}</span>
                              )}
                              {instance.ticketsAvailable !== null && (
                                <span className="text-blue-600">
                                  {instance.ticketsAvailable} tickets max
                                </span>
                              )}
                            </div>

                            {/* Event ID */}
                            <div className="mt-2">
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                {instance.id}
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex-shrink-0">
                            {instance.isCanceled ? (
                              <button
                                disabled
                                className="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed text-sm font-medium"
                              >
                                Canceled
                              </button>
                            ) : instance.isUserEvent ? (
                              <button
                                disabled
                                className="px-4 py-2 bg-green-100 text-green-700 rounded-md cursor-default text-sm font-medium"
                              >
                                Already Added
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onSelectInstance(instance.id);
                                  onClose();
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                              >
                                Add This Time
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
