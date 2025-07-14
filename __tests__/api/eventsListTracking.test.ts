import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/events-list';

// Mock the EventsListService
jest.mock('@/lib/services/server/eventsListService', () => ({
  EventsListService: {
    getEvents: jest.fn(),
  },
}));

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock the prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userList: {
      findUnique: jest.fn(),
    },
  },
}));

import { EventsListService } from '@/lib/services/server/eventsListService';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

const mockGetEvents = EventsListService.getEvents as jest.MockedFunction<typeof EventsListService.getEvents>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockUsersFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;

describe('Events List API with Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user1',
    email: 'user1@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockEvents = [
    {
      id: 'event1',
      title: 'Test Event 1',
      shortDescription: 'First test event',
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
    },
    {
      id: 'event2',
      title: 'Test Event 2',
      shortDescription: 'Second test event',
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
  ];

  const mockPagination = {
    currentPage: 1,
    totalPages: 1,
    totalEvents: 2,
    hasNextPage: false,
    hasPrevPage: false,
  };

  describe('GET /api/events-list with tracking information', () => {
    it('should include tracking information for authenticated users', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { page: '1', limit: '10' },
      });

      // Mock authenticated user
      mockGetServerSession.mockResolvedValue({ user: mockUser });

      // Mock events service response
      mockGetEvents.mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });

      // Mock user with tracked events
      mockUsersFindUnique.mockResolvedValue({
        id: 'user1',
        trackedEvents: [
          { id: 'event1' }, // User is tracking event1
        ],
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());

      // Verify events include tracking information
      expect(responseData.events).toHaveLength(2);
      expect(responseData.events[0].id).toBe('event1');
      expect(responseData.events[0].isTracked).toBe(true);
      expect(responseData.events[1].id).toBe('event2');
      expect(responseData.events[1].isTracked).toBe(false);

      // Verify pagination is preserved
      expect(responseData.pagination).toEqual(mockPagination);
    });

    it('should not include tracking information for unauthenticated users', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { page: '1', limit: '10' },
      });

      // Mock unauthenticated user
      mockGetServerSession.mockResolvedValue(null);

      // Mock events service response
      mockGetEvents.mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());

      // Verify events do not include tracking information
      expect(responseData.events).toHaveLength(2);
      expect(responseData.events[0].isTracked).toBeUndefined();
      expect(responseData.events[1].isTracked).toBeUndefined();

      // Verify user tracking query was not made
      expect(mockUsersFindUnique).not.toHaveBeenCalled();
    });

    it('should handle user with no tracked events', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { page: '1', limit: '10' },
      });

      // Mock authenticated user
      mockGetServerSession.mockResolvedValue({ user: mockUser });

      // Mock events service response
      mockGetEvents.mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });

      // Mock user with no tracked events
      mockUsersFindUnique.mockResolvedValue({
        id: 'user1',
        trackedEvents: [],
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());

      // Verify all events are marked as not tracked
      expect(responseData.events).toHaveLength(2);
      expect(responseData.events[0].isTracked).toBe(false);
      expect(responseData.events[1].isTracked).toBe(false);
    });

    it('should handle user not found in database', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { page: '1', limit: '10' },
      });

      // Mock authenticated user
      mockGetServerSession.mockResolvedValue({ user: mockUser });

      // Mock events service response
      mockGetEvents.mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });

      // Mock user not found
      mockUsersFindUnique.mockResolvedValue(null);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());

      // Verify all events are marked as not tracked when user not found
      expect(responseData.events).toHaveLength(2);
      expect(responseData.events[0].isTracked).toBe(false);
      expect(responseData.events[1].isTracked).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { page: '1', limit: '10' },
      });

      // Mock authenticated user
      mockGetServerSession.mockResolvedValue({ user: mockUser });

      // Mock events service response
      mockGetEvents.mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });

      // Mock database error - but use a spy to check it was called
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockUsersFindUnique.mockRejectedValue(new Error('Database error'));

      await handler(req, res);

      // The current implementation will fail the entire request if tracking lookup fails
      // This test documents the current behavior - in production you might want to handle this more gracefully
      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to fetch events',
      });

      consoleSpy.mockRestore();
    });

    it('should handle EventsListService errors', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { page: '1', limit: '10' },
      });

      // Mock authenticated user
      mockGetServerSession.mockResolvedValue({ user: mockUser });

      // Mock events service error
      mockGetEvents.mockRejectedValue(new Error('Service error'));

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const responseData = JSON.parse(res._getData());
      expect(responseData.error).toBe('Failed to fetch events');
    });

    it('should pass through all query parameters to EventsListService', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          page: '2',
          limit: '20',
          day: 'Friday',
          search: 'RPG',
          startTime: '10:00',
          endTime: '18:00',
          ageRatings: '18+',
          eventTypes: 'RPG,TCG',
          maxParticipants: '10',
        },
      });

      // Mock authenticated user
      mockGetServerSession.mockResolvedValue({ user: mockUser });

      // Mock events service response
      mockGetEvents.mockResolvedValue({
        events: [],
        pagination: mockPagination,
      });

      // Mock user with no tracked events
      mockUsersFindUnique.mockResolvedValue({
        id: 'user1',
        trackedEvents: [],
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);

      // Verify all query parameters were passed to EventsListService
      expect(mockGetEvents).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        day: 'Friday',
        search: 'RPG',
        startTime: '10:00',
        endTime: '18:00',
        ageRatings: '18+',
        eventTypes: 'RPG,TCG',
        maxParticipants: '10',
      });
    });
  });

  describe('Method not allowed', () => {
    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        query: {},
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed',
      });
    });
  });
});