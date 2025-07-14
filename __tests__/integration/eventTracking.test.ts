import { testDatabase } from '@/__tests__/utils/testDatabase';

describe('Event Tracking Integration Tests', () => {
  let prisma: any;
  let testUser: any;
  let testEvent: any;

  beforeAll(async () => {
    const setup = await testDatabase.setupDatabase('eventTracking');
    expect(setup).toBe(true);
    prisma = testDatabase.getPrisma();
  });

  afterAll(async () => {
    await testDatabase.cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean up before each test
    await testDatabase.cleanupTestData();

    // Create test user
    testUser = await testDatabase.createTestUser({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      genConName: 'John Doe',
      isAdmin: false,
      approved: true,
      emailNotifications: true,
      pushNotifications: false,
    });

    // Create test event
    testEvent = await testDatabase.createTestEvent({
      id: 'TEST001',
      title: 'Test Event',
      shortDescription: 'A test event for tracking',
      eventType: 'RPG',
      gameSystem: 'D&D',
      startDateTime: '2025-08-15T10:00:00Z',
      endDateTime: '2025-08-15T14:00:00Z',
      ageRequired: '18+',
      experienceRequired: 'None',
      materialsRequired: 'None',
      cost: '10',
      location: 'Room 101',
      ticketsAvailable: 6,
      priority: 1,
      isCanceled: false,
    });
  });

  describe('Event Tracking Workflow', () => {
    it('should allow user to track and untrack events', async () => {
      // Initially, user should have no tracked events
      const initialTrackedEvents = await prisma.userList.findUnique({
        where: { id: testUser.id },
        include: { trackedEvents: true },
      });
      expect(initialTrackedEvents.trackedEvents).toHaveLength(0);

      // User tracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Verify tracking relationship was created
      const trackedEvents = await prisma.userList.findUnique({
        where: { id: testUser.id },
        include: { trackedEvents: true },
      });
      expect(trackedEvents.trackedEvents).toHaveLength(1);
      expect(trackedEvents.trackedEvents[0].id).toBe(testEvent.id);

      // Verify event has the user as a tracker
      const eventWithTrackers = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(eventWithTrackers.trackedBy).toHaveLength(1);
      expect(eventWithTrackers.trackedBy[0].id).toBe(testUser.id);

      // User untracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            disconnect: { id: testUser.id },
          },
        },
      });

      // Verify tracking relationship was removed
      const untrackedEvents = await prisma.userList.findUnique({
        where: { id: testUser.id },
        include: { trackedEvents: true },
      });
      expect(untrackedEvents.trackedEvents).toHaveLength(0);
    });

    it('should handle multiple users tracking the same event', async () => {
      // Create second user
      const testUser2 = await testDatabase.createTestUser({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        genConName: 'Jane Smith',
        isAdmin: false,
        approved: true,
        emailNotifications: false,
        pushNotifications: true,
      });

      // Both users track the same event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: [{ id: testUser.id }, { id: testUser2.id }],
          },
        },
      });

      // Verify both users are tracking the event
      const eventWithTrackers = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(eventWithTrackers.trackedBy).toHaveLength(2);

      const trackerIds = eventWithTrackers.trackedBy.map((user: any) => user.id);
      expect(trackerIds).toContain(testUser.id);
      expect(trackerIds).toContain(testUser2.id);

      // First user stops tracking
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            disconnect: { id: testUser.id },
          },
        },
      });

      // Verify only second user is still tracking
      const eventAfterDisconnect = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(eventAfterDisconnect.trackedBy).toHaveLength(1);
      expect(eventAfterDisconnect.trackedBy[0].id).toBe(testUser2.id);
    });

    it('should handle user tracking multiple events', async () => {
      // Create second event
      const testEvent2 = await testDatabase.createTestEvent({
        id: 'TEST002',
        title: 'Second Test Event',
        shortDescription: 'Another test event',
        eventType: 'TCG',
        gameSystem: 'Magic',
        startDateTime: '2025-08-16T10:00:00Z',
        endDateTime: '2025-08-16T14:00:00Z',
        ageRequired: '13+',
        experienceRequired: 'Beginner',
        materialsRequired: 'Deck',
        cost: '20',
        location: 'Room 201',
        ticketsAvailable: 12,
        priority: 1,
        isCanceled: false,
      });

      // User tracks both events
      await prisma.userList.update({
        where: { id: testUser.id },
        data: {
          trackedEvents: {
            connect: [{ id: testEvent.id }, { id: testEvent2.id }],
          },
        },
      });

      // Verify user is tracking both events
      const userWithTrackedEvents = await prisma.userList.findUnique({
        where: { id: testUser.id },
        include: { trackedEvents: true },
      });
      expect(userWithTrackedEvents.trackedEvents).toHaveLength(2);

      const trackedEventIds = userWithTrackedEvents.trackedEvents.map((event: any) => event.id);
      expect(trackedEventIds).toContain(testEvent.id);
      expect(trackedEventIds).toContain(testEvent2.id);

      // User stops tracking first event
      await prisma.userList.update({
        where: { id: testUser.id },
        data: {
          trackedEvents: {
            disconnect: { id: testEvent.id },
          },
        },
      });

      // Verify user is only tracking second event
      const userAfterDisconnect = await prisma.userList.findUnique({
        where: { id: testUser.id },
        include: { trackedEvents: true },
      });
      expect(userAfterDisconnect.trackedEvents).toHaveLength(1);
      expect(userAfterDisconnect.trackedEvents[0].id).toBe(testEvent2.id);
    });

    it('should preserve tracking relationships when events are updated', async () => {
      // User tracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Update the event (simulating an event update)
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          title: 'Updated Event Title',
          cost: '15',
          location: 'Room 102',
        },
      });

      // Verify tracking relationship is preserved
      const eventAfterUpdate = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(eventAfterUpdate.trackedBy).toHaveLength(1);
      expect(eventAfterUpdate.trackedBy[0].id).toBe(testUser.id);
      expect(eventAfterUpdate.title).toBe('Updated Event Title');
    });

    it('should handle event cancellation with tracking users', async () => {
      // User tracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Cancel the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          isCanceled: true,
        },
      });

      // Verify event is canceled but tracking relationship is preserved
      const canceledEvent = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(canceledEvent.isCanceled).toBe(true);
      expect(canceledEvent.trackedBy).toHaveLength(1);
      expect(canceledEvent.trackedBy[0].id).toBe(testUser.id);
    });

    it('should find users tracking an event with notification preferences', async () => {
      // Create users with different notification preferences
      const emailUser = await testDatabase.createTestUser({
        firstName: 'Email',
        lastName: 'User',
        email: 'email@example.com',
        genConName: 'Email User',
        isAdmin: false,
        approved: true,
        emailNotifications: true,
        pushNotifications: false,
      });

      const smsUser = await testDatabase.createTestUser({
        firstName: 'SMS',
        lastName: 'User',
        email: 'sms@example.com',
        genConName: 'SMS User',
        isAdmin: false,
        approved: true,
        emailNotifications: false,
        pushNotifications: true,
      });

      const noNotificationUser = await testDatabase.createTestUser({
        firstName: 'No',
        lastName: 'Notification',
        email: 'none@example.com',
        genConName: 'No Notification',
        isAdmin: false,
        approved: true,
        emailNotifications: false,
        pushNotifications: false,
      });

      // All users track the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: [
              { id: emailUser.id },
              { id: smsUser.id },
              { id: noNotificationUser.id },
            ],
          },
        },
      });

      // Query users with notification preferences enabled
      const eventWithNotificationUsers = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: {
          trackedBy: {
            where: {
              OR: [
                { emailNotifications: true },
                { pushNotifications: true },
              ],
            },
          },
        },
      });

      // Should only return users with notifications enabled
      expect(eventWithNotificationUsers.trackedBy).toHaveLength(2);
      const notificationUserIds = eventWithNotificationUsers.trackedBy.map((user: any) => user.id);
      expect(notificationUserIds).toContain(emailUser.id);
      expect(notificationUserIds).toContain(smsUser.id);
      expect(notificationUserIds).not.toContain(noNotificationUser.id);
    });
  });

  describe('Data Integrity', () => {
    it('should handle cascade deletes properly', async () => {
      // User tracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Delete the user
      await prisma.userList.delete({
        where: { id: testUser.id },
      });

      // Verify tracking relationship was removed
      const eventAfterUserDelete = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(eventAfterUserDelete.trackedBy).toHaveLength(0);
    });

    it('should handle event deletion with tracking users', async () => {
      // User tracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Delete the event
      await prisma.eventsList.delete({
        where: { id: testEvent.id },
      });

      // Verify user's tracked events were updated
      const userAfterEventDelete = await prisma.userList.findUnique({
        where: { id: testUser.id },
        include: { trackedEvents: true },
      });
      expect(userAfterEventDelete.trackedEvents).toHaveLength(0);
    });

    it('should prevent duplicate tracking relationships', async () => {
      // User tracks the event
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Attempt to track the same event again should not create duplicate
      await prisma.eventsList.update({
        where: { id: testEvent.id },
        data: {
          trackedBy: {
            connect: { id: testUser.id },
          },
        },
      });

      // Verify only one tracking relationship exists
      const eventWithTrackers = await prisma.eventsList.findUnique({
        where: { id: testEvent.id },
        include: { trackedBy: true },
      });
      expect(eventWithTrackers.trackedBy).toHaveLength(1);
      expect(eventWithTrackers.trackedBy[0].id).toBe(testUser.id);
    });
  });
});