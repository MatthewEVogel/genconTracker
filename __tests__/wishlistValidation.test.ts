// import { NextApiRequest, NextApiResponse } from 'next';
// import handler from '../pages/api/user-events';
// import { prisma } from '../lib/prisma';

// // Mock the ticket assignment service to prevent background recalculation during tests
// jest.mock('@/utils/ticketAssignmentService', () => ({
//   recalculateAndSaveTicketAssignments: jest.fn().mockResolvedValue(undefined)
// }));

// // Mock the prisma client
// jest.mock('../lib/prisma', () => ({
//   prisma: {
//     userEvent: {
//       findUnique: jest.fn(),
//       findMany: jest.fn(),
//       create: jest.fn(),
//       count: jest.fn(),
//     },
//     event: {
//       findUnique: jest.fn(),
//     },
//   },
// }));

// const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// // Helper function to create mock request/response
// function createMockReqRes(method: string, body: any = {}) {
//   const req = {
//     method,
//     body,
//   } as NextApiRequest;

//   const res = {
//     status: jest.fn().mockReturnThis(),
//     json: jest.fn().mockReturnThis(),
//   } as unknown as NextApiResponse;

//   return { req, res };
// }

// describe('Wishlist Validation', () => {
//   beforeEach(() => {
//     jest.clearAllMocks();
//   });

//   describe('Time Conflict Detection', () => {
//     test('should detect overlap when new event starts before existing event ends', async () => {
//       const userId = 'user-1';
//       const eventId = 'event-2';

//       // Mock existing user event
//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock the new event
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'event-2',
//         title: 'Overlapping Event',
//         startDateTime: '2024-08-01T12:00:00Z',
//         endDateTime: '2024-08-01T16:00:00Z',
//         duration: '4 hours',
//         cost: '4',
//         ticketsAvailable: 6,
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       // Mock existing user events (with conflict)
//       mockPrisma.userEvent.findMany.mockResolvedValue([
//         {
//           id: 'user-event-1',
//           userId: 'user-1',
//           eventId: 'event-1',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           event: {
//             id: 'event-1',
//             title: 'Existing Event',
//             startDateTime: '2024-08-01T10:00:00Z',
//             endDateTime: '2024-08-01T14:00:00Z',
//             duration: '4 hours',
//             cost: '4',
//             ticketsAvailable: 6,
//             priority: 1,
//             createdAt: new Date(),
//             shortDescription: null,
//             eventType: null,
//             gameSystem: null,
//             ageRequired: null,
//             experienceRequired: null,
//             materialsRequired: null,
//             location: null,
//           }
//         }
//       ]);

//       // Mock capacity check
//       mockPrisma.userEvent.count.mockResolvedValue(2);

//       // Mock successful creation
//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'event-2',
//           title: 'Overlapping Event',
//           startDateTime: '2024-08-01T12:00:00Z',
//           endDateTime: '2024-08-01T16:00:00Z',
//           duration: '4 hours',
//           cost: '4',
//           ticketsAvailable: 6,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: expect.arrayContaining([
//             expect.objectContaining({
//               eventId: 'event-1',
//               title: 'Existing Event',
//               startDateTime: '2024-08-01T10:00:00Z',
//               endDateTime: '2024-08-01T14:00:00Z'
//             })
//           ]),
//           capacityWarning: false
//         })
//       );
//     });

//     test('should not detect conflict for adjacent events', async () => {
//       const userId = 'user-1';
//       const eventId = 'event-2';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock the new event (starts when first ends)
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'event-2',
//         title: 'Second Event',
//         startDateTime: '2024-08-01T14:00:00Z',
//         endDateTime: '2024-08-01T18:00:00Z',
//         duration: '4 hours',
//         cost: '4',
//         ticketsAvailable: 6,
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       // Mock existing user events (adjacent, no conflict)
//       mockPrisma.userEvent.findMany.mockResolvedValue([
//         {
//           id: 'user-event-1',
//           userId: 'user-1',
//           eventId: 'event-1',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           event: {
//             id: 'event-1',
//             title: 'First Event',
//             startDateTime: '2024-08-01T10:00:00Z',
//             endDateTime: '2024-08-01T14:00:00Z', // Ends exactly when second starts
//             duration: '4 hours',
//             cost: '4',
//             ticketsAvailable: 6,
//             priority: 1,
//             createdAt: new Date(),
//             shortDescription: null,
//             eventType: null,
//             gameSystem: null,
//             ageRequired: null,
//             experienceRequired: null,
//             materialsRequired: null,
//             location: null,
//           }
//         }
//       ]);

//       mockPrisma.userEvent.count.mockResolvedValue(1);

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'event-2',
//           title: 'Second Event',
//           startDateTime: '2024-08-01T14:00:00Z',
//           endDateTime: '2024-08-01T18:00:00Z',
//           duration: '4 hours',
//           cost: '4',
//           ticketsAvailable: 6,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       const callArgs = (res.json as jest.Mock).mock.calls[0][0];
//       expect(callArgs.conflicts).toEqual([]);
//       expect(callArgs.capacityWarning).toBe(false);
//     });

//     test('should detect multiple conflicts', async () => {
//       const userId = 'user-1';
//       const eventId = 'event-3';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock the new event that overlaps with both existing events
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'event-3',
//         title: 'Overlapping Event',
//         startDateTime: '2024-08-01T11:00:00Z',
//         endDateTime: '2024-08-01T17:00:00Z',
//         duration: '6 hours',
//         cost: '4',
//         ticketsAvailable: 6,
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       // Mock existing user events (two events that will conflict)
//       mockPrisma.userEvent.findMany.mockResolvedValue([
//         {
//           id: 'user-event-1',
//           userId: 'user-1',
//           eventId: 'event-1',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           event: {
//             id: 'event-1',
//             title: 'First Existing Event',
//             startDateTime: '2024-08-01T09:00:00Z',
//             endDateTime: '2024-08-01T13:00:00Z',
//             duration: '4 hours',
//             cost: '4',
//             ticketsAvailable: 6,
//             priority: 1,
//             createdAt: new Date(),
//             shortDescription: null,
//             eventType: null,
//             gameSystem: null,
//             ageRequired: null,
//             experienceRequired: null,
//             materialsRequired: null,
//             location: null,
//           }
//         },
//         {
//           id: 'user-event-2',
//           userId: 'user-1',
//           eventId: 'event-2',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           event: {
//             id: 'event-2',
//             title: 'Second Existing Event',
//             startDateTime: '2024-08-01T15:00:00Z',
//             endDateTime: '2024-08-01T19:00:00Z',
//             duration: '4 hours',
//             cost: '4',
//             ticketsAvailable: 6,
//             priority: 1,
//             createdAt: new Date(),
//             shortDescription: null,
//             eventType: null,
//             gameSystem: null,
//             ageRequired: null,
//             experienceRequired: null,
//             materialsRequired: null,
//             location: null,
//           }
//         }
//       ]);

//       mockPrisma.userEvent.count.mockResolvedValue(1);

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'event-3',
//           title: 'Overlapping Event',
//           startDateTime: '2024-08-01T11:00:00Z',
//           endDateTime: '2024-08-01T17:00:00Z',
//           duration: '6 hours',
//           cost: '4',
//           ticketsAvailable: 6,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: expect.arrayContaining([
//             expect.objectContaining({ eventId: 'event-1' }),
//             expect.objectContaining({ eventId: 'event-2' })
//           ]),
//           capacityWarning: false
//         })
//       );
//       const callArgs = (res.json as jest.Mock).mock.calls[0][0];
//       expect(callArgs.conflicts).toHaveLength(2);
//     });
//   });

//   describe('Capacity Warning Detection', () => {
//     test('should warn when event is at maximum capacity', async () => {
//       const userId = 'user-4';
//       const eventId = 'capacity-event';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock event with limited capacity
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'capacity-event',
//         title: 'Limited Capacity Event',
//         startDateTime: '2024-08-01T10:00:00Z',
//         endDateTime: '2024-08-01T14:00:00Z',
//         duration: '4 hours',
//         cost: '4',
//         ticketsAvailable: 3, // Only 3 tickets available
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       // Mock no existing user events for this user
//       mockPrisma.userEvent.findMany.mockResolvedValue([]);

//       // Mock that 3 users are already signed up (at capacity)
//       mockPrisma.userEvent.count.mockResolvedValue(3);

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'capacity-event',
//           title: 'Limited Capacity Event',
//           startDateTime: '2024-08-01T10:00:00Z',
//           endDateTime: '2024-08-01T14:00:00Z',
//           duration: '4 hours',
//           cost: '4',
//           ticketsAvailable: 3,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: [],
//           capacityWarning: true
//         })
//       );
//     });

//     test('should not warn when event has available capacity', async () => {
//       const userId = 'user-2';
//       const eventId = 'available-event';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock event with plenty of capacity
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'available-event',
//         title: 'Available Event',
//         startDateTime: '2024-08-01T10:00:00Z',
//         endDateTime: '2024-08-01T14:00:00Z',
//         duration: '4 hours',
//         cost: '4',
//         ticketsAvailable: 5, // 5 tickets available
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       mockPrisma.userEvent.findMany.mockResolvedValue([]);

//       // Mock that only 1 user is signed up (plenty of capacity)
//       mockPrisma.userEvent.count.mockResolvedValue(1);

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'available-event',
//           title: 'Available Event',
//           startDateTime: '2024-08-01T10:00:00Z',
//           endDateTime: '2024-08-01T14:00:00Z',
//           duration: '4 hours',
//           cost: '4',
//           ticketsAvailable: 5,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: [],
//           capacityWarning: false
//         })
//       );
//     });

//     test('should not warn when event has no capacity limit', async () => {
//       const userId = 'user-1';
//       const eventId = 'unlimited-event';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock event with no capacity limit
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'unlimited-event',
//         title: 'Unlimited Event',
//         startDateTime: '2024-08-01T10:00:00Z',
//         endDateTime: '2024-08-01T14:00:00Z',
//         duration: '4 hours',
//         cost: '4',
//         ticketsAvailable: null, // No capacity limit
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       mockPrisma.userEvent.findMany.mockResolvedValue([]);
//       mockPrisma.userEvent.count.mockResolvedValue(10); // Many users signed up

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'unlimited-event',
//           title: 'Unlimited Event',
//           startDateTime: '2024-08-01T10:00:00Z',
//           endDateTime: '2024-08-01T14:00:00Z',
//           duration: '4 hours',
//           cost: '4',
//           ticketsAvailable: null,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: [],
//           capacityWarning: false
//         })
//       );
//     });
//   });

//   describe('Combined Scenarios', () => {
//     test('should detect both time conflict and capacity warning', async () => {
//       const userId = 'user-1';
//       const eventId = 'full-overlapping-event';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock event with limited capacity
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'full-overlapping-event',
//         title: 'Full Overlapping Event',
//         startDateTime: '2024-08-01T12:00:00Z',
//         endDateTime: '2024-08-01T16:00:00Z',
//         duration: '4 hours',
//         cost: '4',
//         ticketsAvailable: 2, // Limited capacity
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       // Mock existing user event that conflicts
//       mockPrisma.userEvent.findMany.mockResolvedValue([
//         {
//           id: 'user-event-1',
//           userId: 'user-1',
//           eventId: 'existing-event',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           event: {
//             id: 'existing-event',
//             title: 'Existing Event',
//             startDateTime: '2024-08-01T10:00:00Z',
//             endDateTime: '2024-08-01T14:00:00Z',
//             duration: '4 hours',
//             cost: '4',
//             ticketsAvailable: 6,
//             priority: 1,
//             createdAt: new Date(),
//             shortDescription: null,
//             eventType: null,
//             gameSystem: null,
//             ageRequired: null,
//             experienceRequired: null,
//             materialsRequired: null,
//             location: null,
//           }
//         }
//       ]);

//       // Mock that event is at capacity
//       mockPrisma.userEvent.count.mockResolvedValue(2);

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'full-overlapping-event',
//           title: 'Full Overlapping Event',
//           startDateTime: '2024-08-01T12:00:00Z',
//           endDateTime: '2024-08-01T16:00:00Z',
//           duration: '4 hours',
//           cost: '4',
//           ticketsAvailable: 2,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: expect.arrayContaining([
//             expect.objectContaining({ eventId: 'existing-event' })
//           ]),
//           capacityWarning: true
//         })
//       );
//     });
//   });

//   describe('Edge Cases', () => {
//     test('should handle events without time information', async () => {
//       const userId = 'user-1';
//       const eventId = 'no-time-event-2';

//       mockPrisma.userEvent.findUnique.mockResolvedValue(null);

//       // Mock event without time information
//       mockPrisma.event.findUnique.mockResolvedValue({
//         id: 'no-time-event-2',
//         title: 'Event Without Time 2',
//         startDateTime: null,
//         endDateTime: null,
//         duration: null,
//         cost: '4',
//         ticketsAvailable: 6,
//         priority: 1,
//         createdAt: new Date(),
//         shortDescription: null,
//         eventType: null,
//         gameSystem: null,
//         ageRequired: null,
//         experienceRequired: null,
//         materialsRequired: null,
//         location: null,
//       });

//       // Mock existing user event also without time
//       mockPrisma.userEvent.findMany.mockResolvedValue([
//         {
//           id: 'user-event-1',
//           userId: 'user-1',
//           eventId: 'no-time-event-1',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           event: {
//             id: 'no-time-event-1',
//             title: 'Event Without Time 1',
//             startDateTime: null,
//             endDateTime: null,
//             duration: null,
//             cost: '4',
//             ticketsAvailable: 6,
//             priority: 1,
//             createdAt: new Date(),
//             shortDescription: null,
//             eventType: null,
//             gameSystem: null,
//             ageRequired: null,
//             experienceRequired: null,
//             materialsRequired: null,
//             location: null,
//           }
//         }
//       ]);

//       mockPrisma.userEvent.count.mockResolvedValue(1);

//       mockPrisma.userEvent.create.mockResolvedValue({
//         id: 'new-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//         event: {
//           id: 'no-time-event-2',
//           title: 'Event Without Time 2',
//           startDateTime: null,
//           endDateTime: null,
//           duration: null,
//           cost: '4',
//           ticketsAvailable: 6,
//           priority: 1,
//           createdAt: new Date(),
//           shortDescription: null,
//           eventType: null,
//           gameSystem: null,
//           ageRequired: null,
//           experienceRequired: null,
//           materialsRequired: null,
//           location: null,
//         }
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           conflicts: [], // No conflicts when no time info
//           capacityWarning: false
//         })
//       );
//     });

//     test('should prevent duplicate registrations', async () => {
//       const userId = 'user-1';
//       const eventId = 'duplicate-event';

//       // Mock that user is already registered for this event
//       mockPrisma.userEvent.findUnique.mockResolvedValue({
//         id: 'existing-user-event',
//         userId,
//         eventId,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       });

//       const { req, res } = createMockReqRes('POST', { userId, eventId });

//       await handler(req, res);

//       expect(res.status).toHaveBeenCalledWith(400);
//       expect(res.json).toHaveBeenCalledWith({
//         error: 'User is already registered for this event'
//       });
//     });
//   });
// });
