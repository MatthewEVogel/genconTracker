import { EventsListService } from './eventsListService';

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

export interface EventsResponse {
  events: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface FilterOptionsResponse {
  ageRatings: string[];
  eventTypes: string[];
}

export class EventService {
  // Get events with filtering and pagination - delegates to EventsListService
  static async getEvents(filters: EventFilters): Promise<EventsResponse> {
    const result = await EventsListService.getEvents(filters);
    
    // Transform to maintain compatibility with existing interface
    return {
      events: result.events,
      pagination: result.pagination
    };
  }

  // Get filter options for age ratings and event types - delegates to EventsListService
  static async getFilterOptions(): Promise<FilterOptionsResponse> {
    return await EventsListService.getFilterOptions();
  }

  // Get single event by ID - delegates to EventsListService
  static async getEventById(eventId: string) {
    return await EventsListService.getEventById(eventId);
  }
}