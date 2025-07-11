import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useUserStore from "@/store/useUserStore";
import Navigation from "@/components/Navigation";
import { EventService, Event, Pagination } from "@/lib/services/client/eventService";
import { ScheduleService } from "@/lib/services/client/scheduleService";


interface ConflictModal {
  show: boolean;
  eventId: string;
  eventTitle: string;
  conflicts: any[];
  capacityWarning: boolean;
}

interface FilterOptions {
  ageRatings: string[];
  eventTypes: string[];
}

const DAYS = ['All Days', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function EventsPage() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [userEventIds, setUserEventIds] = useState<string[]>([]);
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

  useEffect(() => {
    // Redirect to login if no user is logged in
    if (!user) {
      router.push("/");
      return;
    }

    // Fetch user events and filter options
    fetchUserEvents();
    fetchFilterOptions();
  }, [user, router]);

  useEffect(() => {
    // Fetch events when any filter changes
    fetchEvents();
  }, [selectedDay, currentPage, searchTerm, startTime, endTime, selectedAgeRatings, selectedEventTypes]);

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
      
      const filters = {
        page: currentPage,
        limit: 100,
        day: selectedDay !== 'All Days' ? selectedDay : undefined,
        search: searchTerm.trim() || undefined,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        ageRatings: selectedAgeRatings.length > 0 ? selectedAgeRatings.join(',') : undefined,
        eventTypes: selectedEventTypes.length > 0 ? selectedEventTypes.join(',') : undefined,
      };

      const data = await EventService.getEvents(filters);
      
      setEvents(data.events);
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

    try {
      const data = await ScheduleService.addUserEvent(user.id, eventId);

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
      
      // Show success message
      alert('Event added to your schedule!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
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
    alert('Event added to your schedule with conflicts noted!');
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

  const handleRemoveEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await ScheduleService.removeUserEvent(user.id, eventId);

      // Refresh user events
      await fetchUserEvents();
      
      // Show success message
      alert('Event removed from your schedule!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
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
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const time = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const isUserEvent = userEventIds.includes(event.id);
                
                return (
                  <div
                    key={event.id}
                    className={`rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${
                      event.isCanceled 
                        ? 'bg-red-50 border-2 border-red-200' 
                        : 'bg-white'
                    }`}
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
                    <div className="mt-4 pt-4 border-t border-gray-200">
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
                    </div>
                  </div>
                );
              })}
            </div>

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
    </div>
  );
}
