export interface ScheduleEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  eventType?: string;
  location?: string;
  cost?: string;
  ticketsAvailable?: number;
}

export interface ScheduleUser {
  id: string;
  name: string;
  events: ScheduleEvent[];
}

export interface ScheduleResponse {
  scheduleData: ScheduleUser[];
}

export class ScheduleService {
  static async getScheduleData(): Promise<ScheduleResponse> {
    const response = await fetch('/api/schedule');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch schedule data');
    }
    
    return data;
  }
}