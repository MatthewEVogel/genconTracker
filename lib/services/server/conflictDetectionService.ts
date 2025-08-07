import { prisma } from '@/lib/prisma';

export interface ConflictEvent {
  id: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  type: 'personal' | 'desired' | 'tracked' | 'purchased';
  source?: string;   // Additional context
}

export interface ConflictResponse {
  hasConflicts: boolean;
  conflicts: ConflictEvent[];
}

export interface ConflictCheckOptions {
  userId: string;
  startTime: Date | string;
  endTime: Date | string;
  excludeEventId?: string; // For updates - exclude the event being updated
  excludeEventType?: 'personal' | 'desired' | 'tracked' | 'purchased'; // Type of event being excluded
}

export class ConflictDetectionService {
  /**
   * Check for conflicts across all event types for a given user and time range
   */
  static async checkConflicts(options: ConflictCheckOptions): Promise<ConflictResponse> {
    const { userId, excludeEventId, excludeEventType } = options;
    
    // Normalize dates
    const startTime = new Date(options.startTime);
    const endTime = new Date(options.endTime);

    if (startTime >= endTime) {
      throw new Error('Start time must be before end time');
    }

    console.log(`\n🔍 CONFLICT DETECTION DEBUG - User: ${userId}`);
    console.log(`📅 Checking time range: ${startTime.toISOString()} - ${endTime.toISOString()}`);
    console.log(`🚫 Excluding: ${excludeEventId ? `${excludeEventId} (${excludeEventType})` : 'none'}`);

    const conflicts: ConflictEvent[] = [];

    // Check all event types in parallel for better performance
    // NOTE: Tracked events are excluded from conflict detection as they are for monitoring only
    const [
      personalConflicts,
      desiredConflicts,
      purchasedConflicts
    ] = await Promise.all([
      this.checkPersonalEventConflicts(userId, startTime, endTime, excludeEventId, excludeEventType),
      this.checkDesiredEventConflicts(userId, startTime, endTime, excludeEventId, excludeEventType),
      this.checkPurchasedEventConflicts(userId, startTime, endTime, excludeEventId, excludeEventType)
    ]);

    conflicts.push(...personalConflicts, ...desiredConflicts, ...purchasedConflicts);

    console.log(`\n📊 CONFLICT SUMMARY:`);
    console.log(`   Personal: ${personalConflicts.length} conflicts`);
    console.log(`   Desired: ${desiredConflicts.length} conflicts`);
    console.log(`   Tracked: EXCLUDED (monitoring only)`);
    console.log(`   Purchased: ${purchasedConflicts.length} conflicts`);
    console.log(`   TOTAL: ${conflicts.length} conflicts`);

    if (conflicts.length > 0) {
      console.log(`\n⚠️  CONFLICTS FOUND:`);
      conflicts.slice(0, 5).forEach((conflict, index) => {
        console.log(`   ${index + 1}. [${conflict.type}] ${conflict.title} (${conflict.startTime} - ${conflict.endTime})`);
      });
      if (conflicts.length > 5) {
        console.log(`   ... and ${conflicts.length - 5} more conflicts`);
      }
    } else {
      console.log(`✅ No conflicts found`);
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Check for conflicts with personal events (manually created)
   */
  private static async checkPersonalEventConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string,
    excludeEventType?: string
  ): Promise<ConflictEvent[]> {
    // First get ALL personal events for the user (not just conflicting ones)
    const allPersonalEventsClause: any = {
      OR: [
        { createdBy: userId },
        { attendees: { has: userId } }
      ]
    };

    // Exclude the event being updated if it's a personal event
    if (excludeEventId && excludeEventType === 'personal') {
      allPersonalEventsClause.id = { not: excludeEventId };
    }

    const allPersonalEvents = await prisma.personalEvent.findMany({
      where: allPersonalEventsClause,
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            genConName: true
          }
        }
      }
    });

    console.log(`\n👤 PERSONAL EVENTS CHECK:`);
    console.log(`   Found ${allPersonalEvents.length} personal events for user ${userId}`);
    allPersonalEvents.slice(0, 10).forEach((event: any, index) => {
      console.log(`   ${index + 1}. "${event.title}" (${event.startTime.toISOString()} - ${event.endTime.toISOString()}) by ${event.creator.firstName} ${event.creator.lastName}`);
    });
    if (allPersonalEvents.length > 10) {
      console.log(`   ... and ${allPersonalEvents.length - 10} more personal events`);
    }

    // Now filter for only the conflicting ones
    const conflictingEvents = allPersonalEvents.filter((event: any) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check for time overlap
      return startTime < eventEnd && endTime > eventStart;
    });

    return conflictingEvents.map((event: any) => ({
      id: event.id,
      title: event.title,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      type: 'personal' as const,
      source: `Created by ${event.creator.firstName} ${event.creator.lastName}`
    }));
  }

  /**
   * Check for conflicts with desired events (from event browser wishlist)
   */
  private static async checkDesiredEventConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string,
    excludeEventType?: string
  ): Promise<ConflictEvent[]> {
    const whereClause: any = {
      userId: userId
    };

    // Exclude the event being updated if it's a desired event
    if (excludeEventId && excludeEventType === 'desired') {
      whereClause.eventsListId = { not: excludeEventId };
    }

    const desiredEvents = await prisma.desiredEvents.findMany({
      where: whereClause,
      include: {
        eventsList: true
      }
    });

    console.log(`\n🎯 DESIRED EVENTS CHECK:`);
    console.log(`   Found ${desiredEvents.length} desired events for user ${userId}`);
    desiredEvents.slice(0, 10).forEach((desiredEvent, index) => {
      const event = desiredEvent.eventsList;
      if (event.startDateTime && event.endDateTime) {
        console.log(`   ${index + 1}. "${event.title}" (${event.startDateTime} - ${event.endDateTime})`);
      } else {
        console.log(`   ${index + 1}. "${event.title}" (NO TIME DATA)`);
      }
    });
    if (desiredEvents.length > 10) {
      console.log(`   ... and ${desiredEvents.length - 10} more desired events`);
    }

    const conflicts: ConflictEvent[] = [];

    console.log(`   Checking for time overlaps with new event time range: ${startTime.toISOString()} - ${endTime.toISOString()}`);

    for (const desiredEvent of desiredEvents) {
      const event = desiredEvent.eventsList;
      if (event.startDateTime && event.endDateTime) {
        const eventStart = new Date(event.startDateTime);
        const eventEnd = new Date(event.endDateTime);

        console.log(`   Checking overlap: "${event.title}" (${event.startDateTime} - ${event.endDateTime})`);
        console.log(`     New event: ${startTime.toISOString()} - ${endTime.toISOString()}`);
        console.log(`     Existing: ${eventStart.toISOString()} - ${eventEnd.toISOString()}`);
        console.log(`     Overlap check: startTime(${startTime.toISOString()}) < eventEnd(${eventEnd.toISOString()}) = ${startTime < eventEnd}`);
        console.log(`     Overlap check: endTime(${endTime.toISOString()}) > eventStart(${eventStart.toISOString()}) = ${endTime > eventStart}`);

        // Check for time overlap
        if (startTime < eventEnd && endTime > eventStart) {
          console.log(`     ⚠️  CONFLICT DETECTED with "${event.title}"`);
          conflicts.push({
            id: event.id,
            title: event.title,
            startTime: event.startDateTime,
            endTime: event.endDateTime,
            type: 'desired' as const,
            source: 'Added from event browser'
          });
        } else {
          console.log(`     ✅ No conflict with "${event.title}"`);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check for conflicts with tracked events (from event browser tracking)
   */
  private static async checkTrackedEventConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string,
    excludeEventType?: string
  ): Promise<ConflictEvent[]> {
    const user = await prisma.userList.findUnique({
      where: { id: userId },
      include: {
        trackedEvents: true
      }
    });

    console.log(`\n📍 TRACKED EVENTS CHECK:`);
    if (!user?.trackedEvents) {
      console.log(`   No tracked events found for user ${userId}`);
      return [];
    }

    console.log(`   Found ${user.trackedEvents.length} tracked events for user ${userId}`);
    user.trackedEvents.slice(0, 10).forEach((event, index) => {
      if (event.startDateTime && event.endDateTime) {
        console.log(`   ${index + 1}. "${event.title}" (${event.startDateTime} - ${event.endDateTime})`);
      } else {
        console.log(`   ${index + 1}. "${event.title}" (NO TIME DATA)`);
      }
    });
    if (user.trackedEvents.length > 10) {
      console.log(`   ... and ${user.trackedEvents.length - 10} more tracked events`);
    }

    const conflicts: ConflictEvent[] = [];

    for (const event of user.trackedEvents) {
      // Skip if this is the event being excluded
      if (excludeEventId && excludeEventType === 'tracked' && event.id === excludeEventId) {
        continue;
      }

      if (event.startDateTime && event.endDateTime) {
        const eventStart = new Date(event.startDateTime);
        const eventEnd = new Date(event.endDateTime);

        // Check for time overlap
        if (startTime < eventEnd && endTime > eventStart) {
          conflicts.push({
            id: event.id,
            title: event.title,
            startTime: event.startDateTime,
            endTime: event.endDateTime,
            type: 'tracked' as const,
            source: 'Tracked from event browser'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check for conflicts with purchased events (from GenCon purchases)
   */
  private static async checkPurchasedEventConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string,
    excludeEventType?: string
  ): Promise<ConflictEvent[]> {
    // Get user's genConName to match against purchased events
    const user = await prisma.userList.findUnique({
      where: { id: userId },
      select: { genConName: true }
    });

    console.log(`\n💳 PURCHASED EVENTS CHECK:`);
    if (!user?.genConName) {
      console.log(`   No genConName found for user ${userId} - skipping purchased events check`);
      return [];
    }

    console.log(`   Checking purchased events for genConName: ${user.genConName}`);

    // Get purchased events for this user (by genConName)
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

    console.log(`   Found ${purchasedEvents.length} purchased events (including refunded)`);

    // Filter out refunded events
    const activePurchasedEvents = purchasedEvents.filter(
      pe => pe.refundedEvents.length === 0
    );

    console.log(`   Found ${activePurchasedEvents.length} active (non-refunded) purchased events`);

    // Get event details for all purchased events
    const eventIds = activePurchasedEvents.map(pe => pe.eventId);
    
    // Exclude the event being updated if it's a purchased event
    const filteredEventIds = excludeEventId && excludeEventType === 'purchased' 
      ? eventIds.filter(id => id !== excludeEventId)
      : eventIds;

    if (filteredEventIds.length === 0) {
      console.log(`   No purchased event IDs to check after filtering`);
      return [];
    }

    const eventsData = await prisma.eventsList.findMany({
      where: {
        id: { in: filteredEventIds }
      }
    });

    console.log(`   Retrieved details for ${eventsData.length} purchased events:`);
    eventsData.slice(0, 10).forEach((event, index) => {
      if (event.startDateTime && event.endDateTime) {
        console.log(`   ${index + 1}. "${event.title}" (${event.startDateTime} - ${event.endDateTime})`);
      } else {
        console.log(`   ${index + 1}. "${event.title}" (NO TIME DATA)`);
      }
    });
    if (eventsData.length > 10) {
      console.log(`   ... and ${eventsData.length - 10} more purchased events`);
    }

    const conflicts: ConflictEvent[] = [];

    for (const event of eventsData) {
      if (event.startDateTime && event.endDateTime) {
        const eventStart = new Date(event.startDateTime);
        const eventEnd = new Date(event.endDateTime);

        // Check for time overlap
        if (startTime < eventEnd && endTime > eventStart) {
          conflicts.push({
            id: event.id,
            title: event.title,
            startTime: event.startDateTime,
            endTime: event.endDateTime,
            type: 'purchased' as const,
            source: 'Purchased ticket'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Utility method to check if two time ranges overlap
   */
  static timeRangesOverlap(
    start1: Date | string,
    end1: Date | string,
    start2: Date | string,
    end2: Date | string
  ): boolean {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);

    return s1 < e2 && e1 > s2;
  }
}
