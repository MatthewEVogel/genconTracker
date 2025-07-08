export interface Event {
  id: string;
  title: string;
  shortDescription?: string;
  eventType?: string;
  gameSystem?: string;
  startDateTime?: string;
  duration?: string;
  endDateTime?: string;
  ageRequired?: string;
  experienceRequired?: string;
  materialsRequired?: string;
  cost?: string;
  location?: string;
  ticketsAvailable?: number;
  isCanceled?: boolean;
  canceledAt?: string;
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

    const response = await fetch(`/api/events?${params}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch events');
    }
    
    return data;
  }

  static async getFilterOptions(): Promise<FilterOptions> {
    const response = await fetch('/api/filter-options');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch filter options');
    }
    
    return data;
  }
}