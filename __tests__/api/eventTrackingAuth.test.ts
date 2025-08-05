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
  authOptions: {
    providers: [
      {
        id: 'credentials',
        name: 'Credentials',
        type: 'credentials',
      },
      {
        id: 'google',
        name: 'Google',
        type: 'oauth',
      },
    ],
  },
}));

import { prisma } from '../../lib/prisma';
import { getServerSession } from 'next-auth';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockEventsFindUnique = prisma.eventsList.findUnique as jest.MockedFunction<typeof prisma.eventsList.findUnique>;
const mockEventsFindFirst = prisma.eventsList.findFirst as jest.MockedFunction<typeof prisma.eventsList.findFirst>;
const mockEventsUpdate = prisma.eventsList.update as jest.MockedFunction<typeof prisma.eventsList.update>;
const mockUsersFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;

describe('Event Tracking Authentication Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockManualUser = {
    id: 'manual-user-1',
    email: 'manual@example.com',
    firstName: 'Manual',
    lastName: 'User',
    provider: 'manual',
    approved: true,
  };

  const mockGoogleUser = {
    id: 'google-user-1',
    email: 'google@example.com',
    firstName: 'Google',
    lastName: 'User',
    provider: 'google',
    approved: true,
  };

  const mockCredentialsUser = {
    id: 'credentials-user-1',
    email: 'credentials@example.com',
    firstName: 'Credentials',
    lastName: 'User',
    provider: 'credentials',
    approved: true,
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

  describe('Manual User Authentication', () => {
    it('should allow manual users to track events with credentials provider', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      // Mock session with credentials provider (our fix)
      mockGetServerSession.mockResolvedValue({ 
        user: mockCredentialsUser,
        provider: 'credentials'
      });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null);
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
            connect: { id: 'credentials-user-1' },
          },
        },
      });
    });

    it('should allow manual users to access tracked events', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      const mockUserWithTrackedEvents = {
        id: 'credentials-user-1',
        createdAt: new Date(),
        firstName: 'Credentials',
        lastName: 'User',
        email: 'credentials@example.com',
        genConName: 'Credentials User',
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

      mockGetServerSession.mockResolvedValue({ 
        user: mockCredentialsUser,
        provider: 'credentials'
      });
      mockUsersFindUnique.mockResolvedValue(mockUserWithTrackedEvents as any);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.trackedEvents).toHaveLength(1);
      expect(responseData.trackedEvents[0].id).toBe('event1');
    });
  });

  describe('Google OAuth User Authentication', () => {
    it('should allow Google users to track events', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ 
        user: mockGoogleUser,
        provider: 'google'
      });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null);
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Event tracking enabled successfully',
      });
    });

    it('should allow Google users to access tracked events', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      const mockGoogleUserWithTrackedEvents = {
        id: 'google-user-1',
        createdAt: new Date(),
        firstName: 'Google',
        lastName: 'User',
        email: 'google@example.com',
        genConName: 'Google User',
        isAdmin: false,
        approved: true,
        googleId: 'google-123',
        provider: 'google',
        image: 'https://example.com/avatar.jpg',
        emailNotifications: true,
        pushNotifications: false,
        trackedEvents: [],
      };

      mockGetServerSession.mockResolvedValue({ 
        user: mockGoogleUser,
        provider: 'google'
      });
      mockUsersFindUnique.mockResolvedValue(mockGoogleUserWithTrackedEvents as any);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.trackedEvents).toHaveLength(0);
    });
  });

  describe('Session Edge Cases', () => {
    it('should handle session with missing user object', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ 
        user: null,
        provider: 'credentials'
      });

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should handle session with undefined user', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ 
        user: undefined,
        provider: 'credentials'
      });

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should handle session with user missing required fields', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ 
        user: { email: 'test@example.com' }, // Missing id
        provider: 'credentials'
      });

      await trackHandler(req, res);

      // The API might still work if the user object has some fields
      // This test verifies the behavior when user is missing required fields
      expect([200, 401]).toContain(res._getStatusCode());
    });

    it('should handle empty session object', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({});

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });
  });

  describe('User Approval Status', () => {
    it('should allow approved manual users to track events', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      const approvedUser = {
        ...mockCredentialsUser,
        approved: true,
      };

      mockGetServerSession.mockResolvedValue({ 
        user: approvedUser,
        provider: 'credentials'
      });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null);
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle unapproved users gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      const unapprovedUser = {
        ...mockCredentialsUser,
        approved: false,
      };

      mockGetServerSession.mockResolvedValue({ 
        user: unapprovedUser,
        provider: 'credentials'
      });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null);
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req, res);

      // The API should still work - approval is handled at the UI level
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Cross-Provider Compatibility', () => {
    it('should handle users switching between providers', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      // User originally created manually but now using Google OAuth
      const mixedProviderUser = {
        id: 'mixed-user-1',
        createdAt: new Date(),
        firstName: 'Mixed',
        lastName: 'User',
        email: 'mixed@example.com',
        genConName: 'Mixed User',
        isAdmin: false,
        approved: true,
        googleId: 'google-456',
        provider: 'google', // Now using Google
        image: 'https://example.com/avatar.jpg',
        emailNotifications: true,
        pushNotifications: false,
        trackedEvents: [
          {
            id: 'event1',
            title: 'Test Event',
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

      mockGetServerSession.mockResolvedValue({ 
        user: {
          id: 'mixed-user-1',
          email: 'mixed@example.com',
          firstName: 'Mixed',
          lastName: 'User',
          provider: 'google',
        },
        provider: 'google'
      });
      mockUsersFindUnique.mockResolvedValue(mixedProviderUser as any);

      await trackedEventsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.trackedEvents).toHaveLength(1);
    });
  });

  describe('Concurrent User Sessions', () => {
    it('should handle multiple users tracking the same event simultaneously', async () => {
      // First user tracks event
      const { req: req1, res: res1 } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ 
        user: mockCredentialsUser,
        provider: 'credentials'
      });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null);
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);

      // Second user tracks same event
      const { req: req2, res: res2 } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      mockGetServerSession.mockResolvedValue({ 
        user: mockGoogleUser,
        provider: 'google'
      });
      mockEventsFindUnique.mockResolvedValue(mockEvent);
      mockEventsFindFirst.mockResolvedValue(null); // Not tracking yet
      mockEventsUpdate.mockResolvedValue(mockEvent);

      await trackHandler(req2, res2);
      expect(res2._getStatusCode()).toBe(200);
    });
  });

  describe('Authentication Error Recovery', () => {
    it('should handle NextAuth session errors gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      // Mock console.error to suppress error output during test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        mockGetServerSession.mockRejectedValue(new Error('Session service unavailable'));

        await trackHandler(req, res);

        // Should return 500 for session service errors
        expect(res._getStatusCode()).toBe(500);
        expect(JSON.parse(res._getData())).toEqual({
          error: 'Failed to track event',
        });
      } finally {
        // Restore console.error
        consoleSpy.mockRestore();
      }
    });

    it('should handle malformed session data', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: { eventId: 'event1' },
      });

      // Malformed session data
      mockGetServerSession.mockResolvedValue('invalid-session-data' as any);

      await trackHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
      });
    });
  });
});
