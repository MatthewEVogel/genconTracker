import { ScheduleService } from '@/lib/services/server/scheduleService';
import { testDatabase } from './utils/testDatabase';

describe('ScheduleService', () => {
  beforeEach(async () => {
    await testDatabase.setup();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  describe('Basic Event Management', () => {
    it('should add an event to a user schedule successfully', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      // Test adding a new event
      const result = await ScheduleService.addUserEvent('user-3', 'event-1');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeUndefined();
      expect(result.capacityWarning).toBe(false);

      // Verify the event was added
      const userHasEvent = await testDatabase.userHasEvent('user-3', 'event-1');
      expect(userHasEvent).toBe(true);

      // Verify user event count increased
      const eventCount = await testDatabase.getUserEventCount('user-3');
      expect(eventCount).toBe(1);
    });

    it('should prevent adding duplicate events', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      // Try to add an event the user already has
      await expect(
        ScheduleService.addUserEvent('user-1', 'event-1')
      ).rejects.toThrow('Event already in schedule');

      // Verify the event count didn't change
      const eventCount = await testDatabase.getUserEventCount('user-1');
      expect(eventCount).toBe(1);
    });

    it('should remove an event from a user schedule successfully', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      // Verify user has the event initially
      let userHasEvent = await testDatabase.userHasEvent('user-1', 'event-1');
      expect(userHasEvent).toBe(true);

      // Remove the event
      const result = await ScheduleService.removeUserEvent('user-1', 'event-1');

      expect(result.message).toBe('Event removed from schedule');

      // Verify the event was removed
      userHasEvent = await testDatabase.userHasEvent('user-1', 'event-1');
      expect(userHasEvent).toBe(false);

      // Verify user event count decreased
      const eventCount = await testDatabase.getUserEventCount('user-1');
      expect(eventCount).toBe(0);
    });

    it('should fail to remove an event that user does not have', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      // Try to remove an event the user doesn't have
      await expect(
        ScheduleService.removeUserEvent('user-3', 'event-1')
      ).rejects.toThrow('Event not found in schedule');
    });

    it('should fail to add non-existent event', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      // Try to add an event that doesn't exist
      await expect(
        ScheduleService.addUserEvent('user-1', 'non-existent-event')
      ).rejects.toThrow('Event not found');
    });
  });

  describe('Time Conflict Detection', () => {
    it('should detect conflicts when adding overlapping events', async () => {
      // Setup conflict scenario
      await testDatabase.createTestScenario('conflicts');

      // Try to add event-2 which overlaps with event-1 (user-1 already has event-1)
      const result = await ScheduleService.addUserEvent('user-1', 'event-2');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0]).toEqual({
        id: 'event-1',
        title: 'Morning Workshop',
        startDateTime: '2024-08-01T10:00:00Z',
        endDateTime: '2024-08-01T14:00:00Z'
      });

      // Verify the event was still added despite conflicts
      const userHasEvent = await testDatabase.userHasEvent('user-1', 'event-2');
      expect(userHasEvent).toBe(true);
    });

    it('should detect multiple conflicts', async () => {
      // Setup conflict scenario
      await testDatabase.createTestScenario('conflicts');

      // Add event-2 first (overlaps with event-1)
      await ScheduleService.addUserEvent('user-1', 'event-2');

      // Now add event-3 which overlaps with both event-1 and event-2
      const result = await ScheduleService.addUserEvent('user-1', 'event-3');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toHaveLength(2);

      // Should detect conflicts with both existing events
      const conflictIds = result.conflicts!.map(c => c.id).sort();
      expect(conflictIds).toEqual(['event-1', 'event-2']);
    });

    it('should not detect conflicts for non-overlapping events', async () => {
      // Setup conflict scenario
      await testDatabase.createTestScenario('conflicts');

      // Add event-4 which doesn't overlap with event-1
      const result = await ScheduleService.addUserEvent('user-1', 'event-4');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeUndefined();
      expect(result.capacityWarning).toBe(false);
    });

    it('should detect exact time boundary overlaps', async () => {
      // Create custom events with exact boundary conditions
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];

      const events = [
        {
          id: 'event-1',
          title: 'First Event',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T12:00:00Z',
          ticketsAvailable: 10
        },
        {
          id: 'event-2',
          title: 'Adjacent Event',
          startDateTime: '2024-08-01T12:00:00Z', // Starts exactly when event-1 ends
          endDateTime: '2024-08-01T14:00:00Z',
          ticketsAvailable: 10
        },
        {
          id: 'event-3',
          title: 'Overlapping Event',
          startDateTime: '2024-08-01T11:59:59Z', // Overlaps by 1 second
          endDateTime: '2024-08-01T13:00:00Z',
          ticketsAvailable: 10
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      // Add first event
      await ScheduleService.addUserEvent('user-1', 'event-1');

      // Add adjacent event (should not conflict)
      const adjacentResult = await ScheduleService.addUserEvent('user-1', 'event-2');
      expect(adjacentResult.conflicts).toBeUndefined();

      // Add overlapping event (should conflict with both events)
      const overlappingResult = await ScheduleService.addUserEvent('user-1', 'event-3');
      expect(overlappingResult.conflicts).toBeDefined();
      expect(overlappingResult.conflicts).toHaveLength(2);
      
      const conflictIds = overlappingResult.conflicts!.map(c => c.id).sort();
      expect(conflictIds).toEqual(['event-1', 'event-2']);
    });
  });

  describe('Capacity Limit Detection', () => {
    it('should warn when adding to a full capacity event', async () => {
      // Setup capacity scenario
      await testDatabase.createTestScenario('capacity');

      // event-2 is already at capacity (3/3), try to add user-4
      const result = await ScheduleService.addUserEvent('user-4', 'event-2');

      expect(result.message).toBe('Event added to schedule');
      expect(result.capacityWarning).toBe(true);

      // Verify the event was still added
      const userHasEvent = await testDatabase.userHasEvent('user-4', 'event-2');
      expect(userHasEvent).toBe(true);

      // Verify the event now has more users than capacity
      const userCount = await testDatabase.getEventUserCount('event-2');
      expect(userCount).toBe(4); // Over capacity
    });

    it('should not warn when adding to event with available capacity', async () => {
      // Setup capacity scenario
      await testDatabase.createTestScenario('capacity');

      // event-1 has capacity for 2, currently 0 users
      const result = await ScheduleService.addUserEvent('user-4', 'event-1');

      expect(result.message).toBe('Event added to schedule');
      expect(result.capacityWarning).toBe(false);

      // Verify the event was added
      const userHasEvent = await testDatabase.userHasEvent('user-4', 'event-1');
      expect(userHasEvent).toBe(true);
    });

    it('should warn when reaching exactly capacity limit', async () => {
      // Setup capacity scenario
      await testDatabase.createTestScenario('capacity');

      // Add first user to event-1 (capacity 2)
      await ScheduleService.addUserEvent('user-4', 'event-1');

      // Add second user to reach capacity
      const result = await ScheduleService.addUserEvent('user-5', 'event-1');

      expect(result.message).toBe('Event added to schedule');
      expect(result.capacityWarning).toBe(false); // At capacity, but not over

      // Verify both users were added
      const userCount = await testDatabase.getEventUserCount('event-1');
      expect(userCount).toBe(2); // Exactly at capacity
    });

    it('should handle events with null capacity (unlimited)', async () => {
      // Create event with unlimited capacity
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];

      const events = [
        {
          id: 'event-unlimited',
          title: 'Unlimited Event',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T12:00:00Z',
          ticketsAvailable: null // Unlimited capacity
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      const result = await ScheduleService.addUserEvent('user-1', 'event-unlimited');

      expect(result.message).toBe('Event added to schedule');
      expect(result.capacityWarning).toBe(false);
    });
  });

  describe('Combined Scenarios', () => {
    it('should detect both conflicts and capacity warnings', async () => {
      // Create a scenario with both time conflicts and capacity issues
      const users = [
        { id: 'user-1', firstName: 'User', lastName: 'One', email: 'user1@example.com' },
        { id: 'user-2', firstName: 'User', lastName: 'Two', email: 'user2@example.com' }
      ];

      const events = [
        {
          id: 'event-1',
          title: 'First Event',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T12:00:00Z',
          ticketsAvailable: 10
        },
        {
          id: 'event-2',
          title: 'Conflicting Full Event',
          startDateTime: '2024-08-01T11:00:00Z', // Overlaps with event-1
          endDateTime: '2024-08-01T13:00:00Z',
          ticketsAvailable: 1 // Limited capacity
        }
      ];

      const desiredEvents = [
        { id: 'de-1', userId: 'user-1', eventsListId: 'event-1' },
        { id: 'de-2', userId: 'user-2', eventsListId: 'event-2' } // Fills event-2 to capacity
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);
      await testDatabase.seedDesiredEvents(desiredEvents);

      // User-1 tries to add event-2 (conflicts with event-1 and over capacity)
      const result = await ScheduleService.addUserEvent('user-1', 'event-2');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].id).toBe('event-1');
      expect(result.capacityWarning).toBe(true);
    });
  });

  describe('Schedule Data Retrieval', () => {
    it('should get schedule data for all users', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      const result = await ScheduleService.getScheduleData();

      expect(result.scheduleData).toBeDefined();
      expect(result.scheduleData).toHaveLength(3); // 3 users

      // Check user structure
      const alice = result.scheduleData.find(u => u.name === 'Alice Smith');
      expect(alice).toBeDefined();
      expect(alice!.events).toHaveLength(1);
      expect(alice!.events[0].title).toBe('D&D Adventure');

      const bob = result.scheduleData.find(u => u.name === 'Bob Johnson');
      expect(bob).toBeDefined();
      expect(bob!.events).toHaveLength(2); // Has both event-1 and event-2
    });

    it('should get user events for specific user', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      const result = await ScheduleService.getUserEvents('user-2');

      expect(result.userEvents).toBeDefined();
      expect(result.userEvents).toHaveLength(2);

      const eventTitles = result.userEvents.map(ue => ue.event.title).sort();
      expect(eventTitles).toEqual(['Board Game Tournament', 'D&D Adventure']);
    });

    it('should return empty array for user with no events', async () => {
      // Setup test data
      await testDatabase.createTestScenario('simple');

      const result = await ScheduleService.getUserEvents('user-3');

      expect(result.userEvents).toBeDefined();
      expect(result.userEvents).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events without start/end times', async () => {
      // Create events without time information
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
      await ScheduleService.addUserEvent('user-1', 'event-1');

      // Add second event (should not conflict since no times)
      const result = await ScheduleService.addUserEvent('user-1', 'event-2');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeUndefined();
      expect(result.capacityWarning).toBe(false);
    });

    it('should handle invalid date strings gracefully', async () => {
      // Create events with invalid date strings
      const users = [
        { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      ];

      const events = [
        {
          id: 'event-1',
          title: 'Event With Valid Time',
          startDateTime: '2024-08-01T10:00:00Z',
          endDateTime: '2024-08-01T12:00:00Z',
          ticketsAvailable: 10
        },
        {
          id: 'event-2',
          title: 'Event With Invalid Time',
          startDateTime: 'invalid-date',
          endDateTime: 'also-invalid',
          ticketsAvailable: 10
        }
      ];

      await testDatabase.seedUsers(users);
      await testDatabase.seedEvents(events);

      // Add first event
      await ScheduleService.addUserEvent('user-1', 'event-1');

      // Add event with invalid dates (should not cause conflicts due to invalid parsing)
      const result = await ScheduleService.addUserEvent('user-1', 'event-2');

      expect(result.message).toBe('Event added to schedule');
      expect(result.conflicts).toBeUndefined();
      expect(result.capacityWarning).toBe(false);
    });
  });
});