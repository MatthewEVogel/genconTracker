import { DesiredEventsService } from '@/lib/services/server/desiredEventsService';
import { testDatabase } from './utils/testDatabase';

describe('DesiredEventsService', () => {
  beforeEach(async () => {
    await testDatabase.setup();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  describe('getUserDesiredEvents', () => {
    it('should return user desired events excluding canceled by default', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await DesiredEventsService.getUserDesiredEvents('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].eventsListId).toBe('event-1');
      expect(result[0].eventsList?.title).toBe('D&D Adventure');
    });

    it('should include canceled events when requested', async () => {
      // Create scenario with canceled event
      const users = [
        { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'Regular Event',
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
          ticketsAvailable: 6,
          isCanceled: true
        }
      ];
      const desiredEvents = [
        { id: 'de-1', userId: 'user-1', eventsListId: 'event-1' },
        { id: 'de-2', userId: 'user-1', eventsListId: 'event-2' }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);
      await testDatabase.seedDesiredEvents(desiredEvents);

      // Without including canceled
      const resultExcluded = await DesiredEventsService.getUserDesiredEvents('user-1', false);
      expect(resultExcluded).toHaveLength(1);
      expect(resultExcluded[0].eventsListId).toBe('event-1');

      // Including canceled
      const resultIncluded = await DesiredEventsService.getUserDesiredEvents('user-1', true);
      expect(resultIncluded).toHaveLength(2);
      const eventIds = resultIncluded.map(e => e.eventsListId).sort();
      expect(eventIds).toEqual(['event-1', 'event-2']);
    });

    it('should return empty array for user with no desired events', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await DesiredEventsService.getUserDesiredEvents('user-3');

      expect(result).toHaveLength(0);
    });
  });

  describe('getUserCanceledEvents', () => {
    it('should return only canceled events for user', async () => {
      const users = [
        { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'Regular Event',
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
          ticketsAvailable: 6,
          isCanceled: true
        }
      ];
      const desiredEvents = [
        { id: 'de-1', userId: 'user-1', eventsListId: 'event-1' },
        { id: 'de-2', userId: 'user-1', eventsListId: 'event-2' }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);
      await testDatabase.seedDesiredEvents(desiredEvents);

      const result = await DesiredEventsService.getUserCanceledEvents('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-2');
      expect(result[0].title).toBe('Canceled Event');
      expect(result[0].isCanceled).toBe(true);
    });
  });

  describe('addDesiredEvent', () => {
    it('should add desired event successfully with no conflicts', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await DesiredEventsService.addDesiredEvent('user-3', 'event-1');

      expect(result.desiredEvent).toBeDefined();
      expect(result.conflicts).toHaveLength(0);
      expect(result.capacityWarning).toBe(false);

      // Verify event was added
      const userHasEvent = await testDatabase.userHasEvent('user-3', 'event-1');
      expect(userHasEvent).toBe(true);
    });

    it('should detect time conflicts when adding overlapping events', async () => {
      await testDatabase.createTestScenario('conflicts');

      // User-1 already has event-1, try to add overlapping event-2
      const result = await DesiredEventsService.addDesiredEvent('user-1', 'event-2');

      expect(result.desiredEvent).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].eventsListId).toBe('event-1');
    });

    it('should warn about capacity when event is full', async () => {
      await testDatabase.createTestScenario('capacity');

      // event-2 is at capacity (3/3), add user-4
      const result = await DesiredEventsService.addDesiredEvent('user-4', 'event-2');

      expect(result.desiredEvent).toBeDefined();
      expect(result.capacityWarning).toBe(true);
    });

    it('should prevent adding duplicate events', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        DesiredEventsService.addDesiredEvent('user-1', 'event-1')
      ).rejects.toThrow('Event already in schedule');
    });

    it('should fail when event does not exist', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        DesiredEventsService.addDesiredEvent('user-1', 'non-existent-event')
      ).rejects.toThrow('Event not found');
    });
  });

  describe('removeDesiredEvent', () => {
    it('should remove desired event successfully', async () => {
      await testDatabase.createTestScenario('simple');

      // Verify user has the event initially
      let userHasEvent = await testDatabase.userHasEvent('user-1', 'event-1');
      expect(userHasEvent).toBe(true);

      await DesiredEventsService.removeDesiredEvent('user-1', 'event-1');

      // Verify event was removed
      userHasEvent = await testDatabase.userHasEvent('user-1', 'event-1');
      expect(userHasEvent).toBe(false);
    });

    it('should fail when trying to remove non-existent desired event', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        DesiredEventsService.removeDesiredEvent('user-3', 'event-1')
      ).rejects.toThrow('Event not found in schedule');
    });
  });

  describe('userHasDesiredEvent', () => {
    it('should return true when user has desired event', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await DesiredEventsService.userHasDesiredEvent('user-1', 'event-1');

      expect(result).toBe(true);
    });

    it('should return false when user does not have desired event', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await DesiredEventsService.userHasDesiredEvent('user-3', 'event-1');

      expect(result).toBe(false);
    });
  });

  describe('getEventDesiredCount', () => {
    it('should return correct count of users who desire an event', async () => {
      await testDatabase.createTestScenario('simple');

      // event-1 is desired by user-1 and user-2
      const count = await DesiredEventsService.getEventDesiredCount('event-1');

      expect(count).toBe(2);
    });

    it('should return 0 for event with no interested users', async () => {
      await testDatabase.createTestScenario('simple');

      const count = await DesiredEventsService.getEventDesiredCount('event-3');

      expect(count).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with null capacity (unlimited)', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-unlimited',
          title: 'Unlimited Event',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T12:00:00Z',
          ticketsAvailable: null
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await DesiredEventsService.addDesiredEvent('user-1', 'event-unlimited');

      expect(result.desiredEvent).toBeDefined();
      expect(result.capacityWarning).toBe(false);
    });

    it('should handle events with null start/end times', async () => {
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];
      const events = [
        {
          id: 'event-1',
          title: 'Event Without Times',
          startDateTime: null,
          endDateTime: null,
          ticketsAvailable: 10
        },
        {
          id: 'event-2',
          title: 'Another Event Without Times',
          startDateTime: null,
          endDateTime: null,
          ticketsAvailable: 10
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      // Add first event
      await DesiredEventsService.addDesiredEvent('user-1', 'event-1');

      // Add second event (should not conflict since no times)
      const result = await DesiredEventsService.addDesiredEvent('user-1', 'event-2');

      expect(result.desiredEvent).toBeDefined();
      expect(result.conflicts).toHaveLength(0);
    });
  });
});
