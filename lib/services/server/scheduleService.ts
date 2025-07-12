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
    const users = await prisma.userList.findMany({
      include: {
        desiredEvents: {
          include: {
            eventsList: true
          }
        }
      }
    });

    // Get purchased events that haven't been refunded
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      include: {
        refundedEvents: true
      }
    });

    // Filter out purchased events that have been refunded
    const activePurchasedEvents = purchasedEvents.filter(
      purchased => purchased.refundedEvents.length === 0
    );

    // Get all events from EventsList for purchased events
    const eventIds = activePurchasedEvents.map(pe => pe.eventId);
    const eventsData = await prisma.eventsList.findMany({
      where: {
        id: { in: eventIds }
      }
    });

    // Create a map for quick event lookup
    const eventsMap = new Map(eventsData.map(event => [event.id, event]));

    const scheduleData = this.transformUsersToScheduleData(users, activePurchasedEvents, eventsMap);
    return { scheduleData };
  }

  // Get events for a specific user
  static async getUserEvents(userId: string): Promise<UserEventResponse> {
    const desiredEvents = await prisma.desiredEvents.findMany({
      where: { userId },
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
          }
        }
      }
    });

    // Transform to maintain API compatibility
    const userEvents = desiredEvents.map(de => ({
      event: de.eventsList
    }));

    return { userEvents };
  }

  // Add an event to a user's schedule
  static async addUserEvent(userId: string, eventId: string): Promise<AddEventResponse> {
    // Check if the user already has this event
    const existingDesiredEvent = await prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId: eventId
        }
      }
    });

    if (existingDesiredEvent) {
      throw new Error('Event already in schedule');
    }

    // Get the event details from EventsList
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check for conflicts and capacity
    const { conflicts, capacityWarning } = await this.checkEventConflicts(userId, event);

    // Add the event to the user's schedule
    await prisma.desiredEvents.create({
      data: {
        userId,
        eventsListId: eventId
      }
    });

    return {
      message: 'Event added to schedule',
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      capacityWarning
    };
  }

  // Remove an event from a user's schedule
  static async removeUserEvent(userId: string, eventId: string): Promise<RemoveEventResponse> {
    const desiredEvent = await prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId: eventId
        }
      }
    });

    if (!desiredEvent) {
      throw new Error('Event not found in schedule');
    }

    await prisma.desiredEvents.delete({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId: eventId
        }
      }
    });

    return {
      message: 'Event removed from schedule'
    };
  }

  // Private method to transform user data for schedule display
  private static transformUsersToScheduleData(
    users: any[], 
    activePurchasedEvents: any[], 
    eventsMap: Map<string, any>
  ): ScheduleUser[] {
    // Start with existing users and their desired events
    const scheduleUsers: ScheduleUser[] = users.map(user => ({
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
      events: user.desiredEvents.map((desiredEvent: any) => ({
        id: desiredEvent.eventsList.id,
        title: desiredEvent.eventsList.title,
        startDateTime: desiredEvent.eventsList.startDateTime,
        endDateTime: desiredEvent.eventsList.endDateTime,
        eventType: desiredEvent.eventsList.eventType,
        location: desiredEvent.eventsList.location,
        cost: desiredEvent.eventsList.cost,
        ticketsAvailable: desiredEvent.eventsList.ticketsAvailable
      }))
    }));

    // Create a map of users by their genConName for quick lookup
    const usersByGenConName = new Map<string, ScheduleUser>();
    scheduleUsers.forEach(user => {
      const matchingUser = users.find(u => u.id === user.id);
      if (matchingUser?.genConName) {
        usersByGenConName.set(matchingUser.genConName.toLowerCase().trim(), user);
      }
    });

    // Group purchased events by recipient name
    const purchasedEventsByRecipient = new Map<string, any[]>();
    activePurchasedEvents.forEach(purchasedEvent => {
      const recipientName = purchasedEvent.recipient.toLowerCase().trim();
      if (!purchasedEventsByRecipient.has(recipientName)) {
        purchasedEventsByRecipient.set(recipientName, []);
      }
      purchasedEventsByRecipient.get(recipientName)!.push(purchasedEvent);
    });

    // Add purchased events to matching users or create new user rows
    for (const [recipientName, purchasedEvents] of purchasedEventsByRecipient) {
      const matchingUser = usersByGenConName.get(recipientName);
      
      // Convert purchased events to schedule events
      const purchasedScheduleEvents: ScheduleEvent[] = purchasedEvents
        .map(pe => {
          const eventData = eventsMap.get(pe.eventId);
          if (!eventData) return null;
          
          return {
            id: eventData.id,
            title: eventData.title,
            startDateTime: eventData.startDateTime,
            endDateTime: eventData.endDateTime,
            eventType: eventData.eventType,
            location: eventData.location,
            cost: eventData.cost,
            ticketsAvailable: eventData.ticketsAvailable
          } as ScheduleEvent;
        })
        .filter((event): event is ScheduleEvent => event !== null);

      if (matchingUser) {
        // Add purchased events to existing user's schedule
        matchingUser.events.push(...purchasedScheduleEvents);
      } else {
        // Create new user row for purchased events with no matching genConName
        const originalRecipientName = purchasedEvents[0]?.recipient || recipientName;
        scheduleUsers.push({
          id: `purchased-${recipientName}`, // Use a unique ID for purchased-only users
          name: `${originalRecipientName} (👻)`,
          events: purchasedScheduleEvents
        });
      }
    }

    return scheduleUsers;
  }

  // Private method to check for event conflicts and capacity warnings
  private static async checkEventConflicts(userId: string, newEvent: any) {
    const conflicts = [];
    let capacityWarning = false;

    // Check for time conflicts with existing desired events
    if (newEvent.startDateTime && newEvent.endDateTime) {
      const desiredEvents = await prisma.desiredEvents.findMany({
        where: { userId },
        include: { eventsList: true }
      });

      for (const desiredEvent of desiredEvents) {
        const existingEvent = desiredEvent.eventsList;
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

      // Also check for conflicts with purchased events for this user
      const user = await prisma.userList.findUnique({
        where: { id: userId }
      });

      if (user?.genConName) {
        const purchasedEvents = await prisma.purchasedEvents.findMany({
          where: {
            recipient: {
              equals: user.genConName,
              mode: 'insensitive'
            }
          },
          include: {
            refundedEvents: true
          }
        });

        // Filter out refunded events and check for conflicts
        const activePurchasedEvents = purchasedEvents.filter(
          pe => pe.refundedEvents.length === 0
        );

        for (const purchasedEvent of activePurchasedEvents) {
          const eventData = await prisma.eventsList.findUnique({
            where: { id: purchasedEvent.eventId }
          });

          if (eventData?.startDateTime && eventData?.endDateTime) {
            const newStart = new Date(newEvent.startDateTime);
            const newEnd = new Date(newEvent.endDateTime);
            const existingStart = new Date(eventData.startDateTime);
            const existingEnd = new Date(eventData.endDateTime);

            // Check for overlap
            if (newStart < existingEnd && newEnd > existingStart) {
              conflicts.push({
                id: eventData.id,
                title: `${eventData.title} (Purchased)`,
                startDateTime: eventData.startDateTime,
                endDateTime: eventData.endDateTime
              });
            }
          }
        }
      }
    }

    // Check capacity warning
    if (newEvent.ticketsAvailable !== null) {
      const currentCount = await prisma.desiredEvents.count({
        where: { eventsListId: newEvent.id }
      });
      
      // Warning if we're at or over capacity (including the one we just added)
      if (currentCount >= newEvent.ticketsAvailable) {
        capacityWarning = true;
      }
    }

    return { conflicts, capacityWarning };
  }
}
