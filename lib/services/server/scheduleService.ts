import { prisma } from '@/lib/prisma';

export interface ScheduleEvent {
  id: string;
  title: string;
  startDateTime: string | null;
  endDateTime: string | null;
  eventType?: string | null;
  location?: string | null;
  cost?: string | null;
  ticketsAvailable?: number | null;
}

export interface ScheduleUser {
  id: string;
  name: string;
  events: ScheduleEvent[];
}

export interface ScheduleResponse {
  scheduleData: ScheduleUser[];
}

export interface UserEventResponse {
  userEvents: Array<{
    event: {
      id: string;
      title: string;
      startDateTime: string | null;
      endDateTime: string | null;
      eventType?: string | null;
      location?: string | null;
      cost?: string | null;
      ticketsAvailable?: number | null;
    };
  }>;
}

export interface AddEventResponse {
  message: string;
  conflicts?: Array<{
    id: string;
    title: string;
    startDateTime: string | null;
    endDateTime: string | null;
  }>;
  capacityWarning?: boolean;
}

export interface RemoveEventResponse {
  message: string;
}

export class ScheduleService {
  // Get schedule data for all users
  static async getScheduleData(): Promise<ScheduleResponse> {
    const users = await prisma.user.findMany({
      include: {
        desiredEvents: {
          include: {
            event: true
          }
        }
      }
    });

    const scheduleData = this.transformUsersToScheduleData(users);
    return { scheduleData };
  }

  // Get events for a specific user
  static async getUserEvents(userId: string): Promise<UserEventResponse> {
    const desiredEvents = await prisma.desiredEvent.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDateTime: true,
            endDateTime: true,
            eventType: true,
            location: true,
            cost: true,
            ticketsAvailable: true,
          }
        }
      }
    });

    // Transform to match the expected format
    const userEvents = desiredEvents.map(desiredEvent => ({
      event: {
        ...desiredEvent.event,
        // Convert DateTime to string | null to match interface
        startDateTime: desiredEvent.event.startDateTime?.toISOString() || null,
        endDateTime: desiredEvent.event.endDateTime?.toISOString() || null,
        // Convert Decimal to string | null for cost
        cost: desiredEvent.event.cost?.toString() || null,
      }
    }));

    return { userEvents };
  }

  // Add an event to a user's schedule
  static async addUserEvent(userId: string, eventId: string): Promise<AddEventResponse> {
    // Check if the user already has this event
    const existingDesiredEvent = await prisma.desiredEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    if (existingDesiredEvent) {
      throw new Error('Event already in schedule');
    }

    // Get the event details
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check for conflicts and capacity
    const { conflicts, capacityWarning } = await this.checkEventConflicts(userId, event);

    // Add the event to the user's schedule
    await prisma.desiredEvent.create({
      data: {
        userId,
        eventId,
        priority: 1 // Default priority
      }
    });

    return {
      message: 'Event added to schedule',
      conflicts,
      capacityWarning
    };
  }

  // Remove an event from a user's schedule
  static async removeUserEvent(userId: string, eventId: string): Promise<RemoveEventResponse> {
    const desiredEvent = await prisma.desiredEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    if (!desiredEvent) {
      throw new Error('Event not found in schedule');
    }

    await prisma.desiredEvent.delete({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    return {
      message: 'Event removed from schedule'
    };
  }

  // Private method to transform user data for schedule display
  private static transformUsersToScheduleData(users: any[]): ScheduleUser[] {
    return users.map(user => ({
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
      events: user.desiredEvents.map((desiredEvent: any) => ({
        id: desiredEvent.event.id,
        title: desiredEvent.event.title,
        startDateTime: desiredEvent.event.startDateTime?.toISOString() || null,
        endDateTime: desiredEvent.event.endDateTime?.toISOString() || null,
        eventType: desiredEvent.event.eventType,
        location: desiredEvent.event.location,
        cost: desiredEvent.event.cost?.toString() || null,
        ticketsAvailable: desiredEvent.event.ticketsAvailable
      }))
    }));
  }

  // Private method to check for event conflicts and capacity warnings
  private static async checkEventConflicts(userId: string, newEvent: any) {
    const conflicts = [];
    let capacityWarning = false;

    // Check for time conflicts with existing desired events
    if (newEvent.startDateTime && newEvent.endDateTime) {
      const desiredEvents = await prisma.desiredEvent.findMany({
        where: { userId },
        include: { event: true }
      });

      for (const desiredEvent of desiredEvents) {
        const existingEvent = desiredEvent.event;
        if (existingEvent.startDateTime && existingEvent.endDateTime) {
          const newStart = new Date(newEvent.startDateTime);
          const newEnd = new Date(newEvent.endDateTime);
          const existingStart = new Date(existingEvent.startDateTime);
          const existingEnd = new Date(existingEvent.endDateTime);

          // Check for overlap
          if (newStart < existingEnd && newEnd > existingStart) {
            conflicts.push({
              id: existingEvent.id,
              title: existingEvent.title,
              startDateTime: existingEvent.startDateTime?.toISOString() || null,
              endDateTime: existingEvent.endDateTime?.toISOString() || null
            });
          }
        }
      }
    }

    // Check capacity warning
    if (newEvent.ticketsAvailable !== null && newEvent.ticketsAvailable <= 0) {
      capacityWarning = true;
    }

    return { conflicts, capacityWarning };
  }
}