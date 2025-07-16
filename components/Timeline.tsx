import { useState, useEffect } from 'react';
import { ScheduleUser, ScheduleEvent, ScheduleService } from '@/lib/services/client/scheduleService';
import ScheduleEventTooltip from '@/components/ScheduleEventTooltip';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  genConName: string;
  isAdmin: boolean;
}

interface TimelineProps {
  scheduleData: ScheduleUser[];
  currentUser: { id: string; name: string };
  selectedDay: string;
  onAddEvent: (eventId: string) => void;
  onRemoveEvent: (eventId: string) => void;
  userEventIds: string[];
  onTrackEvent?: (eventId: string) => void;
  onUntrackEvent?: (eventId: string) => void;
  userTrackedEventIds?: string[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 12 AM to 11 PM (24-hour view)

const formatTime = (hour: number) => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

// Generate consistent color for an event based on its ID
const getEventColor = (eventId: string) => {
  // Simple hash function to convert eventId to a number
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    const char = eventId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value to ensure positive number
  hash = Math.abs(hash);
  
  // Define a set of visually distinct colors (avoiding red which is reserved for conflicts)
  const colors = [
    'bg-blue-500',    // Blue
    'bg-green-500',   // Green  
    'bg-purple-500',  // Purple
    'bg-yellow-500',  // Yellow
    'bg-indigo-500',  // Indigo
    'bg-pink-500',    // Pink
    'bg-teal-500',    // Teal
    'bg-orange-500',  // Orange
    'bg-cyan-500',    // Cyan
    'bg-lime-500',    // Lime
    'bg-emerald-500', // Emerald
    'bg-violet-500',  // Violet
    'bg-sky-500',     // Sky
    'bg-rose-500',    // Rose
    'bg-amber-500',   // Amber
    'bg-slate-500',   // Slate
  ];
  
  // Use hash to select color from array
  return colors[hash % colors.length];
};

const parseDateTime = (dateTimeStr: string | null) => {
  if (!dateTimeStr) return null;
  try {
    return new Date(dateTimeStr);
  } catch {
    return null;
  }
};

const getEventPosition = (startTime: Date, endTime: Date, selectedDay: string) => {
  let displayStartHour = startTime.getHours() + startTime.getMinutes() / 60;
  let displayEndHour = endTime.getHours() + endTime.getMinutes() / 60;
  
  // Get the day of week for both start and end times
  const eventStartDayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' });
  const eventEndDayOfWeek = endTime.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Handle multi-day events
  if (eventStartDayOfWeek !== selectedDay && eventEndDayOfWeek === selectedDay) {
    // Event started on a different day, show from midnight
    displayStartHour = 0;
  } else if (eventStartDayOfWeek === selectedDay && eventEndDayOfWeek !== selectedDay) {
    // Event ends on a different day, show until midnight
    displayEndHour = 24;
  } else if (eventStartDayOfWeek !== selectedDay && eventEndDayOfWeek !== selectedDay) {
    // Event spans across this day (starts before, ends after)
    displayStartHour = 0;
    displayEndHour = 24;
  }
  
  // Ensure positions are within bounds
  const startPos = Math.max(0, Math.min(24, displayStartHour));
  const endPos = Math.max(startPos, Math.min(24, displayEndHour));
  
  return {
    left: `${(startPos / 24) * 100}%`,
    width: `${((endPos - startPos) / 24) * 100}%`
  };
};


const checkConflicts = (events: ScheduleEvent[], targetEvent: ScheduleEvent) => {
  const targetStart = parseDateTime(targetEvent.startDateTime);
  const targetEnd = parseDateTime(targetEvent.endDateTime);
  
  if (!targetStart || !targetEnd) return [];
  
  return events.filter(event => {
    if (event.id === targetEvent.id) return false;
    
    const eventStart = parseDateTime(event.startDateTime);
    const eventEnd = parseDateTime(event.endDateTime);
    
    if (!eventStart || !eventEnd) return false;
    
    // Check for overlap
    return targetStart < eventEnd && targetEnd > eventStart;
  });
};

export default function Timeline({ 
  scheduleData, 
  currentUser, 
  selectedDay, 
  onAddEvent, 
  onRemoveEvent,
  userEventIds,
  onTrackEvent,
  onUntrackEvent,
  userTrackedEventIds = []
}: TimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string>('');

  // Clear selected event when day changes to prevent overlapping/stale modals
  useEffect(() => {
    setSelectedEvent(null);
    setShowTransferModal(false);
  }, [selectedDay]);

  // Load users when transfer modal is opened
  useEffect(() => {
    if (showTransferModal) {
      loadUsers();
    }
  }, [showTransferModal]);

  const loadUsers = async () => {
    try {
      const response = await ScheduleService.getAllUsers();
      setUsers(response.users.filter(user => user.id !== currentUser.id)); // Exclude current user
    } catch (error) {
      console.error('Error loading users:', error);
      setTransferError('Failed to load users');
    }
  };

  const handleTransferEvent = async () => {
    if (!selectedEvent || !selectedUserId) return;

    setTransferLoading(true);
    setTransferError('');

    try {
      await ScheduleService.transferEvent(selectedEvent.id, currentUser.id, selectedUserId);
      
      // Close modals and refresh data
      setShowTransferModal(false);
      setSelectedEvent(null);
      setSelectedUserId('');
      
      // Trigger a refresh of the schedule data
      window.location.reload(); // Simple refresh - could be improved with proper state management
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Failed to transfer event');
    } finally {
      setTransferLoading(false);
    }
  };

  // Function to determine if current user can transfer an event
  const canTransferEvent = (event: ScheduleEvent): boolean => {
    // Check if it's in their desired events
    if (userEventIds.includes(event.id)) {
      return true;
    }

    // Check if it's a purchased event for the current user
    // Find the current user in the schedule data to check if this event belongs to them
    const currentUserData = scheduleData.find(user => user.id === currentUser.id);
    if (currentUserData && currentUserData.events.some(e => e.id === event.id)) {
      return true;
    }

    return false;
  };

  // Filter events for the selected day (including multi-day events)
  const filterEventsByDay = (events: ScheduleEvent[]) => {
    // If "All Days" is selected, show all events
    if (selectedDay === 'All Days') {
      return events;
    }
    
    return events.filter(event => {
      const startTime = parseDateTime(event.startDateTime);
      const endTime = parseDateTime(event.endDateTime);
      if (!startTime || !endTime) return false;
      
      // Get the day of week for the event start time
      const eventStartDayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' });
      const eventEndDayOfWeek = endTime.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Include event if it starts on selected day OR ends on selected day OR spans across the selected day
      if (eventStartDayOfWeek === selectedDay || eventEndDayOfWeek === selectedDay) {
        return true;
      }
      
      // For multi-day events that span the selected day (but don't start or end on it)
      // This is a more complex case, but for now we'll use the simpler approach above
      return false;
    });
  };

  // Get current user's events for conflict checking
  const currentUserData = scheduleData.find(user => user.id === currentUser.id);
  const currentUserEvents = currentUserData ? filterEventsByDay(currentUserData.events) : [];

  // Sort users with current user first
  const sortedUsers = scheduleData.sort((a, b) => {
    if (a.id === currentUser.id) return -1;
    if (b.id === currentUser.id) return 1;
    return 0;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {selectedDay} Schedule
        </h3>
        <div className="text-sm text-gray-600">
          Your events are shown at the top, followed by your friends' schedules
        </div>
      </div>

      {/* Main Layout: Names on left, Timeline on right */}
      <div className="flex">
        {/* Left Column: User Names */}
        <div className="w-48 flex-shrink-0 mr-4">
          {/* Header spacer to align with timeline header */}
          <div className="h-8 mb-4"></div>
          
          {/* User Names */}
          <div className="space-y-4">
            {sortedUsers.map((user) => {
              const userEvents = filterEventsByDay(user.events);
              const isCurrentUser = user.id === currentUser.id;
              
              return (
                <div key={user.id} className="h-16 flex items-center">
                  <div className="text-right w-full pr-2">
                    <div className={`font-medium ${isCurrentUser ? 'text-blue-600' : 'text-gray-700'}`}>
                      {user.name} {isCurrentUser && '(You)'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {userEvents.length} events
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Timeline */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {/* Timeline Header */}
          <div className="relative mb-4">
            <div className="grid grid-cols-24 gap-0 text-xs text-gray-500 border-b pb-2" style={{ minWidth: '1200px' }}>
              {HOURS.map(hour => (
                <div key={hour} className="text-center text-xs truncate">
                  {formatTime(hour)}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="space-y-4">
            {sortedUsers.map((user) => {
              const userEvents = filterEventsByDay(user.events);
              const isCurrentUser = user.id === currentUser.id;
              
              return (
                <div key={user.id} className="relative">
                  {/* Timeline Row */}
                  <div className="relative h-16 bg-gray-50 rounded border" style={{ minWidth: '1200px' }}>
                    <div className="absolute inset-0 grid grid-cols-24 gap-0">
                      {HOURS.map(hour => (
                        <div key={hour} className="border-r border-gray-200 last:border-r-0" />
                      ))}
                    </div>

                    {/* Events */}
                    {userEvents.map((event, eventIndex) => {
                      const startTime = parseDateTime(event.startDateTime);
                      const endTime = parseDateTime(event.endDateTime);
                      
                      if (!startTime || !endTime) return null;
                      
                      const position = getEventPosition(startTime, endTime, selectedDay);
                      const conflicts = isCurrentUser ? checkConflicts(currentUserEvents, event) : [];
                      const hasConflict = conflicts.length > 0;
                      const isUserEvent = userEventIds.includes(event.id);
                      const eventColor = getEventColor(event.id);
                      
                      return (
                        <ScheduleEventTooltip 
                          key={event.id} 
                          event={event} 
                          isUserEvent={isUserEvent}
                        >
                          <div
                            className={`absolute top-1 bottom-1 rounded px-2 py-1 text-xs cursor-pointer transition-all hover:shadow-md ${
                              hasConflict 
                                ? 'bg-red-500 text-white z-20'  // Red for conflicts (highest priority)
                                : `${eventColor} text-white ${isCurrentUser ? 'z-10' : 'z-0'}`  // Event-based color
                            }`}
                            style={position}
                            onClick={() => setSelectedEvent(event)}
                          >
                            <div className="font-medium truncate">{event.title}</div>
                            <div className="truncate opacity-75">
                              {startTime.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </div>
                          </div>
                        </ScheduleEventTooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedEvent.title}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="font-medium text-gray-700">Time: </span>
                <span className="text-gray-600">
                  {parseDateTime(selectedEvent.startDateTime)?.toLocaleString()} - {' '}
                  {parseDateTime(selectedEvent.endDateTime)?.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              
              {selectedEvent.eventType && (
                <div>
                  <span className="font-medium text-gray-700">Type: </span>
                  <span className="text-gray-600">{selectedEvent.eventType}</span>
                </div>
              )}
              
              {selectedEvent.location && (
                <div>
                  <span className="font-medium text-gray-700">Location: </span>
                  <span className="text-gray-600">{selectedEvent.location}</span>
                </div>
              )}
              
              {selectedEvent.cost && (
                <div>
                  <span className="font-medium text-gray-700">Cost: </span>
                  <span className="text-gray-600">${selectedEvent.cost}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex space-x-3">
                {userEventIds.includes(selectedEvent.id) ? (
                  <button
                    onClick={() => {
                      onRemoveEvent(selectedEvent.id);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    Remove Event
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onAddEvent(selectedEvent.id);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Add Event
                  </button>
                )}
                
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
                >
                  Close
                </button>
              </div>
              
              {/* Tracking Button */}
              {onTrackEvent && onUntrackEvent && (
                <div className="flex space-x-3">
                  {userTrackedEventIds.includes(selectedEvent.id) ? (
                    <button
                      onClick={() => {
                        onUntrackEvent(selectedEvent.id);
                        setSelectedEvent(null);
                      }}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Stop Tracking Changes
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onTrackEvent(selectedEvent.id);
                        setSelectedEvent(null);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.197m0 0v1M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Track Changes
                    </button>
                  )}
                </div>
              )}

              {/* Change Recipient Button - Show for events the current user can transfer */}
              {canTransferEvent(selectedEvent) && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowTransferModal(true);
                      setTransferError('');
                      setSelectedUserId('');
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Change Recipient
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Event Modal */}
      {showTransferModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-purple-600">
                Change Event Recipient
              </h3>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferError('');
                  setSelectedUserId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Transfer "{selectedEvent.title}" to:
              </p>
              
              {transferError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">{transferError}</p>
                </div>
              )}

              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={transferLoading}
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.genConName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleTransferEvent}
                disabled={!selectedUserId || transferLoading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transferLoading ? 'Transferring...' : 'Transfer Event'}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferError('');
                  setSelectedUserId('');
                }}
                disabled={transferLoading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
