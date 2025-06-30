import { PrismaClient } from '@prisma/client';
import { TestUser, TestEvent, TestUserEvent } from './testDataGenerator';

export class TestDatabase {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:./test.db'
        }
      }
    });
  }

  async setup(): Promise<void> {
    // Clean up any existing test data
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    // Delete in correct order to respect foreign key constraints
    await this.prisma.ticketAssignment.deleteMany({});
    await this.prisma.calculationRun.deleteMany({});
    await this.prisma.userEvent.deleteMany({});
    await this.prisma.event.deleteMany({});
    await this.prisma.user.deleteMany({});
  }

  async seedUsers(users: TestUser[]): Promise<void> {
    for (const user of users) {
      await this.prisma.user.create({
        data: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          createdAt: user.createdAt,
        }
      });
    }
  }

  async seedEvents(events: TestEvent[]): Promise<void> {
    for (const event of events) {
      await this.prisma.event.create({
        data: {
          id: event.id,
          title: event.title,
          shortDescription: event.shortDescription,
          eventType: event.eventType,
          gameSystem: event.gameSystem,
          startDateTime: event.startDateTime,
          duration: event.duration,
          endDateTime: event.endDateTime,
          ageRequired: event.ageRequired,
          experienceRequired: event.experienceRequired,
          materialsRequired: event.materialsRequired,
          cost: event.cost,
          location: event.location,
          ticketsAvailable: event.ticketsAvailable,
          createdAt: event.createdAt,
        }
      });
    }
  }

  async seedUserEvents(userEvents: TestUserEvent[]): Promise<void> {
    for (const userEvent of userEvents) {
      await this.prisma.userEvent.create({
        data: {
          id: userEvent.id,
          userId: userEvent.userId,
          eventId: userEvent.eventId,
          priority: userEvent.priority,
          createdAt: userEvent.createdAt,
          updatedAt: userEvent.updatedAt,
        }
      });
    }
  }

  async getUsers(): Promise<any[]> {
    return await this.prisma.user.findMany({
      include: {
        userEvents: {
          include: {
            event: true
          }
        }
      }
    });
  }

  async getEvents(): Promise<any[]> {
    return await this.prisma.event.findMany({
      include: {
        userEvents: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async getUserEvents(userId: string): Promise<any[]> {
    return await this.prisma.userEvent.findMany({
      where: { userId },
      include: {
        event: true
      }
    });
  }

  async getTicketAssignments(): Promise<any[]> {
    return await this.prisma.ticketAssignment.findMany({
      include: {
        user: true,
        event: true,
        calculation: true
      }
    });
  }

  async getLatestCalculationRun(): Promise<any> {
    return await this.prisma.calculationRun.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          include: {
            user: true,
            event: true
          }
        }
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
    userEvents: any[]
  }> {
    switch (name) {
      case 'simple':
        return this.createSimpleScenario();
      case 'conflicts':
        return this.createConflictScenario();
      case 'large-scale':
        return this.createLargeScaleScenario();
      default:
        throw new Error(`Unknown test scenario: ${name}`);
    }
  }

  private async createSimpleScenario(): Promise<{
    users: any[],
    events: any[],
    userEvents: any[]
  }> {
    // Create 3 users
    const users = [
      { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com', createdAt: new Date() },
      { id: 'user-2', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com', createdAt: new Date() },
      { id: 'user-3', firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@example.com', createdAt: new Date() }
    ];

    // Create 2 events
    const events = [
      {
        id: 'event-1',
        title: 'D&D Adventure',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        duration: '4 hours',
        cost: '4',
        ticketsAvailable: 6,
        createdAt: new Date()
      },
      {
        id: 'event-2',
        title: 'Board Game Tournament',
        startDateTime: '2024-08-01T16:00:00Z',
        endDateTime: '2024-08-01T20:00:00Z',
        duration: '4 hours',
        cost: '8',
        ticketsAvailable: 4,
        createdAt: new Date()
      }
    ];

    // Create user events
    const userEvents = [
      { id: 'ue-1', userId: 'user-1', eventId: 'event-1', priority: 3, createdAt: new Date(), updatedAt: new Date() },
      { id: 'ue-2', userId: 'user-2', eventId: 'event-1', priority: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 'ue-3', userId: 'user-2', eventId: 'event-2', priority: 1, createdAt: new Date(), updatedAt: new Date() }
    ];

    await this.seedUsers(users);
    await this.seedEvents(events);
    await this.seedUserEvents(userEvents);

    return { users, events, userEvents };
  }

  private async createConflictScenario(): Promise<{
    users: any[],
    events: any[],
    userEvents: any[]
  }> {
    // Create 2 users
    const users = [
      { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com', createdAt: new Date() },
      { id: 'user-2', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com', createdAt: new Date() }
    ];

    // Create 2 overlapping events
    const events = [
      {
        id: 'event-1',
        title: 'Conflicting Event A',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        duration: '4 hours',
        cost: '4',
        ticketsAvailable: 6,
        createdAt: new Date()
      },
      {
        id: 'event-2',
        title: 'Conflicting Event B',
        startDateTime: '2024-08-01T12:00:00Z', // Overlaps with Event A
        endDateTime: '2024-08-01T16:00:00Z',
        duration: '4 hours',
        cost: '4',
        ticketsAvailable: 6,
        createdAt: new Date()
      }
    ];

    await this.seedUsers(users);
    await this.seedEvents(events);

    return { users, events, userEvents: [] };
  }

  private async createLargeScaleScenario(): Promise<{
    users: any[],
    events: any[],
    userEvents: any[]
  }> {
    // This will be implemented for large-scale testing
    // For now, return empty scenario
    return { users: [], events: [], userEvents: [] };
  }
}

export const testDatabase = new TestDatabase();
