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
        userEvents: {
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
    const userEvents = await prisma.userEvent.findMany({
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

    return { userEvents };
  }

  // Add an event to a user's schedule
  static async addUserEvent(userId: string, eventId: string): Promise<AddEventResponse> {
    // Check if the user already has this event
    const existingUserEvent = await prisma.userEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    if (existingUserEvent) {
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
    await prisma.userEvent.create({
      data: {
        userId,
        eventId
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
    const userEvent = await prisma.userEvent.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
        }
      }
    });

    if (!userEvent) {
      throw new Error('Event not found in schedule');
    }

    await prisma.userEvent.delete({
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
      events: user.userEvents.map((userEvent: any) => ({
        id: userEvent.event.id,
        title: userEvent.event.title,
        startDateTime: userEvent.event.startDateTime,
        endDateTime: userEvent.event.endDateTime,
        eventType: userEvent.event.eventType,
        location: userEvent.event.location,
        cost: userEvent.event.cost,
        ticketsAvailable: userEvent.event.ticketsAvailable
      }))
    }));
  }

  // Private method to check for event conflicts and capacity warnings
  private static async checkEventConflicts(userId: string, newEvent: any) {
    const conflicts = [];
    let capacityWarning = false;

    // Check for time conflicts with existing user events
    if (newEvent.startDateTime && newEvent.endDateTime) {
      const userEvents = await prisma.userEvent.findMany({
        where: { userId },
        include: { event: true }
      });

      for (const userEvent of userEvents) {
        const existingEvent = userEvent.event;
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
              startDateTime: existingEvent.startDateTime,
              endDateTime: existingEvent.endDateTime
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