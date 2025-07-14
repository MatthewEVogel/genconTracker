import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import trackHandler from '../../pages/api/events/[eventId]/track';
import trackedEventsHandler from '../../pages/api/user-tracked-events';

// Mock the prisma module
jest.mock('../../lib/prisma', () => ({
  prisma: {
    eventsList: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userList: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock auth options
jest.mock('../../lib/auth', () => ({
  authOptions: {},
}));

import { prisma } from '../../lib/prisma';
import { getServerSession } from 'next-auth';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockEventsFindUnique = prisma.eventsList.findUnique as jest.MockedFunction<typeof prisma.eventsList.findUnique>;
const mockEventsFindFirst = prisma.eventsList.findFirst as jest.MockedFunction<typeof prisma.eventsList.findFirst>;
const mockEventsUpdate = prisma.eventsList.update as jest.MockedFunction<typeof prisma.eventsList.update>;
const mockUsersFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;

describe('Event Tracking API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user1',
    email: 'user1@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockEvent = {
    id: 'event1',
    title: 'Test Event',
    shortDescription: 'A test event',
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
  };

  describe('POST /api/events/[eventId]/track', () => {
    it('should track an event successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null); // No existing tracking
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Event tracking enabled successfully',
      });
      expect(mockEventsUpdate).toHaveBeenCalledWith({
        where: { id: 'event1' },
        data: {
          trackedBy: {
            connect: { id: 'user1' },
          },
        },
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue(null);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 404 for non-existent event', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'nonexistent' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsFindUnique.mockResolvedValue(null);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Event not found',
      });
    });

    it('should return 400 if user already tracking event', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(mockEvent); // Already tracking

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User already tracking this event',
      });
    });
  });

  describe('DELETE /api/events/[eventId]/track', () => {
    it('should untrack an event successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Event tracking disabled successfully',
      });
      expect(mockEventsUpdate).toHaveBeenCalledWith({
        where: { id: 'event1' },
        data: {
          trackedBy: {
            disconnect: { id: 'user1' },
          },
        },
      });
    });

    it('should return 401 for unauthenticated DELETE requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue(null);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should handle database errors during untracking', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsUpdate.mockRejectedValue(new Error('Database error'));

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to untrack event',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return 400 for missing eventId', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: {},
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Event ID is required',
      });
    });

    it('should return 400 for invalid eventId type', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: ['invalid', 'array'] },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Event ID is required',
      });
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed',
      });
    });

    it('should handle database errors during tracking', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null);
      mockEventsUpdate.mockRejectedValue(new Error('Database connection failed'));

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to track event',
      });
    });

    it('should handle database errors when checking existing tracking', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockRejectedValue(new Error('Database error'));

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to track event',
      });
    });

    it('should handle database errors when finding event', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockEventsFindUnique.mockRejectedValue(new Error('Database error'));

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to track event',
      });
    });
  });

  describe('GET /api/user-tracked-events', () => {
    it('should return user tracked events successfully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      const mockUserWithTrackedEvents = {
        id: 'user1',
        createdAt: new Date(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'user1@example.com',
        genConName: 'John Doe',
        isAdmin: false,
        approved: true,
        googleId: null,
        provider: 'credentials',
        image: null,
        emailNotifications: true,
        pushNotifications: false,
        trackedEvents: [
          {
            id: 'event1',
            title: 'Test Event 1',
            startDateTime: '2025-08-15T10:00:00Z',
            endDateTime: '2025-08-15T14:00:00Z',
            eventType: 'RPG',
            location: 'Room 101',
            cost: '10',
            ticketsAvailable: 6,
            isCanceled: false,
          },
        ],
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockUsersFindUnique.mockResolvedValue(mockUserWithTrackedEvents as any);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.trackedEvents).toHaveLength(1);
      expect(responseData.trackedEvents[0].id).toBe('event1');
    });

    it('should return empty array when user has no tracked events', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      const mockUserWithNoTrackedEvents = {
        id: 'user1',
        createdAt: new Date(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'user1@example.com',
        genConName: 'John Doe',
        isAdmin: false,
        approved: true,
        googleId: null,
        provider: 'credentials',
        image: null,
        emailNotifications: true,
        pushNotifications: false,
        trackedEvents: [],
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockUsersFindUnique.mockResolvedValue(mockUserWithNoTrackedEvents as any);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.trackedEvents).toHaveLength(0);
    });

    it('should return 404 when user not found', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockUsersFindUnique.mockResolvedValue(null);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User not found',
      });
    });

    it('should return tracked events sorted by start date', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      const mockUserWithMultipleTrackedEvents = {
        id: 'user1',
        createdAt: new Date(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'user1@example.com',
        genConName: 'John Doe',
        isAdmin: false,
        approved: true,
        googleId: null,
        provider: 'credentials',
        image: null,
        emailNotifications: true,
        pushNotifications: false,
        trackedEvents: [
          {
            id: 'event1',
            title: 'First Event',
            startDateTime: '2025-08-15T10:00:00Z',
            endDateTime: '2025-08-15T14:00:00Z',
            eventType: 'RPG',
            location: 'Room 101',
            cost: '10',
            ticketsAvailable: 6,
            isCanceled: false,
          },
          {
            id: 'event2',
            title: 'Second Event',
            startDateTime: '2025-08-16T10:00:00Z',
            endDateTime: '2025-08-16T14:00:00Z',
            eventType: 'TCG',
            location: 'Room 102',
            cost: '15',
            ticketsAvailable: 8,
            isCanceled: false,
          },
        ],
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockUsersFindUnique.mockResolvedValue(mockUserWithMultipleTrackedEvents as any);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.trackedEvents).toHaveLength(2);
      expect(responseData.trackedEvents[0].id).toBe('event1');
      expect(responseData.trackedEvents[1].id).toBe('event2');
      
      // Verify the prisma query was called with correct orderBy
      expect(mockUsersFindUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
        include: {
          trackedEvents: {
            orderBy: {
              startDateTime: 'asc'
            }
          }
        }
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      mockGetServerSession.mockResolvedValue(null);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed',
      });
    });

    it('should handle database errors gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      mockGetServerSession.mockResolvedValue({ user: mockUser });
      mockUsersFindUnique.mockRejectedValue(new Error('Database connection failed'));

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to fetch tracked events',
      });
    });
  });
});
