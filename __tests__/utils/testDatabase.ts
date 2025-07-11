import { PrismaClient } from '@prisma/client';

export interface TestUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  createdAt?: Date;
}

export interface TestEvent {
  id: string;
  title: string;
  shortDescription?: string | null;
  eventType?: string | null;
  gameSystem?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  ageRequired?: string | null;
  experienceRequired?: string | null;
  materialsRequired?: string | null;
  cost?: string | null;
  location?: string | null;
  ticketsAvailable?: number | null;
  priority?: number;
  isCanceled?: boolean;
}

export interface TestDesiredEvent {
  id: string;
  userId: string;
  eventsListId: string;
}

export class TestDatabase {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async setup(): Promise<void> {
    // Clean up any existing test data
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    // Delete in correct order to respect foreign key constraints
    await this.prisma.refundedEvents.deleteMany({});
    await this.prisma.purchasedEvents.deleteMany({});
    await this.prisma.desiredEvents.deleteMany({});
    await this.prisma.eventsList.deleteMany({});
    await this.prisma.userList.deleteMany({});
    await this.prisma.calculationRun.deleteMany({});
  }

  async seedUsers(users: TestUser[]): Promise<void> {
    for (const user of users) {
      await this.prisma.userList.create({
        data: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isAdmin: user.isAdmin || false,
          emailNotifications: user.emailNotifications || false,
          pushNotifications: user.pushNotifications || false,
          createdAt: user.createdAt || new Date(),
        }
      });
    }
  }

  async seedEvents(events: TestEvent[]): Promise<void> {
    for (const event of events) {
      await this.prisma.eventsList.create({
        data: {
          id: event.id,
          title: event.title,
          shortDescription: event.shortDescription,
          eventType: event.eventType,
          gameSystem: event.gameSystem,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          ageRequired: event.ageRequired,
          experienceRequired: event.experienceRequired,
          materialsRequired: event.materialsRequired,
          cost: event.cost,
          location: event.location,
          ticketsAvailable: event.ticketsAvailable,
          priority: event.priority || 1,
          isCanceled: event.isCanceled || false,
        }
      });
    }
  }

  async seedDesiredEvents(desiredEvents: TestDesiredEvent[]): Promise<void> {
    for (const desiredEvent of desiredEvents) {
      await this.prisma.desiredEvents.create({
        data: {
          id: desiredEvent.id,
          userId: desiredEvent.userId,
          eventsListId: desiredEvent.eventsListId,
        }
      });
    }
  }

  async getUsers(): Promise<any[]> {
    return await this.prisma.userList.findMany({
      include: {
        desiredEvents: {
          include: {
            eventsList: true
          }
        }
      }
    });
  }

  async getEvents(): Promise<any[]> {
    return await this.prisma.eventsList.findMany({
      include: {
        desiredEvents: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async getUserDesiredEvents(userId: string): Promise<any[]> {
    return await this.prisma.desiredEvents.findMany({
      where: { userId },
      include: {
        eventsList: true
      }
    });
  }

  async getEventDesiredBy(eventId: string): Promise<any[]> {
    return await this.prisma.desiredEvents.findMany({
      where: { eventsListId: eventId },
      include: {
        user: true
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Helper methods for specific test scenarios
  async createTestScenario(name: string): Promise<{
    users: any[],
    events: any[],
    desiredEvents: any[]
  }> {
    switch (name) {
      case 'simple':
        return this.createSimpleScenario();
      case 'conflicts':
        return this.createConflictScenario();
      case 'capacity':
        return this.createCapacityScenario();
      default:
        throw new Error(`Unknown test scenario: ${name}`);
    }
  }

  private async createSimpleScenario(): Promise<{
    users: any[],
    events: any[],
    desiredEvents: any[]
  }> {
    // Create 3 users
    const users = [
      { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com' },
      { id: 'user-2', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com' },
      { id: 'user-3', firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@example.com' }
    ];

    // Create 3 non-overlapping events
    const events = [
      {
        id: 'event-1',
        title: 'D&D Adventure',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        cost: '4',
        ticketsAvailable: 6,
        location: 'Room A'
      },
      {
        id: 'event-2',
        title: 'Board Game Tournament',
        startDateTime: '2024-08-01T16:00:00Z',
        endDateTime: '2024-08-01T20:00:00Z',
        cost: '8',
        ticketsAvailable: 4,
        location: 'Room B'
      },
      {
        id: 'event-3',
        title: 'Painting Workshop',
        startDateTime: '2024-08-02T10:00:00Z',
        endDateTime: '2024-08-02T12:00:00Z',
        cost: '12',
        ticketsAvailable: 8,
        location: 'Room C'
      }
    ];

    // Create some desired events
    const desiredEvents = [
      { id: 'de-1', userId: 'user-1', eventsListId: 'event-1' },
      { id: 'de-2', userId: 'user-2', eventsListId: 'event-1' },
      { id: 'de-3', userId: 'user-2', eventsListId: 'event-2' }
    ];

    await this.seedUsers(users);
    await this.seedEvents(events);
    await this.seedDesiredEvents(desiredEvents);

    return { users, events, desiredEvents };
  }

  private async createConflictScenario(): Promise<{
    users: any[],
    events: any[],
    desiredEvents: any[]
  }> {
    // Create 2 users
    const users = [
      { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com' },
      { id: 'user-2', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com' }
    ];

    // Create overlapping events for conflict testing
    const events = [
      {
        id: 'event-1',
        title: 'Morning Workshop',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        cost: '4',
        ticketsAvailable: 6,
        location: 'Room A'
      },
      {
        id: 'event-2',
        title: 'Overlapping Event',
        startDateTime: '2024-08-01T12:00:00Z', // Overlaps with event-1
        endDateTime: '2024-08-01T16:00:00Z',
        cost: '4',
        ticketsAvailable: 6,
        location: 'Room B'
      },
      {
        id: 'event-3',
        title: 'Partial Overlap',
        startDateTime: '2024-08-01T13:00:00Z', // Also overlaps with event-1
        endDateTime: '2024-08-01T15:00:00Z',
        cost: '6',
        ticketsAvailable: 4,
        location: 'Room C'
      },
      {
        id: 'event-4',
        title: 'Non-Overlapping',
        startDateTime: '2024-08-01T17:00:00Z', // No overlap
        endDateTime: '2024-08-01T19:00:00Z',
        cost: '8',
        ticketsAvailable: 5,
        location: 'Room D'
      }
    ];

    // User-1 already has event-1, we'll test adding conflicting events
    const desiredEvents = [
      { id: 'de-1', userId: 'user-1', eventsListId: 'event-1' }
    ];

    await this.seedUsers(users);
    await this.seedEvents(events);
    await this.seedDesiredEvents(desiredEvents);

    return { users, events, desiredEvents };
  }

  private async createCapacityScenario(): Promise<{
    users: any[],
    events: any[],
    desiredEvents: any[]
  }> {
    // Create 5 users
    const users = [
      { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com' },
      { id: 'user-2', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com' },
      { id: 'user-3', firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@example.com' },
      { id: 'user-4', firstName: 'Diana', lastName: 'White', email: 'diana.white@example.com' },
      { id: 'user-5', firstName: 'Eve', lastName: 'Black', email: 'eve.black@example.com' }
    ];

    // Create events with limited capacity
    const events = [
      {
        id: 'event-1',
        title: 'Limited Capacity Event',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        cost: '4',
        ticketsAvailable: 2, // Only 2 spots available
        location: 'Small Room'
      },
      {
        id: 'event-2',
        title: 'Full Capacity Event',
        startDateTime: '2024-08-01T16:00:00Z',
        endDateTime: '2024-08-01T20:00:00Z',
        cost: '8',
        ticketsAvailable: 3, // 3 spots, will be filled
        location: 'Medium Room'
      }
    ];

    // Fill event-2 to capacity (3 users)
    const desiredEvents = [
      { id: 'de-1', userId: 'user-1', eventsListId: 'event-2' },
      { id: 'de-2', userId: 'user-2', eventsListId: 'event-2' },
      { id: 'de-3', userId: 'user-3', eventsListId: 'event-2' }
    ];

    await this.seedUsers(users);
    await this.seedEvents(events);
    await this.seedDesiredEvents(desiredEvents);

    return { users, events, desiredEvents };
  }

  // Utility methods for testing
  async getUserEventCount(userId: string): Promise<number> {
    return await this.prisma.desiredEvents.count({
      where: { userId }
    });
  }

  async getEventUserCount(eventId: string): Promise<number> {
    return await this.prisma.desiredEvents.count({
      where: { eventsListId: eventId }
    });
  }

  async userHasEvent(userId: string, eventId: string): Promise<boolean> {
    const desiredEvent = await this.prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId,
          eventsListId: eventId
        }
      }
    });
    return !!desiredEvent;
  }
}

export const testDatabase = new TestDatabase();
