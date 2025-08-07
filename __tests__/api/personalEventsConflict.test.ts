import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/personal-events/check-conflicts';

// Mock the prisma module
jest.mock('../../lib/prisma', () => ({
  prisma: {
    personalEvent: {
      findMany: jest.fn(),
    },
    purchasedEvents: {
      findMany: jest.fn(),
    },
    desiredEvents: {
      findMany: jest.fn(),
    },
    eventsList: {
      findMany: jest.fn(),
    },
    userList: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock NextAuth
jest.mock('next-auth/next', () => ({
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
    ],
  },
}));

import { prisma } from '../../lib/prisma';
import { getServerSession } from 'next-auth/next';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPersonalEventFindMany = prisma.personalEvent.findMany as jest.MockedFunction<typeof prisma.personalEvent.findMany>;
const mockPurchasedEventsFindMany = prisma.purchasedEvents.findMany as jest.MockedFunction<typeof prisma.purchasedEvents.findMany>;
const mockDesiredEventsFindMany = prisma.desiredEvents.findMany as jest.MockedFunction<typeof prisma.desiredEvents.findMany>;
const mockEventsListFindMany = prisma.eventsList.findMany as jest.MockedFunction<typeof prisma.eventsList.findMany>;
const mockUserListFindUnique = prisma.userList.findUnique as jest.MockedFunction<typeof prisma.userList.findUnique>;

describe('/api/personal-events/check-conflicts', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock authenticated session
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user123', email: 'test@example.com' },
    } as any);
  });

  it('should detect conflicts with manually created personal events', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z',
        attendees: ['user123'],
      },
    });

    // Mock existing personal event that conflicts
    mockPersonalEventFindMany.mockResolvedValue([
      {
        id: 'personal1',
        title: 'Existing Personal Event',
        startTime: new Date('2024-08-15T11:00:00.000Z'),
        endTime: new Date('2024-08-15T13:00:00.000Z'),
        createdBy: 'user123',
        attendees: [],
        location: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: {
          firstName: 'Test',
          lastName: 'User',
          genConName: 'Test User',
        },
      },
    ] as any);

    // Mock no purchased/desired events
    mockPurchasedEventsFindMany.mockResolvedValue([]);
    mockDesiredEventsFindMany.mockResolvedValue([]);
    mockEventsListFindMany.mockResolvedValue([]);
    mockUserListFindUnique.mockResolvedValue({
      firstName: 'Test',
      lastName: 'User',
      genConName: 'Test User',
    } as any);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.conflicts).toHaveLength(1);
    expect(responseData.conflicts[0]).toEqual({
      userId: 'user123',
      userName: 'Test User',
      personalEventConflicts: [
        {
          id: 'personal1',
          title: 'Existing Personal Event',
          startTime: '2024-08-15T11:00:00.000Z',
          endTime: '2024-08-15T13:00:00.000Z',
        },
      ],
      genconConflicts: [],
    });
  });

  it('should detect conflicts with events from event browser (desired events)', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z',
        attendees: ['user123'],
      },
    });

    // Mock no personal events
    mockPersonalEventFindMany.mockResolvedValue([]);

    // Mock no purchased events
    mockPurchasedEventsFindMany.mockResolvedValue([]);

    // Mock desired event that conflicts
    mockDesiredEventsFindMany.mockResolvedValue([
      {
        id: 'desired1',
        userId: 'user123',
        eventsListId: 'event123',
        eventsList: {
          id: 'event123',
          title: 'Gen Con Event',
          shortDescription: 'A great event',
          eventType: 'RPG',
          gameSystem: 'D&D',
          startDateTime: '2024-08-15T11:30:00.000Z',
          endDateTime: '2024-08-15T14:00:00.000Z',
          ageRequired: '18+',
          experienceRequired: 'None',
          materialsRequired: 'None',
          cost: '10',
          location: 'Convention Center',
          ticketsAvailable: 6,
          priority: 1,
          isCanceled: false,
        },
      },
    ] as any);

    // Mock the corresponding event details
    mockEventsListFindMany.mockResolvedValue([
      {
        id: 'event123',
        title: 'Gen Con Event',
        shortDescription: 'A great event',
        eventType: 'RPG',
        gameSystem: 'D&D',
        startDateTime: '2024-08-15T11:30:00.000Z',
        endDateTime: '2024-08-15T14:00:00.000Z',
        ageRequired: '18+',
        experienceRequired: 'None',
        materialsRequired: 'None',
        cost: '10',
        location: 'Convention Center',
        ticketsAvailable: 6,
        priority: 1,
        isCanceled: false,
      },
    ] as any);

    mockUserListFindUnique.mockResolvedValue({
      firstName: 'Test',
      lastName: 'User',
      genConName: 'Test User',
    } as any);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.conflicts).toHaveLength(1);
    expect(responseData.conflicts[0]).toEqual({
      userId: 'user123',
      userName: 'Test User',
      personalEventConflicts: [],
      genconConflicts: [
        {
          id: 'event123',
          title: 'Gen Con Event',
          startDateTime: '2024-08-15T11:30:00.000Z',
          endDateTime: '2024-08-15T14:00:00.000Z',
        },
      ],
    });
  });

  it('should return no conflicts when there are no overlapping events', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z',
        attendees: ['user123'],
      },
    });

    // Mock no personal events that conflict
    mockPersonalEventFindMany.mockResolvedValue([]);

    // Mock desired event that doesn't conflict
    mockPurchasedEventsFindMany.mockResolvedValue([]);
    mockDesiredEventsFindMany.mockResolvedValue([
      {
        id: 'desired1',
        userId: 'user123',
        eventsListId: 'event789',
        eventsList: {
          id: 'event789',
          title: 'Non-conflicting Gen Con Event',
          shortDescription: 'Early event',
          eventType: 'RPG',
          gameSystem: 'D&D',
          startDateTime: '2024-08-15T08:00:00.000Z',
          endDateTime: '2024-08-15T09:00:00.000Z',
          ageRequired: '18+',
          experienceRequired: 'None',
          materialsRequired: 'None',
          cost: '5',
          location: 'Hall A',
          ticketsAvailable: 8,
          priority: 1,
          isCanceled: false,
        },
      },
    ] as any);

    // Mock the corresponding event details
    mockEventsListFindMany.mockResolvedValue([
      {
        id: 'event789',
        title: 'Non-conflicting Gen Con Event',
        shortDescription: 'Early event',
        eventType: 'RPG',
        gameSystem: 'D&D',
        startDateTime: '2024-08-15T08:00:00.000Z',
        endDateTime: '2024-08-15T09:00:00.000Z',
        ageRequired: '18+',
        experienceRequired: 'None',
        materialsRequired: 'None',
        cost: '5',
        location: 'Hall A',
        ticketsAvailable: 8,
        priority: 1,
        isCanceled: false,
      },
    ] as any);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      conflicts: [],
    });
  });

  it('should require authentication', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        startTime: '2024-08-15T10:00:00.000Z',
        endTime: '2024-08-15T12:00:00.000Z',
        attendees: ['user123'],
      },
    });

    mockGetServerSession.mockResolvedValue(null);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Unauthorized' });
  });

  it('should only accept POST requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
  });

  it('should validate required fields', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        startTime: '2024-08-15T10:00:00.000Z',
        // Missing endTime and attendees
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ 
      error: 'Start time, end time, and attendees are required' 
    });
  });
});
