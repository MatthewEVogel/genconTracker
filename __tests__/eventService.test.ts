import { EventService } from '@/lib/services/server/eventService';
import { testDatabase } from './utils/testDatabase';

describe('EventService', () => {
  beforeEach(async () => {
    await testDatabase.setup();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  describe('getEvents', () => {
    it('should return all events when no filters applied', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await EventService.getEvents({});

      expect(result.events).toHaveLength(3);
      expect(result.pagination.totalEvents).toBe(3);
      expect(result.events[0].title).toBe('D&D Adventure');
    });

    it('should filter events by event type', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'D&D Session',
          eventType: 'RPG',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T14:00:00Z',
          ticketsAvailable: 6
        },
        {
          id: 'event-2',
          title: 'Board Game Night',
          eventType: 'Board Game',
          startDateTime: '2024-08-01T16:00:00Z',
          endDateTime: '2024-08-01T20:00:00Z',
          ticketsAvailable: 8
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await EventService.getEvents({ eventTypes: 'RPG' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('D&D Session');
      expect(result.events[0].eventType).toBe('RPG');
    });

    it('should search events by title', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'Dragon Quest Adventure',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T14:00:00Z',
          ticketsAvailable: 6
        },
        {
          id: 'event-2',
          title: 'Board Game Tournament',
          startDateTime: '2024-08-01T16:00:00Z',
          endDateTime: '2024-08-01T20:00:00Z',
          ticketsAvailable: 8
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await EventService.getEvents({ search: 'Dragon' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Dragon Quest Adventure');
    });

    it('should paginate results correctly', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = Array.from({ length: 15 }, (_, i) => ({
        id: `event-${i + 1}`,
        title: `Event ${i + 1}`,
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z',
        ticketsAvailable: 6
      }));

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      // Test first page
      const page1 = await EventService.getEvents({ page: 1, limit: 10 });
      expect(page1.events).toHaveLength(10);
      expect(page1.pagination.totalEvents).toBe(15);

      // Test second page
      const page2 = await EventService.getEvents({ page: 2, limit: 10 });
      expect(page2.events).toHaveLength(5);
      expect(page2.pagination.totalEvents).toBe(15);
    });

    it('should exclude canceled events by default', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'Active Event',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T14:00:00Z',
          ticketsAvailable: 6,
          isCanceled: false
        },
        {
          id: 'event-2',
          title: 'Canceled Event',
          startDateTime: '2024-08-01T16:00:00Z',
          endDateTime: '2024-08-01T20:00:00Z',
          ticketsAvailable: 8,
          isCanceled: true
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await EventService.getEvents({});

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Active Event');
      expect(result.events[0].isCanceled).toBe(false);
    });
  });

  describe('getFilterOptions', () => {
    it('should return available filter options', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'D&D Adventure',
          eventType: 'RPG',
          ageRequired: '13+',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T14:00:00Z',
          ticketsAvailable: 6
        },
        {
          id: 'event-2',
          title: 'Board Game Night',
          eventType: 'Board Game',
          ageRequired: '10+',
          startDateTime: '2024-08-01T16:00:00Z',
          endDateTime: '2024-08-01T20:00:00Z',
          ticketsAvailable: 8
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await EventService.getFilterOptions();

      expect(result.eventTypes).toContain('RPG');
      expect(result.eventTypes).toContain('Board Game');
      expect(result.ageRatings).toContain('13+');
      expect(result.ageRatings).toContain('10+');
    });

    it('should return empty arrays when no events exist', async () => {
      const result = await EventService.getFilterOptions();

      expect(result.eventTypes).toEqual([]);
      expect(result.ageRatings).toEqual([]);
    });
  });

  describe('getEventById', () => {
    it('should return event details for valid ID', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await EventService.getEventById('event-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('event-1');
      expect(result?.title).toBe('D&D Adventure');
      expect(result?.startDateTime).toBe('2024-08-01T10:00:00Z');
    });

    it('should return null for non-existent event ID', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await EventService.getEventById('non-existent-event');

      expect(result).toBeNull();
    });

    it('should return canceled event if specifically requested', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-canceled',
          title: 'Canceled Event',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T14:00:00Z',
          ticketsAvailable: 6,
          isCanceled: true
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await EventService.getEventById('event-canceled');

      expect(result).toBeDefined();
      expect(result?.id).toBe('event-canceled');
      expect(result?.title).toBe('Canceled Event');
      expect(result?.isCanceled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with null values gracefully', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-minimal',
          title: 'Minimal Event',
          startDateTime: null,
          endDateTime: null,
          eventType: null,
          gameSystem: null,
          ticketsAvailable: null
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await EventService.getEvents({});

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Minimal Event');
      expect(result.events[0].startDateTime).toBeNull();
    });

    it('should handle empty search terms', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await EventService.getEvents({ search: '' });

      expect(result.events).toHaveLength(3);
    });

    it('should handle invalid pagination parameters', async () => {
      await testDatabase.createTestScenario('simple');

      // Test negative page
      const result1 = await EventService.getEvents({ page: -1, limit: 10 });
      expect(result1.events).toHaveLength(3);

      // Test zero limit
      const result2 = await EventService.getEvents({ page: 1, limit: 0 });
      expect(result2.events).toHaveLength(3);
    });
  });
});
