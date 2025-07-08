import { prisma } from '@/lib/prisma';

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
}