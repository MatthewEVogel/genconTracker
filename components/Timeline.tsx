import { useState } from 'react';

interface Event {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  eventType?: string;
  location?: string;
  cost?: string;
  ticketsAvailable?: number;
}

interface User {
  id: string;
  name: string;
  events: Event[];
}

interface TimelineProps {
  scheduleData: User[];
  currentUser: { id: string; name: string };
  selectedDay: string;
  onAddEvent: (eventId: string) => void;
  onRemoveEvent: (eventId: string) => void;
  userEventIds: string[];
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 8); // 8 AM to 12 AM (midnight)

const formatTime = (hour: number) => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

const parseDateTime = (dateTimeStr: string) => {
  if (!dateTimeStr) return null;
  try {
    return new Date(dateTimeStr);
  } catch {
    return null;
  }
};

const getEventPosition = (startTime: Date, endTime: Date) => {
  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;
  
  // Convert to grid positions (8 AM = 0, 9 AM = 1, etc.)
  const startPos = Math.max(0, startHour - 8);
  const endPos = Math.min(17, endHour - 8);
  
  return {
    left: `${(startPos / 17) * 100}%`,
    width: `${((endPos - startPos) / 17) * 100}%`
  };
};

const checkConflicts = (events: Event[], targetEvent: Event) => {
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
  userEventIds 
}: TimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Filter events for the selected day
  const filterEventsByDay = (events: Event[]) => {
    return events.filter(event => {
      const eventDate = parseDateTime(event.startDateTime);
      if (!eventDate) return false;
      
      const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      return dayOfWeek === selectedDay;
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
        <div className="flex-1">
          {/* Timeline Header */}
          <div className="relative mb-4">
            <div className="grid grid-cols-17 gap-0 text-xs text-gray-500 border-b pb-2">
              {HOURS.map(hour => (
                <div key={hour} className="text-center">
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
                  <div className="relative h-16 bg-gray-50 rounded border">
                    <div className="absolute inset-0 grid grid-cols-17 gap-0">
                      {HOURS.map(hour => (
                        <div key={hour} className="border-r border-gray-200 last:border-r-0" />
                      ))}
                    </div>

                    {/* Events */}
                    {userEvents.map((event, eventIndex) => {
                      const startTime = parseDateTime(event.startDateTime);
                      const endTime = parseDateTime(event.endDateTime);
                      
                      if (!startTime || !endTime) return null;
                      
                      const position = getEventPosition(startTime, endTime);
                      const conflicts = isCurrentUser ? checkConflicts(currentUserEvents, event) : [];
                      const hasConflict = conflicts.length > 0;
                      const isUserEvent = userEventIds.includes(event.id);
                      
                      return (
                        <div
                          key={event.id}
                          className={`absolute top-1 bottom-1 rounded px-2 py-1 text-xs cursor-pointer transition-all hover:shadow-md ${
                            hasConflict 
                              ? 'bg-red-500 text-white z-20' 
                              : isCurrentUser 
                                ? 'bg-blue-500 text-white z-10' 
                                : 'bg-green-500 text-white z-0'
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
          </div>
        </div>
      )}
    </div>
  );
}
