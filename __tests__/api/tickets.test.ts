import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/tickets/[userId]';

// Mock the prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userList: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    purchasedEvents: {
      findMany: jest.fn(),
    },
    desiredEvents: {
      findMany: jest.fn(),
    },
  },
}));

// Mock the ticket algorithm
jest.mock('@/utils/ticketAlgorithm', () => ({
  calculateTicketAssignments: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { calculateTicketAssignments } from '@/utils/ticketAlgorithm';

describe('/api/tickets/[userId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUsers = [
    {
      id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      genConName: 'John Doe',
    },
    {
      id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      genConName: 'Jane Smith',
    },
  ];

  const mockDesiredEvents = [
    {
      user: { id: 'user1', firstName: 'John', lastName: 'Doe' },
      eventsList: { id: 'event1', title: 'Event 1', cost: '10.00', priority: 1 },
    },
    {
      user: { id: 'user1', firstName: 'John', lastName: 'Doe' },
      eventsList: { id: 'event2', title: 'Event 2', cost: '15.00', priority: 2 },
    },
    {
      user: { id: 'user2', firstName: 'Jane', lastName: 'Smith' },
      eventsList: { id: 'event1', title: 'Event 1', cost: '10.00', priority: 1 },
    },
  ];

  const mockPurchasedEvents = [
    {
      id: 'purchase1',
      eventId: 'event1',
      recipient: 'John Doe',
      purchaser: 'John Doe',
      refundedEvents: [], // Not refunded
    },
  ];

  const mockAssignments = [
    {
      userId: 'user1',
      userName: 'John Doe',
      events: [
        {
          eventId: 'event2',
          eventTitle: 'Event 2',
          priority: 2,
          buyingFor: ['John Doe'],
          cost: '15.00',
        },
      ],
      totalTickets: 1,
    },
  ];

  it('should exclude already purchased events from recommendations', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { userId: 'user1' },
    });

    // Mock database responses
    (prisma.userList.findUnique as jest.Mock).mockResolvedValue(mockUsers[0]);
    (prisma.userList.findMany as jest.Mock).mockResolvedValue(mockUsers);
    (prisma.purchasedEvents.findMany as jest.Mock).mockResolvedValue(mockPurchasedEvents);
    (prisma.desiredEvents.findMany as jest.Mock).mockResolvedValue(mockDesiredEvents);
    
    // Mock algorithm response
    (calculateTicketAssignments as jest.Mock).mockReturnValue({
      assignments: mockAssignments,
      errors: [],
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res._getData());
    
    // Verify that the algorithm was called with filtered events (excluding purchased ones)
    const algorithmCall = (calculateTicketAssignments as jest.Mock).mock.calls[0];
    const filteredEvents = algorithmCall[0];
    
    // Should not include event1 for user1 since it's already purchased
    const user1Events = filteredEvents.filter((e: any) => e.userId === 'user1');
    expect(user1Events).toHaveLength(1); // Only event2, not event1
    expect(user1Events[0].eventId).toBe('event2');
    
    // Should include event1 for user2 since they haven't purchased it
    const user2Events = filteredEvents.filter((e: any) => e.userId === 'user2');
    expect(user2Events).toHaveLength(1);
    expect(user2Events[0].eventId).toBe('event1');
    
    // Verify response includes purchased events info
    expect(responseData.purchasedEvents).toEqual([
      { eventId: 'event1', recipient: 'John Doe' },
    ]);
    expect(responseData.excludedEventsCount).toBe(1);
  });

  it('should handle case-insensitive name matching for purchased events', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { userId: 'user1' },
    });

    const purchasedWithDifferentCase = [
      {
        id: 'purchase1',
        eventId: 'event1',
        recipient: 'JOHN DOE', // Different case
        purchaser: 'John Doe',
        refundedEvents: [],
      },
    ];

    (prisma.userList.findUnique as jest.Mock).mockResolvedValue(mockUsers[0]);
    (prisma.userList.findMany as jest.Mock).mockResolvedValue(mockUsers);
    (prisma.purchasedEvents.findMany as jest.Mock).mockResolvedValue(purchasedWithDifferentCase);
    (prisma.desiredEvents.findMany as jest.Mock).mockResolvedValue(mockDesiredEvents);
    (calculateTicketAssignments as jest.Mock).mockReturnValue({
      assignments: mockAssignments,
      errors: [],
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    
    // Verify that case-insensitive matching worked
    const algorithmCall = (calculateTicketAssignments as jest.Mock).mock.calls[0];
    const filteredEvents = algorithmCall[0];
    const user1Events = filteredEvents.filter((e: any) => e.userId === 'user1');
    
    // Should exclude event1 even with different case
    expect(user1Events).toHaveLength(1);
    expect(user1Events[0].eventId).toBe('event2');
  });

  it('should include refunded events in recommendations', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { userId: 'user1' },
    });

    const refundedPurchasedEvents = [
      {
        id: 'purchase1',
        eventId: 'event1',
        recipient: 'John Doe',
        purchaser: 'John Doe',
        refundedEvents: [{ id: 'refund1' }], // This is refunded
      },
    ];

    (prisma.userList.findUnique as jest.Mock).mockResolvedValue(mockUsers[0]);
    (prisma.userList.findMany as jest.Mock).mockResolvedValue(mockUsers);
    (prisma.purchasedEvents.findMany as jest.Mock).mockResolvedValue(refundedPurchasedEvents);
    (prisma.desiredEvents.findMany as jest.Mock).mockResolvedValue(mockDesiredEvents);
    (calculateTicketAssignments as jest.Mock).mockReturnValue({
      assignments: [
        {
          userId: 'user1',
          userName: 'John Doe',
          events: [
            { eventId: 'event1', eventTitle: 'Event 1', priority: 1, buyingFor: ['John Doe'], cost: '10.00' },
            { eventId: 'event2', eventTitle: 'Event 2', priority: 2, buyingFor: ['John Doe'], cost: '15.00' },
          ],
          totalTickets: 2,
        },
      ],
      errors: [],
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    
    // Verify that refunded events are included in recommendations
    const algorithmCall = (calculateTicketAssignments as jest.Mock).mock.calls[0];
    const filteredEvents = algorithmCall[0];
    const user1Events = filteredEvents.filter((e: any) => e.userId === 'user1');
    
    // Should include both events since event1 was refunded
    expect(user1Events).toHaveLength(2);
    expect(user1Events.map((e: any) => e.eventId)).toEqual(['event1', 'event2']);
  });

  it('should handle users without genConName', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { userId: 'user1' },
    });

    const usersWithoutGenConName = [
      {
        id: 'user1',
        firstName: 'John',
        lastName: 'Doe',
        genConName: null, // No genConName
      },
    ];

    (prisma.userList.findUnique as jest.Mock).mockResolvedValue(usersWithoutGenConName[0]);
    (prisma.userList.findMany as jest.Mock).mockResolvedValue(usersWithoutGenConName);
    (prisma.purchasedEvents.findMany as jest.Mock).mockResolvedValue(mockPurchasedEvents);
    (prisma.desiredEvents.findMany as jest.Mock).mockResolvedValue(mockDesiredEvents.slice(0, 2)); // Only user1 events
    (calculateTicketAssignments as jest.Mock).mockReturnValue({
      assignments: [
        {
          userId: 'user1',
          userName: 'John Doe',
          events: [
            { eventId: 'event1', eventTitle: 'Event 1', priority: 1, buyingFor: ['John Doe'], cost: '10.00' },
            { eventId: 'event2', eventTitle: 'Event 2', priority: 2, buyingFor: ['John Doe'], cost: '15.00' },
          ],
          totalTickets: 2,
        },
      ],
      errors: [],
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    
    // Should not exclude any events since genConName matching fails
    const algorithmCall = (calculateTicketAssignments as jest.Mock).mock.calls[0];
    const filteredEvents = algorithmCall[0];
    
    expect(filteredEvents).toHaveLength(2); // Both events should be included
  });

  it('should return 404 for non-existent user', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { userId: 'nonexistent' },
    });

    (prisma.userList.findUnique as jest.Mock).mockResolvedValue(null);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'User not found',
    });
  });

  it('should return 405 for non-GET methods', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user1' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed',
    });
  });

  it('should handle empty purchased events', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { userId: 'user1' },
    });

    (prisma.userList.findUnique as jest.Mock).mockResolvedValue(mockUsers[0]);
    (prisma.userList.findMany as jest.Mock).mockResolvedValue(mockUsers);
    (prisma.purchasedEvents.findMany as jest.Mock).mockResolvedValue([]); // No purchased events
    (prisma.desiredEvents.findMany as jest.Mock).mockResolvedValue(mockDesiredEvents);
    (calculateTicketAssignments as jest.Mock).mockReturnValue({
      assignments: [
        {
          userId: 'user1',
          userName: 'John Doe',
          events: [
            { eventId: 'event1', eventTitle: 'Event 1', priority: 1, buyingFor: ['John Doe'], cost: '10.00' },
            { eventId: 'event2', eventTitle: 'Event 2', priority: 2, buyingFor: ['John Doe'], cost: '15.00' },
          ],
          totalTickets: 2,
        },
      ],
      errors: [],
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res._getData());
    
    // Should include all events since nothing is purchased
    expect(responseData.purchasedEvents).toEqual([]);
    expect(responseData.excludedEventsCount).toBe(0);
    
    const algorithmCall = (calculateTicketAssignments as jest.Mock).mock.calls[0];
    const filteredEvents = algorithmCall[0];
    const user1Events = filteredEvents.filter((e: any) => e.userId === 'user1');
    
    expect(user1Events).toHaveLength(2); // Both events should be included
  });
});