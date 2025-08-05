export interface PersonalEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  createdBy: string;
  attendees: string[];
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    genConName: string;
  };
}

export interface CreatePersonalEventData {
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  createdBy: string;
  attendees?: string[];
}

export interface UpdatePersonalEventData {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
}

export interface ConflictInfo {
  userId: string;
  userName: string;
  personalEventConflicts: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
  genconConflicts: Array<{
    id: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
  }>;
}

export interface CreatePersonalEventResponse {
  personalEvent: PersonalEvent;
  conflicts?: ConflictInfo[];
}

export const personalEventService = {
  async getPersonalEvents(userId: string): Promise<PersonalEvent[]> {
    const response = await fetch(`/api/personal-events?userId=${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch personal events');
    }
    const data = await response.json();
    return data.personalEvents;
  },

  async createPersonalEvent(eventData: CreatePersonalEventData): Promise<CreatePersonalEventResponse> {
    const response = await fetch('/api/personal-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create personal event');
    }

    return response.json();
  },

  async updatePersonalEvent(eventData: UpdatePersonalEventData): Promise<PersonalEvent> {
    const response = await fetch('/api/personal-events', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update personal event');
    }

    const data = await response.json();
    return data.personalEvent;
  },

  async deletePersonalEvent(id: string): Promise<void> {
    const response = await fetch('/api/personal-events', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete personal event');
    }
  },

  // Utility function to round time to nearest 15 minutes
  roundToNearest15Minutes(date: Date): Date {
    const minutes = date.getUTCMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const roundedDate = new Date(date.getTime());
    roundedDate.setUTCMinutes(roundedMinutes, 0, 0);
    return roundedDate;
  },

  // Utility function to create default end time (1 hour after start)
  getDefaultEndTime(startTime: Date): Date {
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour in milliseconds
    return endTime;
  }
};
