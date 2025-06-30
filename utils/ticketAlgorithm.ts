interface UserEventData {
  userId: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  cost: string;
  eventPriority?: number; // Optional: event's priority if provided
}

interface EventSummary {
  eventId: string;
  eventTitle: string;
  cost: string;
  priority: number; // Event's inherent priority (1=Normal, 2=Important, 3=Critical)
  interestedUsers: {
    userId: string;
    userName: string;
  }[];
}

export interface TicketAssignment {
  userId: string;
  userName: string;
  events: {
    eventId: string;
    eventTitle: string;
    priority: number;
    buyingFor: string[]; // list of user names
    cost: string;
  }[];
  totalTickets: number;
}

const EVENT_LIMIT = 50; // Maximum events per user (not tickets)

// Track current state for iterative assignment
interface EventState {
  event: EventSummary;
  currentBuyerCount: number;
}

interface UserState {
  userId: string;
  userName: string;
  currentEventCount: number;
}

// Sort events by priority (highest first), then by number of interested users
function sortEventsByPriority(events: EventSummary[]): EventSummary[] {
  return events.sort((a, b) => {
    // First sort by priority (higher priority first)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    // Then by number of interested users (more users first)
    return b.interestedUsers.length - a.interestedUsers.length;
  });
}

// Calculate how many more events each user can take
function getAvailableCapacity(userEventCounts: Map<string, number>): number {
  let totalAvailable = 0;
  for (const count of userEventCounts.values()) {
    totalAvailable += Math.max(0, EVENT_LIMIT - count);
  }
  return totalAvailable;
}

// This function is no longer needed with the new iterative algorithm
// Keeping it for now but it won't be used
function assignBuyersForEvent(
  event: EventSummary,
  targetBuyers: number,
  userTicketCounts: Map<string, number>,
  allUsers: string[]
): string[] {
  return [];
}

export function calculateTicketAssignments(
  userEvents: UserEventData[], 
  allUsers?: {userId: string, userName: string}[]
): {
  assignments: TicketAssignment[];
  errors: string[];
} {
  const errors: string[] = [];
  
  // Get unique users - use provided allUsers if available, otherwise extract from userEvents
  let users: {userId: string, userName: string}[];
  if (allUsers && allUsers.length > 0) {
    users = allUsers;
  } else {
    // Deduplicate users from userEvents
    const userSet = new Map<string, {userId: string, userName: string}>();
    userEvents.forEach(ue => {
      userSet.set(ue.userId, { userId: ue.userId, userName: ue.userName });
    });
    users = Array.from(userSet.values());
  }
  
  const userMap = new Map(users.map(u => [u.userId, u.userName]));
  const allUserIds = users.map(u => u.userId);
  
  // If no users, return empty assignments
  if (users.length === 0) {
    return { assignments: [], errors: ['No users found'] };
  }
  
  // Group events by eventId and use event priority if provided
  const eventMap = new Map<string, EventSummary>();
  
  for (const userEvent of userEvents) {
    if (!eventMap.has(userEvent.eventId)) {
      eventMap.set(userEvent.eventId, {
        eventId: userEvent.eventId,
        eventTitle: userEvent.eventTitle,
        cost: userEvent.cost,
        priority: userEvent.eventPriority || 1, // Use provided priority or default to 1
        interestedUsers: []
      });
    }
    
    const event = eventMap.get(userEvent.eventId)!;
    
    // Update priority if a higher one is provided
    if (userEvent.eventPriority && userEvent.eventPriority > event.priority) {
      event.priority = userEvent.eventPriority;
    }
    
    // Check if this user is already in the interested users list to prevent duplicates
    const existingUserIndex = event.interestedUsers.findIndex(u => u.userId === userEvent.userId);
    if (existingUserIndex < 0) {
      // Add new user to interested users
      event.interestedUsers.push({
        userId: userEvent.userId,
        userName: userEvent.userName
      });
    }
  }
  
  const events = Array.from(eventMap.values());
  const sortedEvents = sortEventsByPriority(events);
  
  // Initialize ticket counts for each user
  const userTicketCounts = new Map<string, number>();
  allUserIds.forEach(userId => userTicketCounts.set(userId, 0));
  
  // Track which events each user is buying
  const userAssignments = new Map<string, {
    eventId: string;
    eventTitle: string;
    priority: number;
    buyingFor: string[];
    cost: string;
  }[]>();
  
  allUserIds.forEach(userId => userAssignments.set(userId, []));
  
  // NEW ITERATIVE ALGORITHM: Even coverage with priority-based processing
  
  // Group events by priority tier
  const eventsByPriority = new Map<number, EventSummary[]>();
  for (const event of sortedEvents) {
    const priority = event.priority;
    if (!eventsByPriority.has(priority)) {
      eventsByPriority.set(priority, []);
    }
    eventsByPriority.get(priority)!.push(event);
  }
  
  // Process each priority tier in order (3 -> 2 -> 1)
  const priorityLevels = [3, 2, 1];
  
  // Track which events have already been processed to avoid double-processing
  const processedEvents = new Set<string>();
  
  for (const priorityLevel of priorityLevels) {
    const eventsInTier = eventsByPriority.get(priorityLevel) || [];
    if (eventsInTier.length === 0) continue;
    
    // Filter out events that were already processed in higher priority tiers
    const unprocessedEventsInTier = eventsInTier.filter(event => !processedEvents.has(event.eventId));
    if (unprocessedEventsInTier.length === 0) continue;
    
    // Track current buyer count for each event in this tier
    const eventBuyerCounts = new Map<string, number>();
    unprocessedEventsInTier.forEach(event => eventBuyerCounts.set(event.eventId, 0));
    
    // Track which events each user is already assigned to buy (prevent duplicates)
    const userEventAssignments = new Map<string, Set<string>>();
    allUserIds.forEach(userId => userEventAssignments.set(userId, new Set()));
    
    // Iteratively assign buyers until stopping conditions are met
    while (true) {
      // Check if any users have capacity
      const usersWithCapacity = allUserIds.filter(userId => userTicketCounts.get(userId)! < EVENT_LIMIT);
      
      // STOPPING CONDITION 2: All users at 50-event limit
      if (usersWithCapacity.length === 0) break;
      
      // STOPPING CONDITION 1: Maximum coverage achieved 
      // (every event assigned to every available user who doesn't already have it)
      const maxCoverageAchieved = unprocessedEventsInTier.every(event => {
        const usersWhoCanTakeThisEvent = usersWithCapacity.filter(userId => 
          !userEventAssignments.get(userId)!.has(event.eventId)
        );
        return usersWhoCanTakeThisEvent.length === 0;
      });
      if (maxCoverageAchieved) break;
      
      // Find event with fewest current buyers
      let eventWithFewestBuyers: EventSummary | null = null;
      let minBuyerCount = Infinity;
      
      for (const event of unprocessedEventsInTier) {
        const currentBuyers = eventBuyerCounts.get(event.eventId)!;
        if (currentBuyers < minBuyerCount) {
          minBuyerCount = currentBuyers;
          eventWithFewestBuyers = event;
        } else if (currentBuyers === minBuyerCount && eventWithFewestBuyers) {
          // Tie-breaker: event with most interested users
          if (event.interestedUsers.length > eventWithFewestBuyers.interestedUsers.length) {
            eventWithFewestBuyers = event;
          }
        }
      }
      
      if (!eventWithFewestBuyers) break;
      
      // Find user with fewest current events who can take more AND doesn't already have this event
      let userWithFewestEvents: string | null = null;
      let minEventCount = Infinity;
      
      for (const userId of usersWithCapacity) {
        // Skip users who already have this event assigned
        if (userEventAssignments.get(userId)!.has(eventWithFewestBuyers.eventId)) {
          continue;
        }
        
        const currentEvents = userTicketCounts.get(userId)!;
        if (currentEvents < minEventCount) {
          minEventCount = currentEvents;
          userWithFewestEvents = userId;
        }
      }
      
      if (!userWithFewestEvents) break;
      
      // Assign this user to buy this event
      userTicketCounts.set(userWithFewestEvents, userTicketCounts.get(userWithFewestEvents)! + 1);
      eventBuyerCounts.set(eventWithFewestBuyers.eventId, eventBuyerCounts.get(eventWithFewestBuyers.eventId)! + 1);
      
      // Track that this user is now assigned to this event (prevent duplicates)
      userEventAssignments.get(userWithFewestEvents)!.add(eventWithFewestBuyers.eventId);
      
      // Add this event to the user's assignment list
      const buyingFor = eventWithFewestBuyers.interestedUsers.map(u => u.userName);
      userAssignments.get(userWithFewestEvents)!.push({
        eventId: eventWithFewestBuyers.eventId,
        eventTitle: eventWithFewestBuyers.eventTitle,
        priority: eventWithFewestBuyers.priority,
        buyingFor,
        cost: eventWithFewestBuyers.cost
      });
    }
    
    // Mark all events in this tier as processed
    unprocessedEventsInTier.forEach(event => processedEvents.add(event.eventId));
  }
  
  // Convert to final format
  const assignments: TicketAssignment[] = allUserIds.map(userId => ({
    userId,
    userName: userMap.get(userId)!,
    events: userAssignments.get(userId)!,
    totalTickets: userTicketCounts.get(userId)!
  }));
  
  // Check for users over the event limit (should not happen with proper algorithm)
  for (const assignment of assignments) {
    if (assignment.totalTickets > EVENT_LIMIT) {
      errors.push(`${assignment.userName} assigned ${assignment.totalTickets} events (over limit of ${EVENT_LIMIT})`);
    }
  }
  
  // Check if we have unused capacity that could be utilized
  const totalEventsAssigned = assignments.reduce((sum, a) => sum + a.totalTickets, 0);
  const maxPossibleEvents = users.length * EVENT_LIMIT;
  const unusedCapacity = maxPossibleEvents - totalEventsAssigned;
  
  if (unusedCapacity > 0 && events.length > 0) {
    console.log(`Note: ${unusedCapacity} ticket slots remain unused. Consider increasing redundancy for important events.`);
  }
  
  return { assignments, errors };
}

// Helper function to get priority label
export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 3: return 'Critical';
    case 2: return 'Important';
    case 1: return 'Normal';
    default: return 'Unknown';
  }
}

// Helper function to get priority emoji
export function getPriorityEmoji(priority: number): string {
  switch (priority) {
    case 3: return '🔴';
    case 2: return '🟡';
    case 1: return '⚪';
    default: return '⚫';
  }
}
