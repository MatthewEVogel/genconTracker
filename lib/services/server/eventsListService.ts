import { prisma } from '@/lib/prisma';

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

export interface EventsListResponse {
  events: EventsListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

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
  duration?: string | null; // Calculated field
}

export interface EventInstance {
  id: string;
  startDateTime: string | null;
  endDateTime: string | null;
  duration?: string | null;
  location?: string | null;
  ticketsAvailable?: number | null;
  isCanceled: boolean;
  isUserEvent?: boolean;
}

export interface GroupedEvent {
  title: string;
  eventType?: string | null;
  gameSystem?: string | null;
  shortDescription?: string | null;
  cost?: string | null;
  ageRequired?: string | null;
  experienceRequired?: string | null;
  materialsRequired?: string | null;
  priority: number;
  instances: EventInstance[];
}

export interface GroupedEventsResponse {
  events: GroupedEvent[];
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

export class EventsListService {
  // Calculate duration from start and end times
  static calculateDuration(startDateTime: string | null, endDateTime: string | null): string | null {
    if (!startDateTime || !endDateTime) {
      return null;
    }

    try {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      
      // Check if dates are valid
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
      }
      
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
      
      // Check if calculated values are valid
      if (isNaN(hours) || isNaN(minutes)) {
        return null;
      }
      
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

  // Transform EventsList to include calculated duration
  private static transformEventWithDuration(event: any): EventsListItem {
    return {
      ...event,
      duration: this.calculateDuration(event.startDateTime, event.endDateTime)
    };
  }

  // Get events with filtering and pagination
  static async getEvents(filters: EventsListFilters): Promise<EventsListResponse> {
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
      endDateTime: true,
      ageRequired: true,
      experienceRequired: true,
      materialsRequired: true,
      cost: true,
      location: true,
      ticketsAvailable: true,
      priority: true,
      isCanceled: true,
    };

    if (hasFilters) {
      // Fetch all events without sorting (we'll sort after filtering)
      const allEvents = await prisma.eventsList.findMany({
        select: eventSelect
      });

      let filteredEvents = this.applyFilters(allEvents, filters);
      
      // Sort filtered events chronologically by startDateTime
      filteredEvents = filteredEvents.sort((a, b) => {
        if (!a.startDateTime || !b.startDateTime) return 0;
        return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
      });
      
      const totalEvents = filteredEvents.length;
      const paginatedEvents = filteredEvents.slice(skip, skip + limit);
      const totalPages = Math.ceil(totalEvents / limit);

      return {
        events: paginatedEvents.map(event => this.transformEventWithDuration(event)),
        pagination: {
          currentPage: page,
          totalPages,
          totalEvents,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } else {
      const totalEvents = await prisma.eventsList.count();
      
      const events = await prisma.eventsList.findMany({
        skip,
        take: limit,
        orderBy: { startDateTime: 'asc' },
        select: eventSelect
      });

      const totalPages = Math.ceil(totalEvents / limit);

      return {
        events: events.map(event => this.transformEventWithDuration(event)),
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
    const events = await prisma.eventsList.findMany({
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
  static async getEventById(eventId: string): Promise<EventsListItem | null> {
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return null;
    }

    return this.transformEventWithDuration(event);
  }

  // Get grouped events with filtering and pagination
  static async getGroupedEvents(filters: EventsListFilters, userEventIds: string[] = []): Promise<GroupedEventsResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const skip = (page - 1) * limit;
    
    // Fetch all events
    const allEvents = await prisma.eventsList.findMany({
      select: {
        id: true,
        title: true,
        shortDescription: true,
        eventType: true,
        gameSystem: true,
        startDateTime: true,
        endDateTime: true,
        ageRequired: true,
        experienceRequired: true,
        materialsRequired: true,
        cost: true,
        location: true,
        ticketsAvailable: true,
        priority: true,
        isCanceled: true,
      }
    });

    // Apply filters
    let filteredEvents = this.applyFilters(allEvents, filters);
    
    // Group events by exact title match
    const groupedMap = new Map<string, any[]>();
    filteredEvents.forEach(event => {
      const existing = groupedMap.get(event.title) || [];
      existing.push(event);
      groupedMap.set(event.title, existing);
    });

    // Convert to GroupedEvent array
    const groupedEvents: GroupedEvent[] = Array.from(groupedMap.entries()).map(([title, instances]) => {
      // Use first instance for common properties
      const firstInstance = instances[0];
      
      // Sort instances by startDateTime
      const sortedInstances = instances.sort((a, b) => {
        if (!a.startDateTime || !b.startDateTime) return 0;
        return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
      });

      return {
        title,
        eventType: firstInstance.eventType,
        gameSystem: firstInstance.gameSystem,
        shortDescription: firstInstance.shortDescription,
        cost: firstInstance.cost,
        ageRequired: firstInstance.ageRequired,
        experienceRequired: firstInstance.experienceRequired,
        materialsRequired: firstInstance.materialsRequired,
        priority: firstInstance.priority,
        instances: sortedInstances.map(instance => ({
          id: instance.id,
          startDateTime: instance.startDateTime,
          endDateTime: instance.endDateTime,
          duration: this.calculateDuration(instance.startDateTime, instance.endDateTime),
          location: instance.location,
          ticketsAvailable: instance.ticketsAvailable,
          isCanceled: instance.isCanceled,
          isUserEvent: userEventIds.includes(instance.id)
        }))
      };
    });

    // Sort grouped events by earliest instance startDateTime
    const sortedGroupedEvents = groupedEvents.sort((a, b) => {
      const aTime = a.instances[0]?.startDateTime;
      const bTime = b.instances[0]?.startDateTime;
      if (!aTime || !bTime) return 0;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

    // Apply pagination
    const totalEvents = sortedGroupedEvents.length;
    const paginatedEvents = sortedGroupedEvents.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalEvents / limit);

    return {
      events: paginatedEvents,
      pagination: {
        currentPage: page,
        totalPages,
        totalEvents,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  // Private method to apply filters to events
  private static applyFilters(events: any[], filters: EventsListFilters): any[] {
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
          const eventDate = new Date(event.startDateTime);
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
          const eventDate = new Date(event.startDateTime);
          // Extract time in UTC to match how we store events (without timezone conversion)
          const hours = eventDate.getUTCHours().toString().padStart(2, '0');
          const minutes = eventDate.getUTCMinutes().toString().padStart(2, '0');
          const eventTime = `${hours}:${minutes}`;
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
          const eventDate = new Date(event.endDateTime);
          // Extract time in UTC to match how we store events (without timezone conversion)
          const hours = eventDate.getUTCHours().toString().padStart(2, '0');
          const minutes = eventDate.getUTCMinutes().toString().padStart(2, '0');
          const eventTime = `${hours}:${minutes}`;
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
