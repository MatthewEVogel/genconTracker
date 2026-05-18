import { prisma } from '@/lib/prisma';
import { ConflictDetectionService } from './conflictDetectionService';

export interface ScheduleEvent {
  id: string;
  title: string;
  startDateTime: string | null;
  endDateTime: string | null;
  eventType?: string | null;
  location?: string | null;
  cost?: string | null;
  ticketsAvailable?: number | null;
  shortDescription?: string | null;
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

export type ScheduleFilter = 'wishlist' | 'purchased';

export class ScheduleService {
  /**
   * Helper to convert Date or string to ISO string
   */
  private static toISOString(date: Date | string | null): string | null {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
  }

  // Get schedule data for all users
  static async getScheduleData(filter: ScheduleFilter = 'wishlist'): Promise<ScheduleResponse> {
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

    const scheduleData = this.transformUsersToScheduleData(users, activePurchasedEvents, eventsMap, filter);
    return { scheduleData };
  }

  // Get events for a specific user
  static async getUserEvents(userId: string, filter: ScheduleFilter = 'wishlist'): Promise<UserEventResponse> {
    if (filter === 'purchased') {
      // Get the user's genConName for matching purchased events
      const user = await prisma.userList.findUnique({
        where: { id: userId },
        select: { genConName: true }
      });

      if (!user) {
        return { userEvents: [] };
      }

      // Get purchased events for this user (excluding refunded ones)
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

      // Filter out refunded events
      const activePurchasedEvents = purchasedEvents.filter(
        purchased => purchased.refundedEvents.length === 0
      );

      // Get event details
      const eventIds = activePurchasedEvents.map(pe => pe.eventId);
      const eventsData = await prisma.eventsList.findMany({
        where: {
          id: { in: eventIds }
        },
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
      });

      // Transform to match expected format
      const userEvents = eventsData.map(event => ({
        event: {
          ...event,
          startDateTime: this.toISOString(event.startDateTime),
          endDateTime: this.toISOString(event.endDateTime)
        }
      }));

      return { userEvents };
    }

    // Default: wishlist mode - only show desired events
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

    // Transform to maintain API compatibility - convert dates to ISO strings
    const userEvents = desiredEvents.map(de => ({
      event: {
        ...de.eventsList,
        startDateTime: this.toISOString(de.eventsList.startDateTime),
        endDateTime: this.toISOString(de.eventsList.endDateTime)
      }
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
    eventsMap: Map<string, any>,
    filter: ScheduleFilter = 'wishlist'
  ): ScheduleUser[] {
    // Start with existing users
    let scheduleUsers: ScheduleUser[];

    if (filter === 'purchased') {
      // For purchased mode, start with empty events
      scheduleUsers = users.map(user => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
        events: []
      }));
    } else {
      // For wishlist mode, show desired events
      scheduleUsers = users.map(user => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
        events: user.desiredEvents.map((desiredEvent: any) => ({
          id: desiredEvent.eventsList.id,
          title: desiredEvent.eventsList.title,
          startDateTime: this.toISOString(desiredEvent.eventsList.startDateTime),
          endDateTime: this.toISOString(desiredEvent.eventsList.endDateTime),
          eventType: desiredEvent.eventsList.eventType,
          location: desiredEvent.eventsList.location,
          cost: desiredEvent.eventsList.cost,
          ticketsAvailable: desiredEvent.eventsList.ticketsAvailable,
          shortDescription: desiredEvent.eventsList.shortDescription
        }))
      }));
    }

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
      
      // Convert purchased events to schedule events and remove duplicates within purchased events
      const purchasedScheduleEventsMap = new Map<string, ScheduleEvent>();
      purchasedEvents.forEach(pe => {
        const eventData = eventsMap.get(pe.eventId);
        if (eventData && !purchasedScheduleEventsMap.has(eventData.id)) {
          purchasedScheduleEventsMap.set(eventData.id, {
            id: eventData.id,
            title: eventData.title,
            startDateTime: this.toISOString(eventData.startDateTime),
            endDateTime: this.toISOString(eventData.endDateTime),
            eventType: eventData.eventType,
            location: eventData.location,
            cost: eventData.cost,
            ticketsAvailable: eventData.ticketsAvailable,
            shortDescription: eventData.shortDescription
          } as ScheduleEvent);
        }
      });

      const purchasedScheduleEvents = Array.from(purchasedScheduleEventsMap.values());

      if (matchingUser) {
        // Add purchased events to existing user's schedule
        if (filter === 'purchased') {
          // In purchased mode, only show purchased events
          matchingUser.events.push(...purchasedScheduleEvents);
        } else {
          // In wishlist mode, skip purchased events entirely
          // (we only want to show desired events)
        }
      } else {
        // Create new user row for purchased events with no matching genConName (only in purchased mode)
        if (filter === 'purchased') {
          const originalRecipientName = purchasedEvents[0]?.recipient || recipientName;
          scheduleUsers.push({
            id: `purchased-${recipientName}`, // Use a unique ID for purchased-only users
            name: `${originalRecipientName} (👻)`,
            events: purchasedScheduleEvents
          });
        }
      }
    }

    // Final deduplication pass - ensure no user has duplicate events
    scheduleUsers.forEach(user => {
      const uniqueEventsMap = new Map<string, ScheduleEvent>();
      user.events.forEach(event => {
        if (!uniqueEventsMap.has(event.id)) {
          uniqueEventsMap.set(event.id, event);
        }
      });
      user.events = Array.from(uniqueEventsMap.values());
    });

    return scheduleUsers;
  }

  // Private method to check for event conflicts and capacity warnings
  private static async checkEventConflicts(userId: string, newEvent: any) {
    const conflicts = [];
    let capacityWarning = false;

    // Use the unified conflict detection service for comprehensive conflict checking
    if (newEvent.startDateTime && newEvent.endDateTime) {
      const conflictResult = await ConflictDetectionService.checkConflicts({
        userId,
        startTime: newEvent.startDateTime,
        endTime: newEvent.endDateTime,
        excludeEventId: newEvent.id,
        excludeEventType: 'desired'
      });

      // Transform conflicts to match the existing API format
      if (conflictResult.hasConflicts) {
        conflicts.push(...conflictResult.conflicts.map(conflict => ({
          id: conflict.id,
          title: conflict.type === 'purchased' ? `${conflict.title} (Purchased)` : conflict.title,
          startDateTime: conflict.startTime,
          endDateTime: conflict.endTime
        })));
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
