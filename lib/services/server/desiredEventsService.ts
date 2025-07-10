import { prisma } from '@/lib/prisma';

export interface DesiredEvent {
  id: string;
  userId: string;
  eventsListId: string;
  eventsList?: {
    id: string;
    title: string;
    startDateTime: string | null;
    endDateTime: string | null;
    eventType?: string | null;
    location?: string | null;
    cost?: string | null;
    ticketsAvailable?: number | null;
    priority: number;
    isCanceled: boolean;
  };
}

export interface ConflictInfo {
  eventsListId: string;
  title: string;
  startDateTime: string | null;
  endDateTime: string | null;
}

export interface AddDesiredEventResponse {
  desiredEvent: DesiredEvent;
  conflicts: ConflictInfo[];
  capacityWarning: boolean;
}

export class DesiredEventsService {
  // Get all desired events for a user
  static async getUserDesiredEvents(userId: string, includeCanceled?: boolean): Promise<DesiredEvent[]> {
    const whereClause: any = { userId };
    
    // Filter by canceled status if specified
    if (includeCanceled === true) {
      whereClause.eventsList = { isCanceled: true };
    } else if (includeCanceled === false) {
      whereClause.eventsList = { isCanceled: false };
    }

    const desiredEvents = await prisma.desiredEvents.findMany({
      where: whereClause,
      include: {
        eventsList: {
          select: {
            id: true,
            title: true,
            startDateTime: true,
            endDateTime: true,
            eventType: true,
            location: true,
            cost: true,
            ticketsAvailable: true,
            priority: true,
            isCanceled: true
          }
        }
      }
    });

    return desiredEvents;
  }

  // Get canceled events for a user (for alert system)
  static async getUserCanceledEvents(userId: string) {
    const desiredEvents = await this.getUserDesiredEvents(userId, true);
    
    return desiredEvents.map(de => ({
      id: de.eventsList!.id,
      title: de.eventsList!.title,
      startDateTime: de.eventsList!.startDateTime,
      isCanceled: de.eventsList!.isCanceled
    }));
  }

  // Add a desired event for a user
  static async addDesiredEvent(userId: string, eventsListId: string): Promise<AddDesiredEventResponse> {
    // Check if already exists
    const existing = await prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId
        }
      }
    });

    if (existing) {
      throw new Error('User is already registered for this event');
    }

    // Get event details from EventsList
    const event = await prisma.eventsList.findUnique({
      where: { id: eventsListId }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check for conflicts
    const conflicts = await this.checkTimeConflicts(userId, event);

    // Check capacity
    const capacityWarning = await this.checkCapacity(eventsListId, event.ticketsAvailable);

    // Create the desired event
    const desiredEvent = await prisma.desiredEvents.create({
      data: {
        userId,
        eventsListId
      },
      include: {
        eventsList: {
          select: {
            id: true,
            title: true,
            startDateTime: true,
            endDateTime: true,
            eventType: true,
            location: true,
            cost: true,
            ticketsAvailable: true,
            priority: true,
            isCanceled: true
          }
        }
      }
    });

    return {
      desiredEvent,
      conflicts,
      capacityWarning
    };
  }

  // Remove a desired event for a user
  static async removeDesiredEvent(userId: string, eventsListId: string): Promise<void> {
    const desiredEvent = await prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId
        }
      }
    });

    if (!desiredEvent) {
      throw new Error('User event not found');
    }

    await prisma.desiredEvents.delete({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId
        }
      }
    });
  }

  // Check if user has a specific desired event
  static async userHasDesiredEvent(userId: string, eventsListId: string): Promise<boolean> {
    const desiredEvent = await prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId
        }
      }
    });

    return !!desiredEvent;
  }

  // Get count of users who want a specific event
  static async getEventDesiredCount(eventsListId: string): Promise<number> {
    return await prisma.desiredEvents.count({
      where: { eventsListId }
    });
  }

  // Private method to check for time conflicts
  private static async checkTimeConflicts(userId: string, newEvent: any): Promise<ConflictInfo[]> {
    if (!newEvent.startDateTime || !newEvent.endDateTime) {
      return [];
    }

    const userDesiredEvents = await prisma.desiredEvents.findMany({
      where: { userId },
      include: { eventsList: true }
    });

    const conflicts: ConflictInfo[] = [];
    const newEventStart = new Date(newEvent.startDateTime);
    const newEventEnd = new Date(newEvent.endDateTime);

    for (const desiredEvent of userDesiredEvents) {
      const existingEvent = desiredEvent.eventsList;
      if (existingEvent.startDateTime && existingEvent.endDateTime) {
        const existingStart = new Date(existingEvent.startDateTime);
        const existingEnd = new Date(existingEvent.endDateTime);

        // Check for overlap
        if (newEventStart < existingEnd && newEventEnd > existingStart) {
          conflicts.push({
            eventsListId: existingEvent.id,
            title: existingEvent.title,
            startDateTime: existingEvent.startDateTime,
            endDateTime: existingEvent.endDateTime
          });
        }
      }
    }

    return conflicts;
  }

  // Private method to check capacity warning
  private static async checkCapacity(eventsListId: string, ticketsAvailable: number | null): Promise<boolean> {
    if (!ticketsAvailable) {
      return false;
    }

    const signupCount = await prisma.desiredEvents.count({
      where: { eventsListId }
    });

    return signupCount >= ticketsAvailable;
  }
}