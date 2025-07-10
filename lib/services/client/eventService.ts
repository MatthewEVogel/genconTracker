export interface Event {
  id: string;
  title: string;
  shortDescription?: string;
  eventType?: string;
  gameSystem?: string;
  startDateTime?: string;
  duration?: string; // Now calculated from start/end times
  endDateTime?: string;
  ageRequired?: string;
  experienceRequired?: string;
  materialsRequired?: string;
  cost?: string;
  location?: string;
  ticketsAvailable?: number;
  priority?: number;
  isCanceled?: boolean;
}

export interface EventFilters {
  page?: number;
  limit?: number;
  day?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  ageRatings?: string;
  eventTypes?: string;
  maxParticipants?: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalEvents: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface EventsResponse {
  events: Event[];
  pagination: Pagination;
}

export interface FilterOptions {
  ageRatings: string[];
  eventTypes: string[];
}

export class EventService {
  // Get events with filtering and pagination - now uses EventsList API
  static async getEvents(filters: EventFilters): Promise<EventsResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.day) params.append('day', filters.day);
    if (filters.search) params.append('search', filters.search);
    if (filters.startTime) params.append('startTime', filters.startTime);
    if (filters.endTime) params.append('endTime', filters.endTime);
    if (filters.ageRatings) params.append('ageRatings', filters.ageRatings);
    if (filters.eventTypes) params.append('eventTypes', filters.eventTypes);
    if (filters.maxParticipants) params.append('maxParticipants', filters.maxParticipants);

    const response = await fetch(`/api/events-list?${params}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch events');
    }
    
    return data;
  }

  // Get filter options for age ratings and event types - now uses EventsList API
  static async getFilterOptions(): Promise<FilterOptions> {
    const response = await fetch('/api/events-list-filter-options');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch filter options');
    }
    
    return data;
  }

  // Get single event by ID - now uses EventsList API
  static async getEventById(eventId: string): Promise<Event> {
    const response = await fetch(`/api/events-list/${eventId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch event');
    }
    
    return data.event;
  }

  // Search events by text
  static async searchEvents(searchTerm: string, limit: number = 10): Promise<Event[]> {
    const filters: EventFilters = {
      search: searchTerm,
      limit,
      page: 1
    };

    const result = await this.getEvents(filters);
    return result.events;
  }

  // Get events for a specific day
  static async getEventsByDay(day: string, page: number = 1, limit: number = 100): Promise<EventsResponse> {
    const filters: EventFilters = {
      day: day !== 'All Days' ? day : undefined,
      page,
      limit
    };

    return await this.getEvents(filters);
  }

  // Get events by type
  static async getEventsByType(eventType: string, page: number = 1, limit: number = 100): Promise<EventsResponse> {
    const filters: EventFilters = {
      eventTypes: eventType,
      page,
      limit
    };

    return await this.getEvents(filters);
  }
}