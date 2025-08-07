import { useState, useEffect } from 'react';
import { ScheduleUser, ScheduleEvent, ScheduleService } from '@/lib/services/client/scheduleService';
import ScheduleEventTooltip from '@/components/ScheduleEventTooltip';
import { PersonalEventModal } from '@/components/PersonalEventModal';
import { personalEventService, PersonalEvent } from '@/lib/services/client/personalEventService';

// Custom hook to detect screen size
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

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

// Full 24-hour array for both mobile and desktop
const getHoursArray = (isMobile: boolean) => {
  return Array.from({ length: 24 }, (_, i) => i); // 12 AM to 11 PM (both mobile and desktop)
};

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

const getEventPosition = (startTime: Date, endTime: Date, selectedDay: string, isMobile: boolean = false) => {
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
  
  // Full 24-hour range for both mobile and desktop
  const startHour = 0;  // 12 AM for both
  const totalHours = 24; // 24 hours for both
  
  // Clamp to visible range
  const clampedStartHour = Math.max(startHour, Math.min(startHour + totalHours, displayStartHour));
  const clampedEndHour = Math.max(clampedStartHour, Math.min(startHour + totalHours, displayEndHour));
  
  // Calculate relative position within visible range
  const relativeStart = clampedStartHour - startHour;
  const relativeEnd = clampedEndHour - startHour;
  
  return {
    left: `${(relativeStart / totalHours) * 100}%`,
    width: `${((relativeEnd - relativeStart) / totalHours) * 100}%`
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
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [allPersonalEvents, setAllPersonalEvents] = useState<PersonalEvent[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; firstName: string; lastName: string; genConName: string }>>([]);
  const [isPersonalEventModalOpen, setIsPersonalEventModalOpen] = useState(false);
  const [modalInitialTime, setModalInitialTime] = useState<Date | undefined>();
  const [isLoadingPersonalEvents, setIsLoadingPersonalEvents] = useState(true);
  const [editingEvent, setEditingEvent] = useState<PersonalEvent | null>(null);
  
  // Use mobile detection hook
  const isMobile = useIsMobile();
  
  // Get responsive hours array
  const HOURS = getHoursArray(isMobile);

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

  // Load personal events for all users and users list on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingPersonalEvents(true);
        
        // Load personal events for current user (for editing/deleting)
        const events = await personalEventService.getPersonalEvents(currentUser.id);
        setPersonalEvents(events);

        // Load all users for attendee selection and to get their personal events
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setAllUsers(usersData.users || []);
          
          // Load personal events for all users
          const allPersonalEventsPromises = usersData.users.map(async (user: any) => {
            try {
              const userEvents = await personalEventService.getPersonalEvents(user.id);
              return userEvents;
            } catch (error) {
              console.error(`Failed to load personal events for user ${user.id}:`, error);
              return [];
            }
          });
          
          const allPersonalEventsArrays = await Promise.all(allPersonalEventsPromises);
          const flattenedPersonalEvents = allPersonalEventsArrays.flat();
          setAllPersonalEvents(flattenedPersonalEvents);
        }
      } catch (error) {
        console.error('Failed to load personal events or users:', error);
      } finally {
        setIsLoadingPersonalEvents(false);
      }
    };

    loadData();
  }, [currentUser.id]);

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
      // Find the actual owner of the event
      let fromUserId = '';
      for (const user of scheduleData) {
        if (user.events.some(event => event.id === selectedEvent.id)) {
          fromUserId = user.id;
          break;
        }
      }

      if (!fromUserId) {
        throw new Error('Could not find the owner of this event');
      }

      await ScheduleService.transferEvent(selectedEvent.id, fromUserId, selectedUserId);
      
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

  // Handle personal event creation
  const handlePersonalEventCreated = (newEvent: PersonalEvent) => {
    setPersonalEvents(prev => [...prev, newEvent]);
    setAllPersonalEvents(prev => [...prev, newEvent]);
    setIsPersonalEventModalOpen(false);
  };

  // Handle personal event update
  const handlePersonalEventUpdated = (updatedEvent: PersonalEvent) => {
    setPersonalEvents(prev => 
      prev.map(event => event.id === updatedEvent.id ? updatedEvent : event)
    );
    setAllPersonalEvents(prev => 
      prev.map(event => event.id === updatedEvent.id ? updatedEvent : event)
    );
    setEditingEvent(null);
    setIsPersonalEventModalOpen(false);
  };

  // Handle personal event deletion
  const handleDeletePersonalEvent = async (eventId: string) => {
    try {
      await personalEventService.deletePersonalEvent(eventId);
      setPersonalEvents(prev => prev.filter(event => event.id !== eventId));
      setAllPersonalEvents(prev => prev.filter(event => event.id !== eventId));
      setSelectedEvent(null);
    } catch (error) {
      console.error('Failed to delete personal event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };

  // Handle editing a personal event
  const handleEditPersonalEvent = (event: ScheduleEvent) => {
    // Find the corresponding personal event
    const personalEventId = event.id.replace('personal-', '');
    const personalEvent = personalEvents.find(pe => pe.id === personalEventId);
    
    if (personalEvent) {
      setEditingEvent(personalEvent);
      setIsPersonalEventModalOpen(true);
      setSelectedEvent(null);
    }
  };

  // Handle clicking on timeline to create personal event
  const handleTimelineClick = (event: React.MouseEvent, dayDate: Date) => {
    // Only handle clicks on the current user's row and only if not clicking on an event
    const target = event.target as HTMLElement;
    if (target.closest('.event-item')) {
      return; // Clicked on an event, not empty space
    }

    // Calculate time based on click position within the timeline
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const containerWidth = rect.width;
    
    // Map click position to hour (0-24)
    const clickRatio = Math.max(0, Math.min(1, clickX / containerWidth));
    const clickHour = clickRatio * 24;
    
    // Create initial time for the modal
    const initialTime = new Date(dayDate);
    initialTime.setHours(Math.floor(clickHour), 0, 0, 0);
    
    setModalInitialTime(initialTime);
    setIsPersonalEventModalOpen(true);
  };

  // Function to determine if current user can transfer an event
  const canTransferEvent = (event: ScheduleEvent): boolean => {
    // Anyone can transfer any event
    return true;
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

  // Convert personal events to ScheduleEvent format for display
  const personalEventsAsScheduleEvents: ScheduleEvent[] = personalEvents
    .filter(event => {
      if (selectedDay === 'All Days') return true;
      const startTime = parseDateTime(event.startTime);
      if (!startTime) return false;
      const eventDayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' });
      return eventDayOfWeek === selectedDay;
    })
    .map(event => ({
      id: `personal-${event.id}`,
      title: event.title,
      startDateTime: event.startTime,
      endDateTime: event.endTime,
      location: event.location || '',
      eventType: 'Personal Event',
      cost: null,
      isPersonalEvent: true
    }));

  // Get current user's events for conflict checking (including personal events)
  const currentUserData = scheduleData.find(user => user.id === currentUser.id);
  const currentUserGenConEvents = currentUserData ? filterEventsByDay(currentUserData.events) : [];
  const currentUserEvents = [...currentUserGenConEvents, ...personalEventsAsScheduleEvents];

  // Create enhanced schedule data that includes personal events for ALL users where they are attendees
  const enhancedScheduleData = scheduleData.map(user => {
    // Get personal events where this user is either creator or attendee
    const userPersonalEvents = allPersonalEvents
      .filter(event => {
        // Include if user is creator OR if user is in attendees array
        return event.createdBy === user.id || event.attendees.includes(user.id);
      })
      .filter(event => {
        // Filter by selected day
        if (selectedDay === 'All Days') return true;
        const startTime = parseDateTime(event.startTime);
        if (!startTime) return false;
        const eventDayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' });
        return eventDayOfWeek === selectedDay;
      })
      // Remove duplicates by event ID (in case user is both creator and attendee)
      .filter((event, index, array) => 
        array.findIndex(e => e.id === event.id) === index
      )
      .map(event => ({
        id: `personal-${event.id}`,
        title: event.title,
        startDateTime: event.startTime,
        endDateTime: event.endTime,
        location: event.location || '',
        eventType: 'Personal Event',
        cost: null,
        isPersonalEvent: true
      }));

    return {
      ...user,
      events: [...user.events, ...userPersonalEvents]
    };
  });

  // Sort users with current user first
  const sortedUsers = enhancedScheduleData.sort((a, b) => {
    if (a.id === currentUser.id) return -1;
    if (b.id === currentUser.id) return 1;
    return 0;
  });

  // Helper function to get the date for a specific day
  // TODO: Make this automatically get the correct date of the current GenCon
  const getDateForDay = (dayName: string) => {
    if (dayName === 'All Days') return new Date(); // Default to today for All Days
    
    const dayIndex = ['Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dayName);
    if (dayIndex === -1) return new Date();
    
    // GenCon 2025 dates: Thursday July 31 - Sunday August 3
    const genconStartDate = new Date(2025, 6, 31); // Month is 0-indexed, so 6 = July
    
    // Add the day index to get the specific day
    const targetDate = new Date(genconStartDate);
    targetDate.setDate(genconStartDate.getDate() + dayIndex);
    
    return targetDate;
  };

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

      {/* Mobile: Names Above Individual Timelines */}
      {isMobile ? (
        <div className="space-y-3">
          {sortedUsers.map((user) => {
            const userEvents = filterEventsByDay(user.events);
            const isCurrentUser = user.id === currentUser.id;
            
            return (
              <div key={user.id} className="relative">
                {/* User Name Above Timeline */}
                <div className="mb-2 flex items-center justify-between">
                  <div className={`font-medium text-sm ${isCurrentUser ? 'text-blue-600' : 'text-gray-700'}`}>
                    {user.name} {isCurrentUser && '(You)'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {userEvents.length} events
                  </div>
                </div>

                {/* Individual Timeline with Header */}
                <div className="overflow-x-auto" ref={(el) => {
                  // Set default scroll position to 1 PM (13th hour) on mount
                  if (el && isMobile) {
                    const scrollPosition = (13 / 24) * el.scrollWidth;
                    el.scrollLeft = scrollPosition;
                  }
                }}>
                  <div style={{ minWidth: '1200px' }}>
                    {/* Timeline Header for this user - inside the scrollable container */}
                    <div className="gap-0 text-xs text-gray-500 border-b pb-1 mb-2 grid-cols-24 grid">
                      {HOURS.map(hour => (
                        <div key={hour} className="text-center text-xs truncate">
                          {formatTime(hour)}
                        </div>
                      ))}
                    </div>

                    {/* Timeline Row */}
                    <div 
                      className={`relative h-16 bg-gray-50 rounded border ${isCurrentUser ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                      onClick={isCurrentUser ? (e) => handleTimelineClick(e, getDateForDay(selectedDay)) : undefined}
                    >
                      <div className="absolute inset-0 gap-0 grid-cols-24 grid">
                        {HOURS.map(hour => (
                          <div key={hour} className="border-r border-gray-200 last:border-r-0" />
                        ))}
                      </div>

                      {/* Events */}
                      {userEvents.map((event, eventIndex) => {
                      const startTime = parseDateTime(event.startDateTime);
                      const endTime = parseDateTime(event.endDateTime);
                      
                      if (!startTime || !endTime) return null;
                      
                      const position = getEventPosition(startTime, endTime, selectedDay, isMobile);
                      const conflicts = isCurrentUser ? checkConflicts(currentUserEvents, event) : [];
                      const hasConflict = conflicts.length > 0;
                      const isUserEvent = userEventIds.includes(event.id);
                      const isPersonalEvent = event.id.startsWith('personal-');
                      const eventColor = getEventColor(event.id);
                      
                      return (
                        <ScheduleEventTooltip 
                          key={event.id} 
                          event={event} 
                          isUserEvent={isUserEvent}
                          disabled={selectedEvent !== null || showTransferModal || isPersonalEventModalOpen}
                        >
                          <div
                            className={`event-item absolute top-1 bottom-1 rounded px-2 py-1 text-xs cursor-pointer transition-all hover:shadow-md ${
                              hasConflict 
                                ? 'bg-red-500 text-white z-20'  // Red for conflicts (highest priority)
                                : isPersonalEvent
                                ? 'bg-purple-500 text-white z-15'  // Purple for personal events
                                : `${eventColor} text-white ${isCurrentUser ? 'z-10' : 'z-0'}`  // Event-based color
                            }`}
                            style={position}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <div className="font-medium truncate flex-1">{event.title}</div>
                              {isPersonalEvent && (
                                <span className="text-xs bg-white bg-opacity-20 px-1 rounded">P</span>
                              )}
                            </div>
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

                      {/* Click instruction for current user's row */}
                      {isCurrentUser && userEvents.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs pointer-events-none">
                          Click to add a personal event
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop: Original Layout with Names on Left, Timeline on Right */
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
                    <div 
                      className={`relative h-16 bg-gray-50 rounded border ${isCurrentUser ? 'cursor-pointer hover:bg-gray-100' : ''}`} 
                      style={{ minWidth: '1200px' }}
                      onClick={isCurrentUser ? (e) => handleTimelineClick(e, getDateForDay(selectedDay)) : undefined}
                    >
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
                        
                        const position = getEventPosition(startTime, endTime, selectedDay, isMobile);
                        const conflicts = isCurrentUser ? checkConflicts(currentUserEvents, event) : [];
                        const hasConflict = conflicts.length > 0;
                        const isUserEvent = userEventIds.includes(event.id);
                        const isPersonalEvent = event.id.startsWith('personal-');
                        const eventColor = getEventColor(event.id);
                        
                        return (
                          <ScheduleEventTooltip 
                            key={event.id} 
                            event={event} 
                            isUserEvent={isUserEvent}
                            disabled={selectedEvent !== null || showTransferModal || isPersonalEventModalOpen}
                          >
                            <div
                              className={`event-item absolute top-1 bottom-1 rounded px-2 py-1 text-xs cursor-pointer transition-all hover:shadow-md ${
                                hasConflict 
                                  ? 'bg-red-500 text-white z-20'  // Red for conflicts (highest priority)
                                  : isPersonalEvent
                                  ? 'bg-purple-500 text-white z-15'  // Purple for personal events
                                  : `${eventColor} text-white ${isCurrentUser ? 'z-10' : 'z-0'}`  // Event-based color
                              }`}
                              style={position}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <div className="font-medium truncate flex-1">{event.title}</div>
                                {isPersonalEvent && (
                                  <span className="text-xs bg-white bg-opacity-20 px-1 rounded">P</span>
                                )}
                              </div>
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

                      {/* Click instruction for current user's row */}
                      {isCurrentUser && userEvents.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs pointer-events-none">
                          Click to add a personal event
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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
              {selectedEvent.isPersonalEvent ? (
                // Personal event actions
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleEditPersonalEvent(selectedEvent)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Edit Event
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this event?')) {
                        const personalEventId = selectedEvent.id.replace('personal-', '');
                        handleDeletePersonalEvent(personalEventId);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    Delete Event
                  </button>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                // GenCon event actions
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
              )}
              
              {/* Tracking Button - Only for GenCon events */}
              {!selectedEvent.isPersonalEvent && onTrackEvent && onUntrackEvent && (
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

              {/* Change Recipient Button - Only for GenCon events */}
              {!selectedEvent.isPersonalEvent && canTransferEvent(selectedEvent) && (
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
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setShowTransferModal(false);
            setTransferError('');
            setSelectedUserId('');
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* Personal Event Creation/Edit Modal */}
      {isPersonalEventModalOpen && (
        <PersonalEventModal
          isOpen={isPersonalEventModalOpen}
          onClose={() => {
            setIsPersonalEventModalOpen(false);
            setEditingEvent(null);
          }}
          onEventCreated={editingEvent ? handlePersonalEventUpdated : handlePersonalEventCreated}
          initialStartTime={modalInitialTime}
          currentUserId={currentUser.id}
          allUsers={allUsers}
          editingEvent={editingEvent}
        />
      )}
    </div>
  );
}
