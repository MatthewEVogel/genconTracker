import { ConflictDetectionService } from '../../../lib/services/server/conflictDetectionService';

// Mock the prisma module
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    personalEvent: {
      findMany: jest.fn(),
    },
    desiredEvents: {
      findMany: jest.fn(),
    },
    userList: {
      findUnique: jest.fn(),
    },
    purchasedEvents: {
      findMany: jest.fn(),
    },
    eventsList: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../../lib/prisma';

const mockPersonalEventFindMany = prisma.personalEvent.findMany as jest.MockedFunction<typeof prisma.personalEvent.findMany>;
const mockDesiredEventsFindMany = prisma.desiredEvents.findMany as jest.MockedFunction<typeof prisma.desiredEvents.findMany>;
const mockUserListFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;
const mockPurchasedEventsFindMany = prisma.purchasedEvents.findMany as jest.MockedFunction<typeof prisma.purchasedEvents.findMany>;
const mockEventsListFindMany = prisma.eventsList.findMany as jest.MockedFunction<typeof prisma.eventsList.findMany>;

describe('ConflictDetectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkConflicts', () => {
    it('should detect conflicts with personal events', async () => {
      // Mock personal event conflict
      mockPersonalEventFindMany.mockResolvedValue([
        {
          id: 'personal1',
          title: 'Conflicting Personal Event',
          startTime: new Date('2024-08-15T11:00:00.000Z'),
          endTime: new Date('2024-08-15T13:00:00.000Z'),
          createdBy: 'user123',
          attendees: [],
          location: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: {
            firstName: 'John',
            lastName: 'Doe',
            genConName: 'JohnDoe'
          }
        }
      ] as any);

      // Mock no other conflicts
      mockDesiredEventsFindMany.mockResolvedValue([]);
      mockUserListFindUnique.mockResolvedValue({ trackedEvents: [] } as any);
      mockPurchasedEventsFindMany.mockResolvedValue([]);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z'
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        id: 'personal1',
        title: 'Conflicting Personal Event',
        startTime: '2024-08-15T11:00:00.000Z',
        endTime: '2024-08-15T13:00:00.000Z',
        type: 'personal',
        source: 'Created by John Doe'
      });
    });

    it('should detect conflicts with desired events', async () => {
      // Mock no personal events
      mockPersonalEventFindMany.mockResolvedValue([]);

      // Mock desired event conflict
      mockDesiredEventsFindMany.mockResolvedValue([
        {
          id: 'desired1',
          userId: 'user123',
          eventsListId: 'event123',
          eventsList: {
            id: 'event123',
            title: 'Gen Con Event',
            startDateTime: '2024-08-15T11:30:00.000Z',
            endDateTime: '2024-08-15T14:00:00.000Z'
          }
        }
      ] as any);

      // Mock no other conflicts
      mockUserListFindUnique.mockResolvedValue({ trackedEvents: [] } as any);
      mockPurchasedEventsFindMany.mockResolvedValue([]);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z'
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        id: 'event123',
        title: 'Gen Con Event',
        startTime: '2024-08-15T11:30:00.000Z',
        endTime: '2024-08-15T14:00:00.000Z',
        type: 'desired',
        source: 'Added from event browser'
      });
    });

    it('should detect conflicts with tracked events', async () => {
      // Mock no personal events
      mockPersonalEventFindMany.mockResolvedValue([]);
      mockDesiredEventsFindMany.mockResolvedValue([]);

      // Mock tracked event conflict
      mockUserListFindUnique.mockResolvedValue({
        trackedEvents: [
          {
            id: 'tracked1',
            title: 'Tracked Event',
            startDateTime: '2024-08-15T11:30:00.000Z',
            endDateTime: '2024-08-15T14:00:00.000Z'
          }
        ]
      } as any);

      mockPurchasedEventsFindMany.mockResolvedValue([]);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z'
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        id: 'tracked1',
        title: 'Tracked Event',
        startTime: '2024-08-15T11:30:00.000Z',
        endTime: '2024-08-15T14:00:00.000Z',
        type: 'tracked',
        source: 'Tracked from event browser'
      });
    });

    it('should detect conflicts with purchased events', async () => {
      // Mock no personal events
      mockPersonalEventFindMany.mockResolvedValue([]);
      mockDesiredEventsFindMany.mockResolvedValue([]);
      mockUserListFindUnique.mockResolvedValueOnce({ trackedEvents: [] } as any);

      // Mock user with genConName for purchased events
      mockUserListFindUnique.mockResolvedValueOnce({
        genConName: 'JohnDoe'
      } as any);

      // Mock purchased event
      mockPurchasedEventsFindMany.mockResolvedValue([
        {
          id: 'purchased1',
          eventId: 'event456',
          recipient: 'JohnDoe',
          refundedEvents: []
        }
      ] as any);

      // Mock event details
      mockEventsListFindMany.mockResolvedValue([
        {
          id: 'event456',
          title: 'Purchased Event',
          startDateTime: '2024-08-15T11:30:00.000Z',
          endDateTime: '2024-08-15T14:00:00.000Z'
        }
      ] as any);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z'
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        id: 'event456',
        title: 'Purchased Event',
        startTime: '2024-08-15T11:30:00.000Z',
        endTime: '2024-08-15T14:00:00.000Z',
        type: 'purchased',
        source: 'Purchased ticket'
      });
    });

    it('should return no conflicts when there are no overlapping events', async () => {
      // Mock no conflicts
      mockPersonalEventFindMany.mockResolvedValue([]);
      mockDesiredEventsFindMany.mockResolvedValue([]);
      mockUserListFindUnique.mockResolvedValue({ trackedEvents: [] } as any);
      mockPurchasedEventsFindMany.mockResolvedValue([]);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z'
      });

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should exclude specified event when checking conflicts', async () => {
      // Mock personal event that would conflict but should be excluded
      mockPersonalEventFindMany.mockResolvedValue([]);

      // Mock no other conflicts
      mockDesiredEventsFindMany.mockResolvedValue([]);
      mockUserListFindUnique.mockResolvedValue({ trackedEvents: [] } as any);
      mockPurchasedEventsFindMany.mockResolvedValue([]);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z',
        excludeEventId: 'personal1',
        excludeEventType: 'personal'
      });

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);

      // Verify that the exclusion was applied in the query
      expect(mockPersonalEventFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { createdBy: 'user123' },
            { attendees: { has: 'user123' } }
          ],
          AND: [
            { startTime: { lt: new Date('2024-08-15T12:00:00.000Z') } },
            { endTime: { gt: new Date('2024-08-15T10:00:00.000Z') } },
            { id: { not: 'personal1' } }
          ]
        },
        include: {
          creator: {
            select: {
              firstName: true,
              lastName: true,
              genConName: true
            }
          }
        }
      });
    });

    it('should handle multiple conflict types simultaneously', async () => {
      // Mock personal event conflict
      mockPersonalEventFindMany.mockResolvedValue([
        {
          id: 'personal1',
          title: 'Personal Event',
          startTime: new Date('2024-08-15T11:00:00.000Z'),
          endTime: new Date('2024-08-15T13:00:00.000Z'),
          createdBy: 'user123',
          attendees: [],
          location: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: {
            firstName: 'John',
            lastName: 'Doe',
            genConName: 'JohnDoe'
          }
        }
      ] as any);

      // Mock desired event conflict
      mockDesiredEventsFindMany.mockResolvedValue([
        {
          id: 'desired1',
          userId: 'user123',
          eventsListId: 'event123',
          eventsList: {
            id: 'event123',
            title: 'Desired Event',
            startDateTime: '2024-08-15T11:30:00.000Z',
            endDateTime: '2024-08-15T14:00:00.000Z'
          }
        }
      ] as any);

      // Mock no other conflicts
      mockUserListFindUnique.mockResolvedValue({ trackedEvents: [] } as any);
      mockPurchasedEventsFindMany.mockResolvedValue([]);

      const result = await ConflictDetectionService.checkConflicts({
        userId: 'user123',
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z'
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(2);
      
      // Should have both personal and desired event conflicts
      const personalConflict = result.conflicts.find(c => c.type === 'personal');
      const desiredConflict = result.conflicts.find(c => c.type === 'desired');
      
      expect(personalConflict).toBeDefined();
      expect(desiredConflict).toBeDefined();
    });

    it('should validate that start time is before end time', async () => {
      await expect(
        ConflictDetectionService.checkConflicts({
          userId: 'user123',
          startTime: '2024-08-15T12:00:00.000Z',
          endTime: '2024-08-15T10:00:00.000Z' // End before start
        })
      ).rejects.toThrow('Start time must be before end time');
    });
  });

  describe('timeRangesOverlap', () => {
    it('should detect overlapping time ranges', () => {
      expect(ConflictDetectionService.timeRangesOverlap(
        '2024-08-15T10:00:00.000Z',
        '2024-08-15T12:00:00.000Z',
        '2024-08-15T11:00:00.000Z',
        '2024-08-15T13:00:00.000Z'
      )).toBe(true);
    });

    it('should detect non-overlapping time ranges', () => {
      expect(ConflictDetectionService.timeRangesOverlap(
        '2024-08-15T10:00:00.000Z',
        '2024-08-15T12:00:00.000Z',
        '2024-08-15T13:00:00.000Z',
        '2024-08-15T15:00:00.000Z'
      )).toBe(false);
    });

    it('should handle adjacent time ranges as non-overlapping', () => {
      expect(ConflictDetectionService.timeRangesOverlap(
        '2024-08-15T10:00:00.000Z',
        '2024-08-15T12:00:00.000Z',
        '2024-08-15T12:00:00.000Z',
        '2024-08-15T14:00:00.000Z'
      )).toBe(false);
    });
  });
});
