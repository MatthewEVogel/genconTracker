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

export interface TransferEventResponse {
  message: string;
  fromUser: {
    id: string;
    name: string;
  };
  toUser: {
    id: string;
    name: string;
  };
  conflicts?: Array<{
    id: string;
    title: string;
    startDateTime: string | null;
    endDateTime: string | null;
  }>;
  warning?: string;
  eventType?: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  genConName: string;
  isAdmin: boolean;
}

export interface UserListResponse {
  users: User[];
}

export class ScheduleService {
  // Get schedule data for all users
  static async getScheduleData(): Promise<ScheduleResponse> {
    const response = await fetch('/api/schedule');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch schedule data');
    }
    
    return data;
  }

  // Get events for a specific user
  static async getUserEvents(userId: string): Promise<UserEventResponse> {
    const response = await fetch(`/api/user-events?userId=${userId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user events');
    }
    
    return data;
  }

  // Add an event to a user's schedule
  static async addUserEvent(userId: string, eventId: string): Promise<AddEventResponse> {
    const response = await fetch('/api/user-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, eventId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add event');
    }
    
    return data;
  }

  // Remove an event from a user's schedule
  static async removeUserEvent(userId: string, eventId: string): Promise<RemoveEventResponse> {
    const response = await fetch('/api/user-events', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, eventId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove event');
    }
    
    return data;
  }

  // Get user's schedule for a specific day
  static async getUserScheduleByDay(userId: string, day: string): Promise<ScheduleEvent[]> {
    const userEventsResponse = await this.getUserEvents(userId);
    
    if (day === 'All Days') {
      return userEventsResponse.userEvents.map(ue => ue.event);
    }

    return userEventsResponse.userEvents
      .map(ue => ue.event)
      .filter(event => {
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

  // Check if user has a specific event
  static async userHasEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const userEventsResponse = await this.getUserEvents(userId);
      return userEventsResponse.userEvents.some(ue => ue.event.id === eventId);
    } catch {
      return false;
    }
  }

  // Get conflicting events for a user
  static async getUserConflicts(userId: string): Promise<Array<{event: ScheduleEvent, conflicts: ScheduleEvent[]}>> {
    const userEventsResponse = await this.getUserEvents(userId);
    const events = userEventsResponse.userEvents.map(ue => ue.event);
    const conflicts: Array<{event: ScheduleEvent, conflicts: ScheduleEvent[]}> = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventConflicts: ScheduleEvent[] = [];

      if (event.startDateTime && event.endDateTime) {
        const eventStart = new Date(event.startDateTime);
        const eventEnd = new Date(event.endDateTime);

        for (let j = 0; j < events.length; j++) {
          if (i === j) continue;
          
          const otherEvent = events[j];
          if (otherEvent.startDateTime && otherEvent.endDateTime) {
            const otherStart = new Date(otherEvent.startDateTime);
            const otherEnd = new Date(otherEvent.endDateTime);

            // Check for overlap
            if (eventStart < otherEnd && eventEnd > otherStart) {
              eventConflicts.push(otherEvent);
            }
          }
        }
      }

      if (eventConflicts.length > 0) {
        conflicts.push({ event, conflicts: eventConflicts });
      }
    }

    return conflicts;
  }

  // Transfer an event from one user to another
  static async transferEvent(eventId: string, fromUserId: string, toUserId: string): Promise<TransferEventResponse> {
    const response = await fetch('/api/user-events/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId, fromUserId, toUserId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to transfer event');
    }
    
    return data;
  }

  // Get list of all users
  static async getAllUsers(): Promise<UserListResponse> {
    const response = await fetch('/api/user-list');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch users');
    }
    
    return data;
  }
}
