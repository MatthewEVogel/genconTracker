import { sendEventUpdateNotifications } from '../../utils/notificationService';
import { testDatabase } from './testDatabase';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

// Mock the prisma import in notificationService to use test database
jest.mock('../../lib/prisma', () => ({
  prisma: testDatabase.getPrisma()
}));

describe('Event Tracking Notifications', () => {
  const prisma = testDatabase.getPrisma();

  beforeAll(async () => {
    await testDatabase.setup();
  });

  afterAll(async () => {
    await testDatabase.teardown();
  });

  beforeEach(async () => {
    await testDatabase.cleanupTestData();
  });

  afterEach(async () => {
    await testDatabase.cleanupTestData();
  });

  it('should send notifications to users tracking an updated event', async () => {
    // Create test user with email notifications enabled
    const testUser = await prisma.userList.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test-notification@example.com',
        genConName: 'TestUser',
        emailNotifications: true,
        approved: true
      }
    });

    // Create test event
    const testEvent = await prisma.eventsList.create({
      data: {
        id: 'TEST_EVENT_001',
        title: 'Test Event for Notifications',
        shortDescription: 'A test event',
        eventType: 'RPG',
        gameSystem: 'D&D 5E',
        startDateTime: '2024-08-01 10:00:00',
        endDateTime: '2024-08-01 14:00:00',
        cost: '$5',
        location: 'Room 101',
        ticketsAvailable: 6,
        priority: 1,
        isCanceled: false
      }
    });

    // Have the user track the event
    await prisma.eventsList.update({
      where: { id: testEvent.id },
      data: {
        trackedBy: {
          connect: { id: testUser.id }
        }
      }
    });

    // Test sending notifications
    const result = await sendEventUpdateNotifications(
      testEvent.id,
      testEvent.title,
      ['title', 'location']
    );

    expect(result.success).toBe(true);
    expect(result.usersNotified).toBe(1);
    expect(result.emailsSent).toBe(1);
  });

  it('should not send notifications to users without email notifications enabled', async () => {
    // Create test user with email notifications disabled
    const testUser = await prisma.userList.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test-notification-disabled@example.com',
        genConName: 'TestUserDisabled',
        emailNotifications: false,
        approved: true
      }
    });

    // Create test event
    const testEvent = await prisma.eventsList.create({
      data: {
        id: 'TEST_EVENT_002',
        title: 'Test Event for Notifications',
        shortDescription: 'A test event',
        eventType: 'RPG',
        gameSystem: 'D&D 5E',
        startDateTime: '2024-08-01 10:00:00',
        endDateTime: '2024-08-01 14:00:00',
        cost: '$5',
        location: 'Room 101',
        ticketsAvailable: 6,
        priority: 1,
        isCanceled: false
      }
    });

    // Have the user track the event
    await prisma.eventsList.update({
      where: { id: testEvent.id },
      data: {
        trackedBy: {
          connect: { id: testUser.id }
        }
      }
    });

    // Test sending notifications
    const result = await sendEventUpdateNotifications(
      testEvent.id,
      testEvent.title,
      ['title', 'location']
    );

    expect(result.success).toBe(true);
    expect(result.usersNotified).toBe(0);
    expect(result.emailsSent).toBe(0);
  });

  it('should handle events with no tracking users', async () => {
    // Create test event with no tracking users
    const testEvent = await prisma.eventsList.create({
      data: {
        id: 'TEST_EVENT_003',
        title: 'Test Event with No Trackers',
        shortDescription: 'A test event',
        eventType: 'RPG',
        gameSystem: 'D&D 5E',
        startDateTime: '2024-08-01 10:00:00',
        endDateTime: '2024-08-01 14:00:00',
        cost: '$5',
        location: 'Room 101',
        ticketsAvailable: 6,
        priority: 1,
        isCanceled: false
      }
    });

    // Test sending notifications
    const result = await sendEventUpdateNotifications(
      testEvent.id,
      testEvent.title,
      ['title', 'location']
    );

    expect(result.success).toBe(true);
    expect(result.usersNotified).toBe(0);
    expect(result.emailsSent).toBe(0);
    expect(result.message).toBe('No users to notify');
  });

  it('should send notifications to multiple tracking users', async () => {
    // Create multiple test users with email notifications enabled
    const testUser1 = await prisma.userList.create({
      data: {
        firstName: 'Test',
        lastName: 'User1',
        email: 'test-notification-1@example.com',
        genConName: 'TestUser1',
        emailNotifications: true,
        approved: true
      }
    });

    const testUser2 = await prisma.userList.create({
      data: {
        firstName: 'Test',
        lastName: 'User2',
        email: 'test-notification-2@example.com',
        genConName: 'TestUser2',
        emailNotifications: true,
        approved: true
      }
    });

    // Create test event
    const testEvent = await prisma.eventsList.create({
      data: {
        id: 'TEST_EVENT_004',
        title: 'Test Event for Multiple Users',
        shortDescription: 'A test event',
        eventType: 'RPG',
        gameSystem: 'D&D 5E',
        startDateTime: '2024-08-01 10:00:00',
        endDateTime: '2024-08-01 14:00:00',
        cost: '$5',
        location: 'Room 101',
        ticketsAvailable: 6,
        priority: 1,
        isCanceled: false
      }
    });

    // Have both users track the event
    await prisma.eventsList.update({
      where: { id: testEvent.id },
      data: {
        trackedBy: {
          connect: [{ id: testUser1.id }, { id: testUser2.id }]
        }
      }
    });

    // Test sending notifications
    const result = await sendEventUpdateNotifications(
      testEvent.id,
      testEvent.title,
      ['cost', 'location']
    );

    expect(result.success).toBe(true);
    expect(result.usersNotified).toBe(2);
    expect(result.emailsSent).toBe(2);
  });
});
