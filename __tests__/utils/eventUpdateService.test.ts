// Mock the prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    eventsList: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Mock the xlsx parser
jest.mock('@/utils/xlsxToTsv', () => ({
  parseXlsxToEvents: jest.fn(),
}));

// Mock AdmZip
jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    getEntries: jest.fn().mockReturnValue([
      {
        entryName: 'events.xlsx',
        isDirectory: false,
        getData: jest.fn().mockReturnValue(Buffer.from('mock xlsx data')),
      },
    ]),
  }));
});

// Mock fetch
global.fetch = jest.fn();

import { updateEventsFromGenCon } from '@/utils/eventUpdateService';
import { prisma } from '@/lib/prisma';
import { parseXlsxToEvents } from '@/utils/xlsxToTsv';

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockParseXlsxToEvents = parseXlsxToEvents as jest.MockedFunction<typeof parseXlsxToEvents>;
const mockEventsFindMany = prisma.eventsList.findMany as jest.MockedFunction<typeof prisma.eventsList.findMany>;
const mockEventsCreate = prisma.eventsList.create as jest.MockedFunction<typeof prisma.eventsList.create>;
const mockEventsUpdate = prisma.eventsList.update as jest.MockedFunction<typeof prisma.eventsList.update>;
const mockEventsDelete = prisma.eventsList.delete as jest.MockedFunction<typeof prisma.eventsList.delete>;
const mockEventsFindUnique = prisma.eventsList.findUnique as jest.MockedFunction<typeof prisma.eventsList.findUnique>;

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Event Update Service with Tracking Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    } as Response);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  const mockExistingEvent = {
    id: 'event1',
    title: 'Original Title',
    shortDescription: 'Original description',
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
    isCanceled: false,
    _count: {
      desiredEvents: 1,
      trackedBy: 2,
    },
  };

  const mockNewEvent = {
    id: 'event1',
    title: 'Updated Title',
    shortDescription: 'Updated description',
    eventType: 'RPG',
    gameSystem: 'D&D',
    startDateTime: '2025-08-15T11:00:00Z', // Time changed
    endDateTime: '2025-08-15T15:00:00Z',
    ageRequired: '18+',
    experienceRequired: 'None',
    materialsRequired: 'None',
    cost: '15', // Cost changed
    location: 'Room 102', // Location changed
    ticketsAvailable: 8, // Tickets changed
  };

  const mockTrackingUsers = [
    {
      id: 'user1',
      email: 'user1@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailNotifications: true,
      pushNotifications: false,
    },
    {
      id: 'user2',
      email: 'user2@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      emailNotifications: false,
      pushNotifications: true,
    },
  ];

  describe('Event change detection and notifications', () => {
    it('should detect changes and send notifications to tracking users', async () => {
      // Setup mocks
      mockParseXlsxToEvents.mockReturnValue([mockNewEvent]);
      mockEventsFindMany.mockResolvedValueOnce([mockExistingEvent]); // First call for differential update
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)
      mockEventsUpdate.mockResolvedValue(mockNewEvent);
      mockEventsFindUnique.mockResolvedValue({
        ...mockNewEvent,
        trackedBy: mockTrackingUsers,
      });

      // Run the update
      const result = await updateEventsFromGenCon();

      // Verify the event was updated
      expect(mockEventsUpdate).toHaveBeenCalledWith({
        where: { id: 'event1' },
        data: {
          title: 'Updated Title',
          shortDescription: 'Updated description',
          eventType: 'RPG',
          gameSystem: 'D&D',
          startDateTime: '2025-08-15T11:00:00Z',
          endDateTime: '2025-08-15T15:00:00Z',
          ageRequired: '18+',
          experienceRequired: 'None',
          materialsRequired: 'None',
          cost: '15',
          location: 'Room 102',
          ticketsAvailable: 8,
          isCanceled: false,
        },
      });

      // Verify notifications were attempted
      expect(mockEventsFindUnique).toHaveBeenCalledWith({
        where: { id: 'event1' },
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

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.stats.updatedEvents).toBe(1);
      expect(result.stats.totalEvents).toBe(1);
    });

    it('should mark events as canceled and notify tracking users', async () => {
      // Setup: existing event not in new data (canceled)
      mockParseXlsxToEvents.mockReturnValue([]); // No new events
      mockEventsFindMany.mockResolvedValueOnce([mockExistingEvent]); // First call for differential update
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)
      mockEventsUpdate.mockResolvedValue({ ...mockExistingEvent, isCanceled: true });
      mockEventsFindUnique.mockResolvedValue({
        ...mockExistingEvent,
        trackedBy: mockTrackingUsers,
      });

      const result = await updateEventsFromGenCon();

      // Verify the event was marked as canceled
      expect(mockEventsUpdate).toHaveBeenCalledWith({
        where: { id: 'event1' },
        data: {
          isCanceled: true,
        },
      });

      // Verify notifications were attempted for cancellation
      expect(mockEventsFindUnique).toHaveBeenCalledWith({
        where: { id: 'event1' },
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

      expect(result.success).toBe(true);
      expect(result.stats.canceledEvents).toBe(1);
    });

    it('should delete events with no users or trackers', async () => {
      const eventWithNoUsers = {
        ...mockExistingEvent,
        _count: {
          desiredEvents: 0,
          trackedBy: 0,
        },
      };

      mockParseXlsxToEvents.mockReturnValue([]);
      mockEventsFindMany.mockResolvedValueOnce([eventWithNoUsers]); // First call for differential update
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)
      mockEventsDelete.mockResolvedValue(eventWithNoUsers);

      const result = await updateEventsFromGenCon();

      // Verify the event was deleted (not just canceled)
      expect(mockEventsDelete).toHaveBeenCalledWith({
        where: { id: 'event1' },
      });

      expect(result.success).toBe(true);
      expect(result.stats.deletedEvents).toBe(1);
    });

    it('should preserve events with tracking users even if no desired events', async () => {
      const eventWithTrackingUsers = {
        ...mockExistingEvent,
        _count: {
          desiredEvents: 0, // No desired events
          trackedBy: 1, // But has tracking users
        },
      };

      mockParseXlsxToEvents.mockReturnValue([]);
      mockEventsFindMany.mockResolvedValueOnce([eventWithTrackingUsers]); // First call for differential update
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)
      mockEventsUpdate.mockResolvedValue({ ...eventWithTrackingUsers, isCanceled: true });
      mockEventsFindUnique.mockResolvedValue({
        ...eventWithTrackingUsers,
        trackedBy: [mockTrackingUsers[0]],
      });

      const result = await updateEventsFromGenCon();

      // Verify the event was canceled (not deleted) because it has trackers
      expect(mockEventsUpdate).toHaveBeenCalledWith({
        where: { id: 'event1' },
        data: {
          isCanceled: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.stats.canceledEvents).toBe(1);
    });

    it('should create new events without notifications', async () => {
      const newEvent = {
        id: 'event2',
        title: 'New Event',
        shortDescription: 'A new event',
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
      };

      mockParseXlsxToEvents.mockReturnValue([newEvent]);
      mockEventsFindMany.mockResolvedValueOnce([]); // No existing events
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)
      mockEventsCreate.mockResolvedValue(newEvent);

      const result = await updateEventsFromGenCon();

      // Verify the new event was created
      expect(mockEventsCreate).toHaveBeenCalledWith({
        data: {
          id: 'event2',
          title: 'New Event',
          shortDescription: 'A new event',
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
        },
      });

      // Verify no notifications were sent for new events
      expect(mockEventsFindUnique).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.stats.newEvents).toBe(1);
    });

    it('should handle events with no changes', async () => {
      // Event with identical data (no changes)
      const unchangedEvent = { ...mockExistingEvent };
      
      mockParseXlsxToEvents.mockReturnValue([unchangedEvent]);
      mockEventsFindMany.mockResolvedValueOnce([mockExistingEvent]); // First call for differential update
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)

      const result = await updateEventsFromGenCon();

      // Verify no update was made
      expect(mockEventsUpdate).not.toHaveBeenCalled();
      expect(mockEventsFindUnique).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.stats.updatedEvents).toBe(0);
    });

    it('should handle events with no tracking users', async () => {
      mockParseXlsxToEvents.mockReturnValue([mockNewEvent]);
      mockEventsFindMany.mockResolvedValueOnce([mockExistingEvent]); // First call for differential update
      mockEventsFindMany.mockResolvedValueOnce([]); // Second call for cleanup (no canceled events)
      mockEventsUpdate.mockResolvedValue(mockNewEvent);
      mockEventsFindUnique.mockResolvedValue({
        ...mockNewEvent,
        trackedBy: [], // No tracking users
      });

      const result = await updateEventsFromGenCon();

      // Verify the event was updated
      expect(mockEventsUpdate).toHaveBeenCalled();
      
      // Verify notification query was made but no users found
      expect(mockEventsFindUnique).toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.stats.updatedEvents).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await updateEventsFromGenCon();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
      expect(result.stats.downloaded).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockParseXlsxToEvents.mockReturnValue([mockNewEvent]);
      mockEventsFindMany.mockRejectedValue(new Error('Database error'));

      const result = await updateEventsFromGenCon();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database error');
    });

    it('should handle notification errors gracefully', async () => {
      mockParseXlsxToEvents.mockReturnValue([mockNewEvent]);
      mockEventsFindMany.mockResolvedValue([mockExistingEvent]);
      mockEventsUpdate.mockResolvedValue(mockNewEvent);
      mockEventsFindUnique.mockRejectedValue(new Error('Notification error'));

      const result = await updateEventsFromGenCon();

      // Should still succeed even if notifications fail
      expect(result.success).toBe(true);
      expect(result.stats.updatedEvents).toBe(1);
    });
  });
});