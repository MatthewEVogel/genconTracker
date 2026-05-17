import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useUserStore from "@/store/useUserStore";
import Navigation from "@/components/Navigation";
import { EventService, Event, Pagination } from "@/lib/services/client/eventService";
import { ScheduleService } from "@/lib/services/client/scheduleService";
import { useCustomAlerts } from "@/hooks/useCustomAlerts";
import EventTooltip from "@/components/EventTooltip";
import EventEditModal from "@/components/EventEditModal";
import { UserListService } from "@/lib/services/client/userListService";
import { EventsListService } from "@/lib/services/client/eventsListService";
import GroupedEventCard from "@/components/GroupedEventCard";
import { GroupedEvent } from "@/lib/services/server/eventsListService";

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

interface ConflictModal {
  show: boolean;
  eventId: string;
  eventTitle: string;
  conflicts: any[];
  capacityWarning: boolean;
}

interface PersonSelectorModal {
  show: boolean;
  eventId: string;
  eventTitle: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  genConName: string;
}

interface FilterOptions {
  ageRatings: string[];
  eventTypes: string[];
}

const DAYS = ['All Days', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function EventsPage() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const { customAlert, AlertComponent } = useCustomAlerts();
  const [events, setEvents] = useState<Event[]>([]);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvent[]>([]);
  const [isGroupedMode, setIsGroupedMode] = useState(true); // Default to grouped
  const [userEventIds, setUserEventIds] = useState<string[]>([]);
  const [userTrackedEventIds, setUserTrackedEventIds] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('All Days');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedAgeRatings, setSelectedAgeRatings] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ ageRatings: [], eventTypes: [] });
  
  const [conflictModal, setConflictModal] = useState<ConflictModal>({
    show: false,
    eventId: '',
    eventTitle: '',
    conflicts: [],
    capacityWarning: false
  });

  // Person selector for adding events
  const [personSelectorModal, setPersonSelectorModal] = useState<PersonSelectorModal>({
    show: false,
    eventId: '',
    eventTitle: ''
  });
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Admin functionality
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Event detail modal
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);
  const [groupedEventData, setGroupedEventData] = useState<{ title: string; instances: any[] } | null>(null);
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState(0);

  // Use mobile detection hook
  const isMobile = useIsMobile();

  useEffect(() => {
    // Redirect to login if no user is logged in
    if (!user) {
      router.push("/");
      return;
    }

    // Fetch user events, filter options, and all users
    const init = async () => {
      await fetchAllUsers(); // Fetch users first
      await fetchUserEvents();
      await fetchFilterOptions();
      await checkAdminStatus();
    };
    init();
  }, [user, router]);

  // Set default selected user when allUsers loads
  useEffect(() => {
    if (user && allUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(user.id);
    }
  }, [allUsers, user]);

  useEffect(() => {
    // Fetch events when any filter changes or grouped mode changes
    fetchEvents();
  }, [selectedDay, currentPage, searchTerm, startTime, endTime, selectedAgeRatings, selectedEventTypes, isGroupedMode]);

  const fetchFilterOptions = async () => {
    try {
      const data = await EventService.getFilterOptions();
      setFilterOptions(data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '100',
        ...(selectedDay !== 'All Days' && { day: selectedDay }),
        ...(searchTerm.trim() && { search: searchTerm.trim() }),
        ...(startTime.trim() && { startTime: startTime.trim() }),
        ...(endTime.trim() && { endTime: endTime.trim() }),
        ...(selectedAgeRatings.length > 0 && { ageRatings: selectedAgeRatings.join(',') }),
        ...(selectedEventTypes.length > 0 && { eventTypes: selectedEventTypes.join(',') }),
        ...(isGroupedMode && { grouped: 'true' }),
      });

      const response = await fetch(`/api/events-list?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }

      if (isGroupedMode) {
        setGroupedEvents(data.events);
        setEvents([]); // Clear ungrouped events
      } else {
        setEvents(data.events);
        setGroupedEvents([]); // Clear grouped events
        
        // Update tracked event IDs from the events data
        const trackedIds = data.events.filter((event: any) => event.isTracked).map((event: any) => event.id);
        setUserTrackedEventIds(trackedIds);
      }
      
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserEvents = async () => {
    if (!user) return;
    
    try {
      const data = await ScheduleService.getUserEvents(user.id);
      setUserEventIds(data.userEvents.map((ue: any) => ue.event.id));
    } catch (err) {
      console.error('Error fetching user events:', err);
    }
  };

  const checkAdminStatus = async () => {
    try {
      // Check if the current user is an admin by looking them up in the user list
      if (user?.email) {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          const currentUser = data.users.find((u: any) => u.email === user.email);
          setIsAdmin(currentUser?.isAdmin || false);
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/user-list');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      const users = data.users.map((u: any) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        genConName: u.genConName
      }));
      setAllUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleEventClick = (event: Event, e: React.MouseEvent) => {
    // Prevent event click when clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    // Open event detail modal and set default recipient to current user
    setSelectedEvent(event);
    setIsEventDetailModalOpen(true);
    if (user) {
      setSelectedUserId(user.id);
    }
  };

  const handleCloseEventDetailModal = () => {
    setSelectedEvent(null);
    setIsEventDetailModalOpen(false);
    setGroupedEventData(null);
    setSelectedInstanceIndex(0);
    // Reset selected user to current user
    if (user) {
      setSelectedUserId(user.id);
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsEditModalOpen(true);
  };

  const handleEventSave = async (eventId: string, updates: any) => {
    setEditLoading(true);
    try {
      const response = await fetch('/api/admin/events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId: eventId, updates: updates }),
      });

      if (response.ok) {
        await fetchEvents(); // Refresh the events list
        setIsEditModalOpen(false);
        setEditingEvent(null);
        await customAlert('Event updated successfully!', 'Success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      await customAlert(error instanceof Error ? error.message : 'Failed to update event', 'Error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleEventDelete = async (eventId: string) => {
    setEditLoading(true);
    try {
      const response = await fetch('/api/admin/events', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId: eventId }),
      });

      if (response.ok) {
        await fetchEvents(); // Refresh the events list
        setIsEditModalOpen(false);
        setEditingEvent(null);
        await customAlert('Event deleted successfully!', 'Success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      await customAlert(error instanceof Error ? error.message : 'Failed to delete event', 'Error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingEvent(null);
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    setCurrentPage(1); // Reset to first page when changing day
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setSelectedDay('All Days');
    setStartTime('');
    setEndTime('');
    setSelectedAgeRatings([]);
    setSelectedEventTypes([]);
    setCurrentPage(1);
  };

  const handleAgeRatingChange = (rating: string, checked: boolean) => {
    if (checked) {
      setSelectedAgeRatings([...selectedAgeRatings, rating]);
    } else {
      setSelectedAgeRatings(selectedAgeRatings.filter(r => r !== rating));
    }
    setCurrentPage(1);
  };

  const handleEventTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setSelectedEventTypes([...selectedEventTypes, type]);
    } else {
      setSelectedEventTypes(selectedEventTypes.filter(t => t !== type));
    }
    setCurrentPage(1);
  };

  const handleTimeFilterChange = (field: 'startTime' | 'endTime', value: string) => {
    if (field === 'startTime') {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return searchTerm || selectedDay !== 'All Days' || startTime || endTime || 
           selectedAgeRatings.length > 0 || selectedEventTypes.length > 0;
  };

  const handleAddEvent = async (eventId: string) => {
    if (!user) return;

    // Use the selected user ID or default to current user
    const targetUserId = selectedUserId || user.id;

    try {
      const data = await ScheduleService.addUserEvent(targetUserId, eventId);

      // Check for conflicts or capacity warnings
      if ((data.conflicts && data.conflicts.length > 0) || data.capacityWarning) {
        const eventTitle = events.find(e => e.id === eventId)?.title || 'Unknown Event';
        setConflictModal({
          show: true,
          eventId,
          eventTitle,
          conflicts: data.conflicts || [],
          capacityWarning: data.capacityWarning || false
        });
        return;
      }

      // Success - refresh user events
      await fetchUserEvents();
      
      // Show success message with user name if different from current user
      const selectedUser = allUsers.find(u => u.id === targetUserId);
      const message = targetUserId === user.id 
        ? 'Event added to your schedule!'
        : `Event added to ${selectedUser?.firstName}'s schedule!`;
      await customAlert(message, 'Success');
    } catch (err) {
      await customAlert(err instanceof Error ? err.message : 'An error occurred', 'Error');
    }
  };

  const handleConfirmAddEvent = async () => {
    // The event was already added to the database, just refresh the UI
    await fetchUserEvents();
    setConflictModal({
      show: false,
      eventId: '',
      eventTitle: '',
      conflicts: [],
      capacityWarning: false
    });
    await customAlert('Event added to your schedule with conflicts noted!', 'Success');
  };

  const handleCancelAddEvent = async () => {
    // Remove the event that was just added
    if (!user) return;

    try {
      await ScheduleService.removeUserEvent(user.id, conflictModal.eventId);
    } catch (err) {
      console.error('Error removing event:', err);
    }

    setConflictModal({
      show: false,
      eventId: '',
      eventTitle: '',
      conflicts: [],
      capacityWarning: false
    });
  };

  // Handle escape key press for conflict modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && conflictModal.show) {
        handleCancelAddEvent();
      }
    };

    if (conflictModal.show) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [conflictModal.show]);

  const handleRemoveEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await ScheduleService.removeUserEvent(user.id, eventId);

      // Refresh user events
      await fetchUserEvents();
      
      // Show success message
      await customAlert('Event removed from your schedule!', 'Success');
    } catch (err) {
      await customAlert(err instanceof Error ? err.message : 'An error occurred', 'Error');
    }
  };

  const handleTrackEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await EventService.trackEvent(eventId);
      
      // Update local state
      setUserTrackedEventIds(prev => [...prev, eventId]);
      setEvents(prev => prev.map(event => 
        event.id === eventId ? { ...event, isTracked: true } : event
      ));
      
      await customAlert('Event tracking enabled!', 'Success');
    } catch (err) {
      await customAlert(err instanceof Error ? err.message : 'An error occurred', 'Error');
    }
  };

  const handleUntrackEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await EventService.untrackEvent(eventId);
      
      // Update local state
      setUserTrackedEventIds(prev => prev.filter(id => id !== eventId));
      setEvents(prev => prev.map(event => 
        event.id === eventId ? { ...event, isTracked: false } : event
      ));
      
      await customAlert('Event tracking disabled!', 'Success');
    } catch (err) {
      await customAlert(err instanceof Error ? err.message : 'An error occurred', 'Error');
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return 'TBD';
    
    try {
      const date = new Date(dateTimeStr);
      // Use UTC to avoid timezone conversion
      const dayOfWeek = date.toLocaleDateString('en-US', { 
        weekday: 'long',
        timeZone: 'UTC'
      });
      
      // Format time using UTC methods to display actual event time
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

  const formatRequirements = (event: Event) => {
    const requirements = [];
    if (event.ageRequired) requirements.push(`Age: ${event.ageRequired}`);
    if (event.experienceRequired) requirements.push(`Experience: ${event.experienceRequired}`);
    if (event.materialsRequired && event.materialsRequired !== 'No') {
      requirements.push(`Materials: ${event.materialsRequired}`);
    }
    return requirements.length > 0 ? requirements.join(' • ') : 'No special requirements';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="events" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Browse GenCon Events
          </h2>
          <p className="text-gray-600 mb-4">
            Search, filter by day, and add events to your schedule
          </p>

          {/* Search Bar */}
          <div className="mb-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search events by name, description, type, or game system..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Search
              </button>
            </form>
            {searchTerm && (
              <p className="mt-2 text-sm text-gray-600">
                Searching for: <span className="font-medium">"{searchTerm}"</span>
                <button
                  onClick={handleClearSearch}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  Clear search
                </button>
              </p>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
            >
              <span>Advanced Filters</span>
              <span className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}>
                ▼
              </span>
              {hasActiveFilters() && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  Active
                </span>
              )}
            </button>

            {showFilters && (
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Start Time Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time (after)
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleTimeFilterChange('startTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* End Time Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time (before)
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => handleTimeFilterChange('endTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Age Rating Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age Rating
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {filterOptions.ageRatings.map((rating) => (
                        <label key={rating} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedAgeRatings.includes(rating)}
                            onChange={(e) => handleAgeRatingChange(rating, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{rating}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Event Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event Type
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {filterOptions.eventTypes.map((type) => (
                        <label key={type} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedEventTypes.includes(type)}
                            onChange={(e) => handleEventTypeChange(type, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters() && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleClearAllFilters}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Day Filter */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => handleDayChange(day)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      selectedDay === day
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Grouped Events Toggle */}
          <div className="mb-6 flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isGroupedMode}
                onChange={(e) => {
                  setIsGroupedMode(e.target.checked);
                  setCurrentPage(1); // Reset pagination when toggling
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Group recurring events
              </span>
              <span className="ml-2 text-xs text-gray-500">
                (Combine events with same name into a single card)
              </span>
            </label>
          </div>

          {/* Event Count and Pagination Info */}
          {pagination && (
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Showing {events.length} events (Page {pagination.currentPage} of {pagination.totalPages})
                {selectedDay !== 'All Days' && ` for ${selectedDay}`}
                {searchTerm && ` matching "${searchTerm}"`}
              </p>
              <p className="text-sm text-gray-500">
                Total: {pagination.totalEvents} events
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-lg text-gray-600">Loading events...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Grouped Events View */}
            {isGroupedMode && !isMobile ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {groupedEvents.map((groupedEvent) => (
                  <GroupedEventCard
                    key={groupedEvent.title}
                    event={groupedEvent}
                    allUsers={allUsers}
                    selectedUserId={selectedUserId}
                    onUserChange={setSelectedUserId}
                    onAddEvent={handleAddEvent}
                    onEventClick={(instanceId, e) => {
                      // Find the clicked instance
                      const instanceIndex = groupedEvent.instances.findIndex(inst => inst.id === instanceId);
                      const instance = groupedEvent.instances[instanceIndex];
                      
                      if (instance) {
                        // Store the grouped event data for the modal
                        setGroupedEventData({
                          title: groupedEvent.title,
                          instances: groupedEvent.instances.map(inst => ({
                            ...inst,
                            title: groupedEvent.title,
                            shortDescription: groupedEvent.shortDescription,
                            eventType: groupedEvent.eventType,
                            gameSystem: groupedEvent.gameSystem,
                            ageRequired: groupedEvent.ageRequired,
                            experienceRequired: groupedEvent.experienceRequired,
                            materialsRequired: groupedEvent.materialsRequired,
                            cost: groupedEvent.cost,
                          }))
                        });
                        setSelectedInstanceIndex(instanceIndex);
                        
                        // Convert the instance to an Event object for the modal
                        const eventForModal: Event = {
                          id: instance.id,
                          title: groupedEvent.title,
                          shortDescription: groupedEvent.shortDescription ?? undefined,
                          eventType: groupedEvent.eventType ?? undefined,
                          gameSystem: groupedEvent.gameSystem ?? undefined,
                          ageRequired: groupedEvent.ageRequired ?? undefined,
                          experienceRequired: groupedEvent.experienceRequired ?? undefined,
                          materialsRequired: groupedEvent.materialsRequired ?? undefined,
                          startDateTime: instance.startDateTime ?? undefined,
                          duration: instance.duration ?? undefined,
                          location: instance.location ?? undefined,
                          cost: groupedEvent.cost ?? undefined,
                          ticketsAvailable: instance.ticketsAvailable ?? undefined,
                          isCanceled: instance.isCanceled,
                          isTracked: false, // Tracked state not available in grouped view
                        };
                        handleEventClick(eventForModal, e);
                      }
                    }}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            ) : isMobile ? (
              /* Mobile: Compressed Cards */
              <div className="grid gap-3 grid-cols-2">
                {events.map((event) => {
                  const isUserEvent = userEventIds.includes(event.id);
                  const isTracked = event.isTracked || userTrackedEventIds.includes(event.id);
                  
                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer border ${
                        event.isCanceled 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-white border-gray-200'
                      } ${isUserEvent ? 'ring-2 ring-blue-200' : ''} ${isTracked ? 'ring-2 ring-green-200' : ''}`}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      {/* Status indicators */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1">
                          {event.isCanceled && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              CANCELED
                            </span>
                          )}
                          {isUserEvent && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              IN SCHEDULE
                            </span>
                          )}
                          {isTracked && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              TRACKING
                            </span>
                          )}
                        </div>
                        {event.eventType && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {event.eventType}
                          </span>
                        )}
                      </div>

                      {/* Event Title */}
                      <h3 className={`font-semibold text-sm mb-2 line-clamp-2 ${
                        event.isCanceled ? 'text-red-800 line-through' : 'text-gray-900'
                      }`}>
                        {event.title}
                      </h3>

                      {/* Event Time */}
                      <div className="text-sm text-gray-600 mb-2">
                        {formatDateTime(event.startDateTime)}
                        {event.duration && (
                          <span className="text-xs text-gray-500 ml-1">({event.duration})</span>
                        )}
                      </div>

                      {/* Event ID and Cost */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {event.id}
                        </span>
                        {event.cost && (
                          <span className="font-medium text-green-600">
                            ${event.cost}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop: Detailed Cards */
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => {
                  const isUserEvent = userEventIds.includes(event.id);
                  const isTracked = event.isTracked || userTrackedEventIds.includes(event.id);
                  
                  return (
                    <EventTooltip key={event.id} event={event} isUserEvent={isUserEvent}>
                      <div
                        className={`rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer ${
                          event.isCanceled 
                            ? 'bg-red-50 border-2 border-red-200' 
                            : 'bg-white'
                        } ${isAdmin ? 'hover:bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                        onClick={(e) => handleEventClick(event, e)}
                      >
                      {/* Canceled Event Banner */}
                      {event.isCanceled && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span className="text-red-800 font-semibold text-sm">CANCELED</span>
                          </div>
                          <p className="text-red-700 text-xs mt-1">
                            This event has been canceled
                          </p>
                        </div>
                      )}

                      {/* Event Header */}
                      <div className="mb-4">
                        <h3 className={`text-lg font-semibold mb-2 ${
                          event.isCanceled ? 'text-red-800 line-through' : 'text-gray-900'
                        }`}>
                          {event.title}
                        </h3>
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                            {event.id}
                          </span>
                          {event.eventType && (
                            <span className={`px-2 py-1 rounded ${
                              event.isCanceled 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {event.eventType}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Event Details */}
                      <div className="space-y-3">
                        {/* Time */}
                        <div>
                          <h4 className="font-medium text-gray-700 mb-1">Time:</h4>
                          <p className="text-sm text-gray-600">
                            {formatDateTime(event.startDateTime)}
                            {event.duration && ` (${event.duration})`}
                          </p>
                        </div>

                        {/* Requirements */}
                        <div>
                          <h4 className="font-medium text-gray-700 mb-1">Requirements:</h4>
                          <p className="text-sm text-gray-600">
                            {formatRequirements(event)}
                          </p>
                        </div>

                        {/* Game System */}
                        {event.gameSystem && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-1">Game System:</h4>
                            <p className="text-sm text-gray-600">{event.gameSystem}</p>
                          </div>
                        )}

                        {/* Location & Cost */}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <div>
                            {event.location && (
                              <p className="text-sm text-gray-600">📍 {event.location}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {event.cost && (
                              <p className="text-sm font-medium text-green-600">
                                ${event.cost}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Capacity Information */}
                        {event.ticketsAvailable !== null && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">
                                Maximum Capacity:
                              </span>
                              <span className="text-sm font-semibold text-blue-600">
                                {event.ticketsAvailable} tickets
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Short Description */}
                      {event.shortDescription && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600 line-clamp-3">
                            {event.shortDescription}
                          </p>
                        </div>
                      )}

                      {/* Add/Remove Event Button */}
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                        {isUserEvent ? (
                          <button
                            onClick={() => handleRemoveEvent(event.id)}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm font-medium"
                          >
                            Remove from Schedule
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddEvent(event.id)}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                          >
                            Add to Schedule
                          </button>
                        )}

                        {/* Admin Edit Button */}
                        {isAdmin && (
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm font-medium flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Event
                          </button>
                        )}
                      </div>
                      </div>
                    </EventTooltip>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            pageNum === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">
              No events found with the current filters.
            </p>
            {hasActiveFilters() && (
              <button
                onClick={handleClearAllFilters}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Conflict Warning Modal */}
      {conflictModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                ⚠️ Schedule Conflict Detected
              </h3>
              
              <p className="text-gray-700 mb-3">
                <strong>{conflictModal.eventTitle}</strong> has been added to your schedule, but there are conflicts:
              </p>

              {conflictModal.conflicts.length > 0 && (
                <div className="mb-4">
                  <p className="text-gray-700 mb-2 font-medium">
                    Time conflicts with:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 bg-red-50 p-3 rounded">
                    {conflictModal.conflicts.map((conflict, index) => (
                      <li key={index}>
                        <strong>{conflict.title}</strong>
                        <br />
                        <span className="text-xs">
                          {new Date(conflict.startDateTime).toLocaleString()} - {' '}
                          {new Date(conflict.endDateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {conflictModal.capacityWarning && (
                <div className="mb-4">
                  <p className="text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                    <strong>Capacity Warning:</strong> This event is at or over capacity. Tickets may not be available.
                  </p>
                </div>
              )}

              <p className="text-gray-700 text-sm">
                The event has been added to your schedule. Conflicting events will be shown in red on your timeline.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleConfirmAddEvent}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Add
              </button>
              <button
                onClick={handleCancelAddEvent}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Alert Component */}
      <AlertComponent />

      {/* Event Edit Modal */}
      {editingEvent && (
        <EventEditModal
          key={editingEvent.id}
          event={{
            ...editingEvent,
            _count: {
              desiredEvents: 0,
              trackedBy: 0
            }
          } as any}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
          loading={editLoading}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && isEventDetailModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseEventDetailModal}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className={`text-xl font-semibold ${
                selectedEvent.isCanceled ? 'text-red-800 line-through' : 'text-gray-900'
              }`}>
                {selectedEvent.title}
              </h3>
              <button
                onClick={handleCloseEventDetailModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Instance Selector for Grouped Events */}
            {groupedEventData && groupedEventData.instances.length > 1 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Time/Date ({groupedEventData.instances.length} sessions available):
                </label>
                <select
                  value={selectedInstanceIndex}
                  onChange={(e) => {
                    const newIndex = parseInt(e.target.value);
                    setSelectedInstanceIndex(newIndex);
                    const newInstance = groupedEventData.instances[newIndex];
                    
                    // Update the selected event with the new instance data
                    const updatedEvent: Event = {
                      id: newInstance.id,
                      title: newInstance.title,
                      shortDescription: newInstance.shortDescription ?? undefined,
                      eventType: newInstance.eventType ?? undefined,
                      gameSystem: newInstance.gameSystem ?? undefined,
                      ageRequired: newInstance.ageRequired ?? undefined,
                      experienceRequired: newInstance.experienceRequired ?? undefined,
                      materialsRequired: newInstance.materialsRequired ?? undefined,
                      startDateTime: newInstance.startDateTime ?? undefined,
                      duration: newInstance.duration ?? undefined,
                      location: newInstance.location ?? undefined,
                      cost: newInstance.cost ?? undefined,
                      ticketsAvailable: newInstance.ticketsAvailable ?? undefined,
                      isCanceled: newInstance.isCanceled,
                      isTracked: false,
                    };
                    setSelectedEvent(updatedEvent);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  {groupedEventData.instances.map((instance, index) => {
                    const isUserEvent = userEventIds.includes(instance.id);
                    const status = instance.isCanceled ? '🚫 CANCELED' : isUserEvent ? '✓ In Schedule' : '📅 Available';
                    return (
                      <option key={instance.id} value={index}>
                        {formatDateTime(instance.startDateTime)} - {status}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Canceled Event Banner */}
            {selectedEvent.isCanceled && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-red-800 font-semibold text-sm">CANCELED EVENT</span>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  This event has been canceled and may not be available.
                </p>
              </div>
            )}

            {/* Event Details */}
            <div className="space-y-4 mb-6">
              {/* Event ID and Type */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-gray-100 px-3 py-1 rounded text-sm">
                    {selectedEvent.id}
                  </span>
                  <a
                    href={`https://www.gencon.com/events/${selectedEvent.id.slice(-6)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on GenCon
                  </a>
                </div>
                {selectedEvent.eventType && (
                  <span className="px-3 py-1 rounded text-sm bg-blue-100 text-blue-800">
                    {selectedEvent.eventType}
                  </span>
                )}
              </div>

              {/* Time */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Schedule:</h4>
                <p className="text-gray-600">
                  {formatDateTime(selectedEvent.startDateTime)}
                  {selectedEvent.duration && ` (Duration: ${selectedEvent.duration})`}
                </p>
              </div>

              {/* Location & Cost */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedEvent.location && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Location:</h4>
                    <p className="text-gray-600">📍 {selectedEvent.location}</p>
                  </div>
                )}
                {selectedEvent.cost && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Cost:</h4>
                    <p className="text-green-600 font-medium">${selectedEvent.cost}</p>
                  </div>
                )}
              </div>

              {/* Game System */}
              {selectedEvent.gameSystem && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Game System:</h4>
                  <p className="text-gray-600">{selectedEvent.gameSystem}</p>
                </div>
              )}

              {/* Requirements */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Requirements:</h4>
                <p className="text-gray-600">{formatRequirements(selectedEvent)}</p>
              </div>

              {/* Capacity */}
              {selectedEvent.ticketsAvailable !== null && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Capacity:</h4>
                  <p className="text-blue-600 font-medium">
                    {selectedEvent.ticketsAvailable} tickets maximum
                  </p>
                </div>
              )}

              {/* Description */}
              {selectedEvent.shortDescription && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Description:</h4>
                  <p className="text-gray-600">{selectedEvent.shortDescription}</p>
                </div>
              )}
            </div>

            {/* User Selector */}
            {!userEventIds.includes(selectedEvent.id) && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add event for:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.genConName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Add/Remove Event Button */}
              {userEventIds.includes(selectedEvent.id) ? (
                <button
                  onClick={() => {
                    handleRemoveEvent(selectedEvent.id);
                    handleCloseEventDetailModal();
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm font-medium"
                >
                  Remove from Schedule
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleAddEvent(selectedEvent.id);
                    handleCloseEventDetailModal();
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                >
                  Add to Schedule
                </button>
              )}

              {/* Admin Edit Button */}
              {isAdmin && (
                <button
                  onClick={() => {
                    handleEditEvent(selectedEvent);
                    handleCloseEventDetailModal();
                  }}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm font-medium flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
