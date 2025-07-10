export interface EventsListItem {
  id: string;
  title: string;
  shortDescription?: string | null;
  eventType?: string | null;
  gameSystem?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  ageRequired?: string | null;
  experienceRequired?: string | null;
  materialsRequired?: string | null;
  cost?: string | null;
  location?: string | null;
  ticketsAvailable?: number | null;
  priority: number;
  isCanceled: boolean;
  duration?: string | null;
}

export interface EventsListFilters {
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

export interface EventsListResponse {
  events: EventsListItem[];
  pagination: Pagination;
}

export interface FilterOptions {
  ageRatings: string[];
  eventTypes: string[];
}

export class EventsListService {
  // Get events with filtering and pagination
  static async getEvents(filters: EventsListFilters): Promise<EventsListResponse> {
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

  // Get filter options for age ratings and event types
  static async getFilterOptions(): Promise<FilterOptions> {
    const response = await fetch('/api/events-list-filter-options');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch filter options');
    }
    
    return data;
  }

  // Get single event by ID
  static async getEventById(eventId: string): Promise<EventsListItem> {
    const response = await fetch(`/api/events-list/${eventId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch event');
    }
    
    return data.event;
  }

  // Search events by text
  static async searchEvents(searchTerm: string, limit: number = 10): Promise<EventsListItem[]> {
    const filters: EventsListFilters = {
      search: searchTerm,
      limit,
      page: 1
    };

    const result = await this.getEvents(filters);
    return result.events;
  }

  // Get events for a specific day
  static async getEventsByDay(day: string, page: number = 1, limit: number = 100): Promise<EventsListResponse> {
    const filters: EventsListFilters = {
      day: day !== 'All Days' ? day : undefined,
      page,
      limit
    };

    return await this.getEvents(filters);
  }

  // Get events by type
  static async getEventsByType(eventType: string, page: number = 1, limit: number = 100): Promise<EventsListResponse> {
    const filters: EventsListFilters = {
      eventTypes: eventType,
      page,
      limit
    };

    return await this.getEvents(filters);
  }

  // Calculate duration from start and end times (client-side utility)
  static calculateDuration(startDateTime: string | null, endDateTime: string | null): string | null {
    if (!startDateTime || !endDateTime) {
      return null;
    }

    try {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      
      // Calculate difference in milliseconds
      let diffMs = end.getTime() - start.getTime();
      
      // Handle events that cross day boundaries (end time is next day)
      if (diffMs < 0) {
        // Add 24 hours (86400000 ms) to handle day crossing
        diffMs += 24 * 60 * 60 * 1000;
      }
      
      // Convert to hours and minutes
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Format as "Xh Ym" or just "Xh" if no minutes
      if (minutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${minutes}m`;
      }
    } catch (error) {
      console.error('Error calculating duration:', error);
      return null;
    }
  }
}