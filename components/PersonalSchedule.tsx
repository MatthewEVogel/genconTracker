import { useState, useEffect } from 'react';
import { ScheduleEvent, ScheduleService, ScheduleUser } from '@/lib/services/client/scheduleService';
import { EventService } from '@/lib/services/client/eventService';
import ScheduleEventTooltip from '@/components/ScheduleEventTooltip';

interface PersonalScheduleProps {
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

const DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday'];

// Generate consistent color for an event based on its ID
const getEventColor = (eventId: string) => {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    const char = eventId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  hash = Math.abs(hash);
  
  const colors = [
    'border-blue-500',
    'border-green-500',
    'border-purple-500',
    'border-yellow-500',
    'border-indigo-500',
    'border-pink-500',
    'border-teal-500',
    'border-orange-500',
    'border-cyan-500',
    'border-lime-500',
    'border-emerald-500',
    'border-violet-500',
    'border-sky-500',
    'border-rose-500',
    'border-amber-500',
    'border-slate-500',
  ];
  
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

const formatDate = (date: Date) => {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const dayNum = date.getDate();
  return `${dayName} — ${month} ${dayNum}`;
};

const formatTime = (startTime: Date, endTime: Date) => {
  const formatSingleTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Check if it's an all-day event (starts at midnight and ends at midnight next day, or very long duration)
  const duration = endTime.getTime() - startTime.getTime();
  const isAllDay = duration >= 20 * 60 * 60 * 1000; // 20+ hours considered all-day

  if (isAllDay) {
    return 'all-day';
  }

  const startStr = formatSingleTime(startTime);
  const endStr = formatSingleTime(endTime);
  
  return `${startStr}\n${endStr}`;
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

export default function PersonalSchedule({
  scheduleData,
  currentUser,
  selectedDay,
  onAddEvent,
  onRemoveEvent,
  userEventIds,
  onTrackEvent,
  onUntrackEvent,
  userTrackedEventIds = []
}: PersonalScheduleProps) {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  // Clear selected event when day changes
  useEffect(() => {
    setSelectedEvent(null);
  }, [selectedDay]);

  // Get current user's events from scheduleData
  const currentUserData = scheduleData.find(user => user.id === currentUser.id);
  const userEvents = currentUserData ? currentUserData.events : [];

  // Group events by day
  const groupEventsByDay = () => {
    const grouped: { [key: string]: ScheduleEvent[] } = {};
    
    // Initialize all days
    DAYS.forEach(day => {
      grouped[day] = [];
    });

    userEvents.forEach(event => {
      const startTime = parseDateTime(event.startDateTime);
      if (!startTime) return;

      const dayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' });
      if (grouped[dayOfWeek]) {
        grouped[dayOfWeek].push(event);
      }
    });

    // Sort events within each day by start time
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => {
        const aStart = parseDateTime(a.startDateTime);
        const bStart = parseDateTime(b.startDateTime);
        if (!aStart || !bStart) return 0;
        return aStart.getTime() - bStart.getTime();
      });
    });

    return grouped;
  };

  const eventsByDay = groupEventsByDay();

  // Always show all days in Personal Schedule, ignore selectedDay filter
  const daysToShow = DAYS;
  const filteredEventsByDay = Object.fromEntries(
    daysToShow.map(day => [day, eventsByDay[day] || []])
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Your Personal Schedule
        </h3>
        <div className="text-sm text-gray-600">
          Your complete GenCon schedule
        </div>
      </div>

      <div className="space-y-10">
        {daysToShow.map(day => {
          const dayEvents = filteredEventsByDay[day] || [];
          
          // Get the date for this day (GenCon dates - first Thursday of August in current year)
          const getDateForDay = (dayName: string) => {
            const dayIndex = DAYS.indexOf(dayName);
            const currentYear = new Date().getFullYear();
            
            // Find the first Thursday of August in the current year
            const firstOfAugust = new Date(currentYear, 7, 1); // Month is 0-indexed, so 7 = August
            const firstThursday = new Date(firstOfAugust);
            
            // Calculate days until Thursday (4 = Thursday, 0 = Sunday)
            const daysUntilThursday = (4 - firstOfAugust.getDay() + 7) % 7;
            firstThursday.setDate(1 + daysUntilThursday);
            
            // Add the day index to get the specific day
            const targetDate = new Date(firstThursday);
            targetDate.setDate(firstThursday.getDate() + dayIndex);
            
            return targetDate;
          };

          const dayDate = getDateForDay(day);

          return (
            <div key={day} className="border-b-2 border-gray-200 last:border-b-0 pb-8 last:pb-0">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border-l-4 border-blue-500">
                <h4 className="text-xl font-bold text-gray-900 mb-1">
                  {formatDate(dayDate)}
                </h4>
                <div className="text-sm text-gray-600">
                  {dayEvents.length === 0 ? 'No events scheduled' : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                </div>
              </div>
              
              {dayEvents.length === 0 ? (
                <div className="text-gray-500 italic py-8 text-center bg-gray-50 rounded-lg">
                  No events scheduled for this day
                </div>
              ) : (
                <div className="space-y-4">
                  {dayEvents.map(event => {
                    const startTime = parseDateTime(event.startDateTime);
                    const endTime = parseDateTime(event.endDateTime);
                    
                    if (!startTime || !endTime) return null;

                    const eventColor = getEventColor(event.id);
                    const conflicts = checkConflicts(userEvents, event);
                    const hasConflict = conflicts.length > 0;
                    const isUserEvent = userEventIds.includes(event.id);
                    const timeDisplay = formatTime(startTime, endTime);
                    const isAllDay = timeDisplay === 'all-day';

                    return (
                      <ScheduleEventTooltip 
                        key={event.id} 
                        event={event} 
                        isUserEvent={isUserEvent}
                      >
                        <div
                          className={`bg-white border-l-4 ${
                            hasConflict ? 'border-red-500' : eventColor
                          } rounded-r-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4 border border-gray-100`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 truncate">
                                {event.title}
                              </h5>
                              {event.location && (
                                <p className="text-sm text-gray-600 mt-1 flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {event.location}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              {isAllDay ? (
                                <span className="text-sm font-medium text-gray-700">
                                  all-day
                                </span>
                              ) : (
                                <div className="text-sm font-medium text-gray-700 whitespace-pre-line">
                                  {timeDisplay}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {hasConflict && (
                            <div className="mt-2 text-xs text-red-600 font-medium">
                              ⚠️ Conflicts with other events
                            </div>
                          )}
                        </div>
                      </ScheduleEventTooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
