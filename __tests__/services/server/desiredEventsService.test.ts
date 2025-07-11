// Mock the prisma import first
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  prisma: {
    desiredEvents: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    eventsList: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { DesiredEventsService } from '../../../lib/services/server/desiredEventsService';
import { prisma } from '../../../lib/prisma';

// Get the mocked prisma instance
const mockPrisma = prisma as any;

describe('DesiredEventsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };

  const mockEvent = {
    id: 'event-123',
    title: 'Test Event',
    shortDescription: 'A test event',
    eventType: 'RPG',
    gameSystem: 'D&D 5E',
    startDateTime: '2025-08-01T10:00:00Z',
    endDateTime: '2025-08-01T14:00:00Z',
    ageRequired: '13+',
    experienceRequired: 'None',
    materialsRequired: 'None',
    cost: '4',
    location: 'Room 101',
    ticketsAvailable: 6,
    priority: 1,
    isCanceled: false,
  };

  const mockConflictingEvent = {
    id: 'event-456',
    title: 'Conflicting Event',
    shortDescription: 'An overlapping event',
    eventType: 'RPG',
    gameSystem: 'Pathfinder',
    startDateTime: '2025-08-01T12:00:00Z',
    endDateTime: '2025-08-01T16:00:00Z',
    ageRequired: '13+',
    experienceRequired: 'None',
    materialsRequired: 'None',
    cost: '4',
    location: 'Room 102',
    ticketsAvailable: 4,
    priority: 1,
    isCanceled: false,
  };

  describe('addDesiredEvent', () => {
    it('should successfully add a desired event with no conflicts', async () => {
      const mockDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent,
      };

      // Mock that event doesn't already exist
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      
      // Mock event exists in EventsList
      mockPrisma.eventsList.findUnique.mockResolvedValue(mockEvent);
      
      // Mock no existing desired events (no conflicts)
      mockPrisma.desiredEvents.findMany.mockResolvedValue([]);
      
      // Mock capacity check - not at capacity
      mockPrisma.desiredEvents.count.mockResolvedValue(2);
      
      // Mock successful creation
      mockPrisma.desiredEvents.create.mockResolvedValue(mockDesiredEvent);

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, mockEvent.id);

      expect(result.desiredEvent).toEqual(mockDesiredEvent);
      expect(result.conflicts).toEqual([]);
      expect(result.capacityWarning).toBe(false);
      
      expect(mockPrisma.desiredEvents.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          eventsListId: mockEvent.id,
        },
        include: {
          eventsList: {
            select: {
              id: true,
              title: true,
              startDateTime: true,
              endDateTime: true,
              eventType: true,
              location: true,
              cost: true,
              ticketsAvailable: true,
              priority: true,
              isCanceled: true,
            },
          },
        },
      });
    });

    it('should detect time conflicts when adding an event', async () => {
      const existingDesiredEvent = {
        id: 'desired-456',
        userId: mockUser.id,
        eventsListId: mockConflictingEvent.id,
        eventsList: mockConflictingEvent,
      };

      const mockDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent,
      };

      // Mock that event doesn't already exist
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      
      // Mock event exists in EventsList
      mockPrisma.eventsList.findUnique.mockResolvedValue(mockEvent);
      
      // Mock existing desired events with conflicting times
      mockPrisma.desiredEvents.findMany.mockResolvedValue([existingDesiredEvent]);
      
      // Mock capacity check
      mockPrisma.desiredEvents.count.mockResolvedValue(2);
      
      // Mock successful creation
      mockPrisma.desiredEvents.create.mockResolvedValue(mockDesiredEvent);

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, mockEvent.id);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        eventsListId: mockConflictingEvent.id,
        title: mockConflictingEvent.title,
        startDateTime: mockConflictingEvent.startDateTime,
        endDateTime: mockConflictingEvent.endDateTime,
      });
    });

    it('should detect capacity warning when event is at capacity', async () => {
      const mockDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent,
      };

      // Mock that event doesn't already exist
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      
      // Mock event exists in EventsList
      mockPrisma.eventsList.findUnique.mockResolvedValue(mockEvent);
      
      // Mock no conflicts
      mockPrisma.desiredEvents.findMany.mockResolvedValue([]);
      
      // Mock capacity check - at capacity (6 signups for 6 tickets)
      mockPrisma.desiredEvents.count.mockResolvedValue(6);
      
      // Mock successful creation
      mockPrisma.desiredEvents.create.mockResolvedValue(mockDesiredEvent);

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, mockEvent.id);

      expect(result.capacityWarning).toBe(true);
    });

    it('should throw error if user is already registered for the event', async () => {
      const existingDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
      };

      // Mock that event already exists
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(existingDesiredEvent);

      await expect(
        DesiredEventsService.addDesiredEvent(mockUser.id, mockEvent.id)
      ).rejects.toThrow('User is already registered for this event');
    });

    it('should throw error if event does not exist', async () => {
      // Mock that event doesn't already exist
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      
      // Mock event doesn't exist in EventsList
      mockPrisma.eventsList.findUnique.mockResolvedValue(null);

      await expect(
        DesiredEventsService.addDesiredEvent(mockUser.id, 'non-existent-event')
      ).rejects.toThrow('Event not found');
    });

    it('should handle events without time information (no conflicts possible)', async () => {
      const eventWithoutTime = {
        ...mockEvent,
        startDateTime: null,
        endDateTime: null,
      };

      const mockDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: eventWithoutTime.id,
        eventsList: eventWithoutTime,
      };

      // Mock that event doesn't already exist
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      
      // Mock event exists in EventsList
      mockPrisma.eventsList.findUnique.mockResolvedValue(eventWithoutTime);
      
      // Mock no existing desired events
      mockPrisma.desiredEvents.findMany.mockResolvedValue([]);
      
      // Mock capacity check
      mockPrisma.desiredEvents.count.mockResolvedValue(2);
      
      // Mock successful creation
      mockPrisma.desiredEvents.create.mockResolvedValue(mockDesiredEvent);

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, eventWithoutTime.id);

      expect(result.conflicts).toEqual([]);
      expect(result.capacityWarning).toBe(false);
    });
  });

  describe('removeDesiredEvent', () => {
    it('should successfully remove a desired event', async () => {
      const existingDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
      };

      // Mock that event exists
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(existingDesiredEvent);
      
      // Mock successful deletion
      mockPrisma.desiredEvents.delete.mockResolvedValue(existingDesiredEvent);

      await DesiredEventsService.removeDesiredEvent(mockUser.id, mockEvent.id);

      expect(mockPrisma.desiredEvents.delete).toHaveBeenCalledWith({
        where: {
          userId_eventsListId: {
            userId: mockUser.id,
            eventsListId: mockEvent.id,
          },
        },
      });
    });

    it('should throw error if desired event does not exist', async () => {
      // Mock that event doesn't exist
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);

      await expect(
        DesiredEventsService.removeDesiredEvent(mockUser.id, mockEvent.id)
      ).rejects.toThrow('User event not found');

      expect(mockPrisma.desiredEvents.delete).not.toHaveBeenCalled();
    });
  });

  describe('getUserDesiredEvents', () => {
    it('should return all desired events for a user', async () => {
      const mockDesiredEvents = [
        {
          id: 'desired-123',
          userId: mockUser.id,
          eventsListId: mockEvent.id,
          eventsList: mockEvent,
        },
      ];

      mockPrisma.desiredEvents.findMany.mockResolvedValue(mockDesiredEvents);

      const result = await DesiredEventsService.getUserDesiredEvents(mockUser.id);

      expect(result).toEqual(mockDesiredEvents);
      expect(mockPrisma.desiredEvents.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        include: {
          eventsList: {
            select: {
              id: true,
              title: true,
              startDateTime: true,
              endDateTime: true,
              eventType: true,
              location: true,
              cost: true,
              ticketsAvailable: true,
              priority: true,
              isCanceled: true,
            },
          },
        },
      });
    });

    it('should filter by canceled status when includeCanceled is true', async () => {
      const canceledEvent = { ...mockEvent, isCanceled: true };
      const mockDesiredEvents = [
        {
          id: 'desired-123',
          userId: mockUser.id,
          eventsListId: canceledEvent.id,
          eventsList: canceledEvent,
        },
      ];

      mockPrisma.desiredEvents.findMany.mockResolvedValue(mockDesiredEvents);

      const result = await DesiredEventsService.getUserDesiredEvents(mockUser.id, true);

      expect(mockPrisma.desiredEvents.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          eventsList: { isCanceled: true },
        },
        include: {
          eventsList: {
            select: {
              id: true,
              title: true,
              startDateTime: true,
              endDateTime: true,
              eventType: true,
              location: true,
              cost: true,
              ticketsAvailable: true,
              priority: true,
              isCanceled: true,
            },
          },
        },
      });
    });

    it('should filter by non-canceled status when includeCanceled is false', async () => {
      const mockDesiredEvents = [
        {
          id: 'desired-123',
          userId: mockUser.id,
          eventsListId: mockEvent.id,
          eventsList: mockEvent,
        },
      ];

      mockPrisma.desiredEvents.findMany.mockResolvedValue(mockDesiredEvents);

      const result = await DesiredEventsService.getUserDesiredEvents(mockUser.id, false);

      expect(mockPrisma.desiredEvents.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          eventsList: { isCanceled: false },
        },
        include: {
          eventsList: {
            select: {
              id: true,
              title: true,
              startDateTime: true,
              endDateTime: true,
              eventType: true,
              location: true,
              cost: true,
              ticketsAvailable: true,
              priority: true,
              isCanceled: true,
            },
          },
        },
      });
    });
  });

  describe('userHasDesiredEvent', () => {
    it('should return true if user has the desired event', async () => {
      const existingDesiredEvent = {
        id: 'desired-123',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
      };

      mockPrisma.desiredEvents.findUnique.mockResolvedValue(existingDesiredEvent);

      const result = await DesiredEventsService.userHasDesiredEvent(mockUser.id, mockEvent.id);

      expect(result).toBe(true);
    });

    it('should return false if user does not have the desired event', async () => {
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);

      const result = await DesiredEventsService.userHasDesiredEvent(mockUser.id, mockEvent.id);

      expect(result).toBe(false);
    });
  });

  describe('getEventDesiredCount', () => {
    it('should return the count of users who want a specific event', async () => {
      mockPrisma.desiredEvents.count.mockResolvedValue(5);

      const result = await DesiredEventsService.getEventDesiredCount(mockEvent.id);

      expect(result).toBe(5);
      expect(mockPrisma.desiredEvents.count).toHaveBeenCalledWith({
        where: { eventsListId: mockEvent.id },
      });
    });
  });

  describe('getUserCanceledEvents', () => {
    it('should return canceled events for a user', async () => {
      const canceledEvent = { ...mockEvent, isCanceled: true };
      const mockDesiredEvents = [
        {
          id: 'desired-123',
          userId: mockUser.id,
          eventsListId: canceledEvent.id,
          eventsList: canceledEvent,
        },
      ];

      mockPrisma.desiredEvents.findMany.mockResolvedValue(mockDesiredEvents);

      const result = await DesiredEventsService.getUserCanceledEvents(mockUser.id);

      expect(result).toEqual([
        {
          id: canceledEvent.id,
          title: canceledEvent.title,
          startDateTime: canceledEvent.startDateTime,
          isCanceled: canceledEvent.isCanceled,
        },
      ]);
    });
  });

  describe('Time Conflict Detection', () => {
    it('should detect exact time overlap', async () => {
      const sameTimeEvent = {
        ...mockEvent,
        id: 'event-same-time',
        startDateTime: '2025-08-01T10:00:00Z',
        endDateTime: '2025-08-01T14:00:00Z',
      };

      const existingDesiredEvent = {
        id: 'desired-existing',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent,
      };

      // Mock setup for conflict detection
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      mockPrisma.eventsList.findUnique.mockResolvedValue(sameTimeEvent);
      mockPrisma.desiredEvents.findMany.mockResolvedValue([existingDesiredEvent]);
      mockPrisma.desiredEvents.count.mockResolvedValue(2);
      mockPrisma.desiredEvents.create.mockResolvedValue({
        id: 'new-desired',
        userId: mockUser.id,
        eventsListId: sameTimeEvent.id,
        eventsList: sameTimeEvent,
      });

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, sameTimeEvent.id);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].eventsListId).toBe(mockEvent.id);
    });

    it('should detect partial time overlap (new event starts during existing event)', async () => {
      const overlappingEvent = {
        ...mockEvent,
        id: 'event-overlap',
        startDateTime: '2025-08-01T12:00:00Z', // Starts 2 hours into existing event
        endDateTime: '2025-08-01T16:00:00Z',   // Ends 2 hours after existing event
      };

      const existingDesiredEvent = {
        id: 'desired-existing',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent, // 10:00-14:00
      };

      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      mockPrisma.eventsList.findUnique.mockResolvedValue(overlappingEvent);
      mockPrisma.desiredEvents.findMany.mockResolvedValue([existingDesiredEvent]);
      mockPrisma.desiredEvents.count.mockResolvedValue(2);
      mockPrisma.desiredEvents.create.mockResolvedValue({
        id: 'new-desired',
        userId: mockUser.id,
        eventsListId: overlappingEvent.id,
        eventsList: overlappingEvent,
      });

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, overlappingEvent.id);

      expect(result.conflicts).toHaveLength(1);
    });

    it('should not detect conflict for adjacent events', async () => {
      const adjacentEvent = {
        ...mockEvent,
        id: 'event-adjacent',
        startDateTime: '2025-08-01T14:00:00Z', // Starts exactly when existing event ends
        endDateTime: '2025-08-01T18:00:00Z',
      };

      const existingDesiredEvent = {
        id: 'desired-existing',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent, // 10:00-14:00
      };

      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      mockPrisma.eventsList.findUnique.mockResolvedValue(adjacentEvent);
      mockPrisma.desiredEvents.findMany.mockResolvedValue([existingDesiredEvent]);
      mockPrisma.desiredEvents.count.mockResolvedValue(2);
      mockPrisma.desiredEvents.create.mockResolvedValue({
        id: 'new-desired',
        userId: mockUser.id,
        eventsListId: adjacentEvent.id,
        eventsList: adjacentEvent,
      });

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, adjacentEvent.id);

      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Capacity Detection', () => {
    it('should not show capacity warning when event has no ticket limit', async () => {
      const unlimitedEvent = {
        ...mockEvent,
        ticketsAvailable: null,
      };

      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      mockPrisma.eventsList.findUnique.mockResolvedValue(unlimitedEvent);
      mockPrisma.desiredEvents.findMany.mockResolvedValue([]);
      mockPrisma.desiredEvents.count.mockResolvedValue(100); // Many signups
      mockPrisma.desiredEvents.create.mockResolvedValue({
        id: 'new-desired',
        userId: mockUser.id,
        eventsListId: unlimitedEvent.id,
        eventsList: unlimitedEvent,
      });

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, unlimitedEvent.id);

      expect(result.capacityWarning).toBe(false);
    });

    it('should show capacity warning when signups exceed available tickets', async () => {
      mockPrisma.desiredEvents.findUnique.mockResolvedValue(null);
      mockPrisma.eventsList.findUnique.mockResolvedValue(mockEvent); // 6 tickets available
      mockPrisma.desiredEvents.findMany.mockResolvedValue([]);
      mockPrisma.desiredEvents.count.mockResolvedValue(7); // 7 signups for 6 tickets
      mockPrisma.desiredEvents.create.mockResolvedValue({
        id: 'new-desired',
        userId: mockUser.id,
        eventsListId: mockEvent.id,
        eventsList: mockEvent,
      });

      const result = await DesiredEventsService.addDesiredEvent(mockUser.id, mockEvent.id);

      expect(result.capacityWarning).toBe(true);
    });
  });
});
