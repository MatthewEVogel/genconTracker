import { prisma } from '@/lib/prisma';

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
  // Get events with filtering and pagination
  static async getEvents(filters: EventFilters): Promise<EventsResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const skip = (page - 1) * limit;
    
    const hasFilters = (filters.day && filters.day !== 'All Days') || 
                      filters.search || 
                      filters.startTime || 
                      filters.endTime || 
                      filters.ageRatings || 
                      filters.eventTypes || 
                      filters.maxParticipants;

    const eventSelect = {
      id: true,
      title: true,
      shortDescription: true,
      eventType: true,
      gameSystem: true,
      startDateTime: true,
      duration: true,
      endDateTime: true,
      ageRequired: true,
      experienceRequired: true,
      materialsRequired: true,
      cost: true,
      location: true,
      ticketsAvailable: true,
      isCanceled: true,
      canceledAt: true,
    };

    if (hasFilters) {
      const allEvents = await prisma.event.findMany({
        orderBy: { startDateTime: 'asc' },
        select: eventSelect
      });

      let filteredEvents = this.applyFilters(allEvents, filters);
      
      const totalEvents = filteredEvents.length;
      const paginatedEvents = filteredEvents.slice(skip, skip + limit);
      const totalPages = Math.ceil(totalEvents / limit);

      return {
        events: this.transformEvents(paginatedEvents),
        pagination: {
          currentPage: page,
          totalPages,
          totalEvents,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } else {
      const totalEvents = await prisma.event.count();
      
      const events = await prisma.event.findMany({
        skip,
        take: limit,
        orderBy: { startDateTime: 'asc' },
        select: eventSelect
      });

      const totalPages = Math.ceil(totalEvents / limit);

      return {
        events: this.transformEvents(events),
        pagination: {
          currentPage: page,
          totalPages,
          totalEvents,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    }
  }

  // Get filter options for age ratings and event types
  static async getFilterOptions(): Promise<FilterOptionsResponse> {
    const events = await prisma.event.findMany({
      select: {
        ageRequired: true,
        eventType: true,
      }
    });

    const ageRatings = new Set<string>();
    const eventTypes = new Set<string>();

    events.forEach(event => {
      if (event.ageRequired) {
        ageRatings.add(event.ageRequired);
      } else {
        ageRatings.add('Not Specified');
      }

      if (event.eventType) {
        eventTypes.add(event.eventType);
      } else {
        eventTypes.add('Not Specified');
      }
    });

    return {
      ageRatings: Array.from(ageRatings).sort(),
      eventTypes: Array.from(eventTypes).sort()
    };
  }

  // Get single event by ID
  static async getEventById(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });
    
    if (!event) return null;
    
    return this.transformEvent(event);
  }

  // Transform events from database format to API format
  private static transformEvents(events: any[]): any[] {
    return events.map(event => this.transformEvent(event));
  }

  // Transform single event from database format to API format
  private static transformEvent(event: any): any {
    return {
      ...event,
      startDateTime: event.startDateTime?.toISOString() || null,
      endDateTime: event.endDateTime?.toISOString() || null,
      canceledAt: event.canceledAt?.toISOString() || null,
      cost: event.cost ? event.cost.toNumber().toString() : null,
    };
  }

  // Private method to apply filters to events
  private static applyFilters(events: any[], filters: EventFilters): any[] {
    let filteredEvents = events;

    // Filter by search term
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filteredEvents = filteredEvents.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        (event.shortDescription && event.shortDescription.toLowerCase().includes(searchTerm)) ||
        (event.eventType && event.eventType.toLowerCase().includes(searchTerm)) ||
        (event.gameSystem && event.gameSystem.toLowerCase().includes(searchTerm)) ||
        event.id.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by day
    if (filters.day && filters.day !== 'All Days') {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.startDateTime) return false;
        try {
          // Handle both Date objects and strings
          const eventDate = event.startDateTime instanceof Date 
            ? event.startDateTime 
            : new Date(event.startDateTime);
          
          // Check if date is valid
          if (isNaN(eventDate.getTime())) return false;
          
          const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
          return dayOfWeek === filters.day;
        } catch {
          return false;
        }
      });
    }

    // Filter by start time
    if (filters.startTime && filters.startTime.trim()) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.startDateTime) return false;
        try {
          const eventDate = event.startDateTime instanceof Date 
            ? event.startDateTime 
            : new Date(event.startDateTime);
          const eventTime = eventDate.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return eventTime >= filters.startTime!.trim();
        } catch {
          return false;
        }
      });
    }

    // Filter by end time
    if (filters.endTime && filters.endTime.trim()) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.endDateTime) return false;
        try {
          const eventDate = event.endDateTime instanceof Date 
            ? event.endDateTime 
            : new Date(event.endDateTime);
          const eventTime = eventDate.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return eventTime <= filters.endTime!.trim();
        } catch {
          return false;
        }
      });
    }

    // Filter by age ratings
    if (filters.ageRatings && filters.ageRatings.trim()) {
      const selectedAgeRatings = filters.ageRatings.split(',').map(rating => rating.trim());
      filteredEvents = filteredEvents.filter(event => {
        if (!event.ageRequired) return selectedAgeRatings.includes('Not Specified');
        return selectedAgeRatings.some(rating => 
          event.ageRequired && event.ageRequired.toLowerCase().includes(rating.toLowerCase())
        );
      });
    }

    // Filter by event types
    if (filters.eventTypes && filters.eventTypes.trim()) {
      const selectedEventTypes = filters.eventTypes.split(',').map(type => type.trim());
      filteredEvents = filteredEvents.filter(event => {
        if (!event.eventType) return selectedEventTypes.includes('Not Specified');
        return selectedEventTypes.some(type => 
          event.eventType && event.eventType.toLowerCase().includes(type.toLowerCase())
        );
      });
    }

    // Filter by max participants
    if (filters.maxParticipants && filters.maxParticipants.trim()) {
      const maxParticipantsNum = parseInt(filters.maxParticipants.trim());
      if (!isNaN(maxParticipantsNum)) {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.ticketsAvailable) return false;
          return event.ticketsAvailable <= maxParticipantsNum;
        });
      }
    }

    return filteredEvents;
  }
}
