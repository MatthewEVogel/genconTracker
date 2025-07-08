import { prisma } from '@/lib/prisma';

export interface EventFilters {
  page?: number;
  limit?: number;
  day?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  ageRatings?: string[];
  eventTypes?: string[];
  maxParticipants?: number;
}

export interface EventsResponse {
  events: Array<{
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
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export async function getEventsForDisplay(filters: EventFilters): Promise<EventsResponse> {
  const {
    page = 1,
    limit = 100,
    day,
    search,
    startTime,
    endTime,
    ageRatings,
    eventTypes,
    maxParticipants
  } = filters;

  const skip = (page - 1) * limit;
  
  const hasFilters = (day && day !== 'All Days') || search || startTime || endTime || 
                     (ageRatings && ageRatings.length > 0) || 
                     (eventTypes && eventTypes.length > 0) || 
                     maxParticipants;

  if (hasFilters) {
    const allEvents = await prisma.event.findMany({
      orderBy: {
        startDateTime: 'asc'
      },
      select: {
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
      }
    });

    let filteredEvents = allEvents;

    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      filteredEvents = filteredEvents.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        (event.shortDescription && event.shortDescription.toLowerCase().includes(searchTerm)) ||
        (event.eventType && event.eventType.toLowerCase().includes(searchTerm)) ||
        (event.gameSystem && event.gameSystem.toLowerCase().includes(searchTerm)) ||
        event.id.toLowerCase().includes(searchTerm)
      );
    }

    if (day && day !== 'All Days') {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.startDateTime) return false;
        try {
          const eventDate = new Date(event.startDateTime);
          const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
          return dayOfWeek === day;
        } catch {
          return false;
        }
      });
    }

    if (startTime && startTime.trim()) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.startDateTime) return false;
        try {
          const eventDate = new Date(event.startDateTime);
          const eventTime = eventDate.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return eventTime >= startTime.trim();
        } catch {
          return false;
        }
      });
    }

    if (endTime && endTime.trim()) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.endDateTime) return false;
        try {
          const eventDate = new Date(event.endDateTime);
          const eventTime = eventDate.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return eventTime <= endTime.trim();
        } catch {
          return false;
        }
      });
    }

    if (ageRatings && ageRatings.length > 0) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.ageRequired) return ageRatings.includes('Not Specified');
        return ageRatings.some(rating => 
          event.ageRequired && event.ageRequired.toLowerCase().includes(rating.toLowerCase())
        );
      });
    }

    if (eventTypes && eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.eventType) return eventTypes.includes('Not Specified');
        return eventTypes.some(type => 
          event.eventType && event.eventType.toLowerCase().includes(type.toLowerCase())
        );
      });
    }

    if (maxParticipants && !isNaN(maxParticipants)) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.ticketsAvailable) return false;
        return event.ticketsAvailable <= maxParticipants;
      });
    }

    const totalEvents = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(skip, skip + limit);
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
  } else {
    const totalEvents = await prisma.event.count();
    
    const events = await prisma.event.findMany({
      skip,
      take: limit,
      orderBy: {
        startDateTime: 'asc'
      },
      select: {
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
      }
    });

    const totalPages = Math.ceil(totalEvents / limit);

    return {
      events,
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

export interface AddEventToDesiredListResult {
  success: boolean;
  conflicts?: Array<{
    eventId: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
  }>;
  capacityWarning?: boolean;
  error?: string;
}

export async function addEventToDesiredList(userId: string, eventId: string, priority: number = 1): Promise<AddEventToDesiredListResult> {
  try {
    const existingDesiredEvent = await prisma.desiredEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    if (existingDesiredEvent) {
      return { success: false, error: 'Event is already in your desired list' };
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    const userDesiredEvents = await prisma.desiredEvent.findMany({
      where: { userId },
      include: { event: true }
    });

    const conflicts = [];
    
    if (event.startDateTime && event.endDateTime) {
      const newEventStart = new Date(event.startDateTime);
      const newEventEnd = new Date(event.endDateTime);

      for (const desiredEvent of userDesiredEvents) {
        if (desiredEvent.event.startDateTime && desiredEvent.event.endDateTime) {
          const existingStart = new Date(desiredEvent.event.startDateTime);
          const existingEnd = new Date(desiredEvent.event.endDateTime);

          if (newEventStart < existingEnd && newEventEnd > existingStart) {
            conflicts.push({
              eventId: desiredEvent.event.id,
              title: desiredEvent.event.title,
              startDateTime: desiredEvent.event.startDateTime,
              endDateTime: desiredEvent.event.endDateTime
            });
          }
        }
      }
    }

    const eventDesiredCount = await prisma.desiredEvent.count({
      where: { eventId }
    });

    const capacityWarning = event.ticketsAvailable ? eventDesiredCount >= event.ticketsAvailable : false;

    await prisma.desiredEvent.create({
      data: {
        userId,
        eventId,
        priority
      }
    });

    return { 
      success: true, 
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      capacityWarning: capacityWarning || undefined
    };
  } catch (error) {
    console.error('Error adding event to desired list:', error);
    return { success: false, error: 'Failed to add event to desired list' };
  }
}

export async function removeEventFromDesiredList(userId: string, eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const desiredEvent = await prisma.desiredEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    if (!desiredEvent) {
      return { success: false, error: 'Event not found in desired list' };
    }

    await prisma.desiredEvent.delete({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing event from desired list:', error);
    return { success: false, error: 'Failed to remove event from desired list' };
  }
}

export async function getUserDesiredEvents(userId: string): Promise<string[]> {
  try {
    const desiredEvents = await prisma.desiredEvent.findMany({
      where: { userId },
      select: { eventId: true }
    });

    return desiredEvents.map(de => de.eventId);
  } catch (error) {
    console.error('Error fetching user desired events:', error);
    return [];
  }
}