export interface UserEventResponse {
  userEvents: Array<{
    event: {
      id: string;
      title: string;
      startDateTime: string;
      endDateTime: string;
      eventType?: string;
      location?: string;
      cost?: string;
      ticketsAvailable?: number;
    };
  }>;
}

export interface AddEventResponse {
  message: string;
  conflicts?: Array<{
    id: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
  }>;
  capacityWarning?: boolean;
}

export class UserEventService {
  static async getUserEvents(userId: string): Promise<UserEventResponse> {
    const response = await fetch(`/api/user-events?userId=${userId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user events');
    }
    
    return data;
  }

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

  static async removeUserEvent(userId: string, eventId: string): Promise<{ message: string }> {
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
}