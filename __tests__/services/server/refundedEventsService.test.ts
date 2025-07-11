/**
 * Tests for RefundedEventsService with new userName-based schema
 */

import { RefundedEventsService } from '@/lib/services/server/refundedEventsService';
import { testDatabase } from '../../utils/testDatabase';

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    refundedEvents: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    purchasedEvents: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('RefundedEventsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRefundedEvent = {
    id: 'refund-id-123',
    userName: 'Hannah Episcopia',
    ticketId: 'ticket-id-123',
    ticket: {
      id: 'ticket-id-123',
      eventId: 'RPG25ND286543',
      recipient: 'Hannah Episcopia',
      purchaser: 'test@example.com'
    }
  };

  const mockPurchasedEvent = {
    id: 'ticket-id-123',
    eventId: 'RPG25ND286543',
    recipient: 'Hannah Episcopia',
    purchaser: 'test@example.com'
  };

  describe('getAllRefundedEvents', () => {
    it('should return all refunded events without details', async () => {
      const mockEvents = [
        { id: 'refund-1', userName: 'User1', ticketId: 'ticket-1' },
        { id: 'refund-2', userName: 'User2', ticketId: 'ticket-2' }
      ];

      mockPrisma.refundedEvents.findMany.mockResolvedValue(mockEvents);

      const result = await RefundedEventsService.getAllRefundedEvents();

      expect(result.refundedEvents).toEqual(mockEvents);
      expect(mockPrisma.refundedEvents.findMany).toHaveBeenCalledWith({
        include: undefined,
        orderBy: { userName: 'asc' }
      });
    });

    it('should return all refunded events with details when requested', async () => {
      const mockEventsWithDetails = [mockRefundedEvent];

      mockPrisma.refundedEvents.findMany.mockResolvedValue(mockEventsWithDetails);

      const result = await RefundedEventsService.getAllRefundedEvents(true);

      expect(result.refundedEvents).toEqual(mockEventsWithDetails);
      expect(mockPrisma.refundedEvents.findMany).toHaveBeenCalledWith({
        include: {
          ticket: {
            select: {
              id: true,
              eventId: true,
              recipient: true,
              purchaser: true
            }
          }
        },
        orderBy: { userName: 'asc' }
      });
    });
  });

  describe('getRefundedEventsByUserName', () => {
    it('should return refunded events for a specific user', async () => {
      const userName = 'Hannah Episcopia';
      const mockEvents = [mockRefundedEvent];

      mockPrisma.refundedEvents.findMany.mockResolvedValue(mockEvents);

      const result = await RefundedEventsService.getRefundedEventsByUserName(userName);

      expect(result.refundedEvents).toEqual(mockEvents);
      expect(mockPrisma.refundedEvents.findMany).toHaveBeenCalledWith({
        where: { userName },
        include: undefined,
        orderBy: { ticketId: 'asc' }
      });
    });

    it('should return refunded events for a user with details', async () => {
      const userName = 'Hannah Episcopia';
      const mockEvents = [mockRefundedEvent];

      mockPrisma.refundedEvents.findMany.mockResolvedValue(mockEvents);

      const result = await RefundedEventsService.getRefundedEventsByUserName(userName, true);

      expect(result.refundedEvents).toEqual(mockEvents);
      expect(mockPrisma.refundedEvents.findMany).toHaveBeenCalledWith({
        where: { userName },
        include: {
          ticket: {
            select: {
              id: true,
              eventId: true,
              recipient: true,
              purchaser: true
            }
          }
        },
        orderBy: { ticketId: 'asc' }
      });
    });

    it('should return empty array when user has no refunded events', async () => {
      const userName = 'NonExistent User';

      mockPrisma.refundedEvents.findMany.mockResolvedValue([]);

      const result = await RefundedEventsService.getRefundedEventsByUserName(userName);

      expect(result.refundedEvents).toEqual([]);
    });
  });

  describe('getRefundedEventsByTicketId', () => {
    it('should return refunded events for a specific ticket', async () => {
      const ticketId = 'ticket-id-123';
      const mockEvents = [mockRefundedEvent];

      mockPrisma.refundedEvents.findMany.mockResolvedValue(mockEvents);

      const result = await RefundedEventsService.getRefundedEventsByTicketId(ticketId);

      expect(result.refundedEvents).toEqual(mockEvents);
      expect(mockPrisma.refundedEvents.findMany).toHaveBeenCalledWith({
        where: { ticketId },
        include: undefined,
        orderBy: { userName: 'asc' }
      });
    });
  });

  describe('createRefundedEvent', () => {
    it('should create a new refunded event successfully', async () => {
      const createData = {
        userName: 'Hannah Episcopia',
        ticketId: 'ticket-id-123'
      };

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null); // No existing refund
      mockPrisma.purchasedEvents.findUnique.mockResolvedValue(mockPurchasedEvent);
      mockPrisma.refundedEvents.create.mockResolvedValue(mockRefundedEvent);

      const result = await RefundedEventsService.createRefundedEvent(createData);

      expect(result.refundedEvent).toEqual(mockRefundedEvent);
      expect(mockPrisma.refundedEvents.findUnique).toHaveBeenCalledWith({
        where: {
          userName_ticketId: {
            userName: createData.userName,
            ticketId: createData.ticketId
          }
        }
      });
      expect(mockPrisma.refundedEvents.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          ticket: {
            select: {
              id: true,
              eventId: true,
              recipient: true,
              purchaser: true
            }
          }
        }
      });
    });

    it('should throw error when refund already exists', async () => {
      const createData = {
        userName: 'Hannah Episcopia',
        ticketId: 'ticket-id-123'
      };

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(mockRefundedEvent); // Existing refund

      await expect(RefundedEventsService.createRefundedEvent(createData))
        .rejects.toThrow('This ticket has already been marked as refunded for this user');

      expect(mockPrisma.refundedEvents.create).not.toHaveBeenCalled();
    });

    it('should throw error when ticket does not exist', async () => {
      const createData = {
        userName: 'Hannah Episcopia',
        ticketId: 'nonexistent-ticket'
      };

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      mockPrisma.purchasedEvents.findUnique.mockResolvedValue(null); // Ticket not found

      await expect(RefundedEventsService.createRefundedEvent(createData))
        .rejects.toThrow('Ticket not found');

      expect(mockPrisma.refundedEvents.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteRefundedEvent', () => {
    it('should delete a refunded event successfully', async () => {
      const refundedEventId = 'refund-id-123';

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(mockRefundedEvent);
      mockPrisma.refundedEvents.delete.mockResolvedValue(mockRefundedEvent);

      await RefundedEventsService.deleteRefundedEvent(refundedEventId);

      expect(mockPrisma.refundedEvents.delete).toHaveBeenCalledWith({
        where: { id: refundedEventId }
      });
    });

    it('should throw error when refunded event not found', async () => {
      const refundedEventId = 'nonexistent-refund';

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);

      await expect(RefundedEventsService.deleteRefundedEvent(refundedEventId))
        .rejects.toThrow('Refunded event record not found');

      expect(mockPrisma.refundedEvents.delete).not.toHaveBeenCalled();
    });
  });

  describe('isTicketRefunded', () => {
    it('should return true when ticket is refunded for user', async () => {
      const userName = 'Hannah Episcopia';
      const ticketId = 'ticket-id-123';

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(mockRefundedEvent);

      const result = await RefundedEventsService.isTicketRefunded(userName, ticketId);

      expect(result).toBe(true);
      expect(mockPrisma.refundedEvents.findUnique).toHaveBeenCalledWith({
        where: {
          userName_ticketId: { userName, ticketId }
        }
      });
    });

    it('should return false when ticket is not refunded for user', async () => {
      const userName = 'Hannah Episcopia';
      const ticketId = 'ticket-id-123';

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);

      const result = await RefundedEventsService.isTicketRefunded(userName, ticketId);

      expect(result).toBe(false);
    });
  });

  describe('getRefundedEvent', () => {
    it('should return specific refunded event', async () => {
      const userName = 'Hannah Episcopia';
      const ticketId = 'ticket-id-123';

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(mockRefundedEvent);

      const result = await RefundedEventsService.getRefundedEvent(userName, ticketId);

      expect(result).toEqual(mockRefundedEvent);
      expect(mockPrisma.refundedEvents.findUnique).toHaveBeenCalledWith({
        where: {
          userName_ticketId: { userName, ticketId }
        },
        include: {
          ticket: {
            select: {
              id: true,
              eventId: true,
              recipient: true,
              purchaser: true
            }
          }
        }
      });
    });

    it('should return null when refunded event not found', async () => {
      const userName = 'Hannah Episcopia';
      const ticketId = 'nonexistent-ticket';

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);

      const result = await RefundedEventsService.getRefundedEvent(userName, ticketId);

      expect(result).toBeNull();
    });
  });

  describe('getRefundedEventsCount', () => {
    it('should return total count of refunded events', async () => {
      mockPrisma.refundedEvents.count.mockResolvedValue(42);

      const result = await RefundedEventsService.getRefundedEventsCount();

      expect(result).toBe(42);
      expect(mockPrisma.refundedEvents.count).toHaveBeenCalledWith();
    });
  });

  describe('getRefundedEventsCountByUserName', () => {
    it('should return count of refunded events for specific user', async () => {
      const userName = 'Hannah Episcopia';

      mockPrisma.refundedEvents.count.mockResolvedValue(5);

      const result = await RefundedEventsService.getRefundedEventsCountByUserName(userName);

      expect(result).toBe(5);
      expect(mockPrisma.refundedEvents.count).toHaveBeenCalledWith({
        where: { userName }
      });
    });
  });

  describe('getRefundedEventsSummary', () => {
    it('should return comprehensive summary statistics', async () => {
      const mockSummary = {
        totalRefunds: 10,
        uniqueUsers: 5,
        uniqueTickets: 8,
        recentRefunds: [mockRefundedEvent]
      };

      mockPrisma.refundedEvents.count.mockResolvedValue(10);
      mockPrisma.refundedEvents.groupBy.mockImplementation((args) => {
        if (args.by.includes('userName')) {
          return Promise.resolve([
            { userName: 'User1' },
            { userName: 'User2' },
            { userName: 'User3' },
            { userName: 'User4' },
            { userName: 'User5' }
          ]);
        } else if (args.by.includes('ticketId')) {
          return Promise.resolve([
            { ticketId: 'ticket1' },
            { ticketId: 'ticket2' },
            { ticketId: 'ticket3' },
            { ticketId: 'ticket4' },
            { ticketId: 'ticket5' },
            { ticketId: 'ticket6' },
            { ticketId: 'ticket7' },
            { ticketId: 'ticket8' }
          ]);
        }
        return Promise.resolve([]);
      });
      mockPrisma.refundedEvents.findMany.mockResolvedValue([mockRefundedEvent]);

      const result = await RefundedEventsService.getRefundedEventsSummary();

      expect(result).toEqual(mockSummary);
      expect(mockPrisma.refundedEvents.count).toHaveBeenCalled();
      expect(mockPrisma.refundedEvents.groupBy).toHaveBeenCalledTimes(2);
      expect(mockPrisma.refundedEvents.findMany).toHaveBeenCalledWith({
        take: 10,
        orderBy: { userName: 'asc' },
        include: {
          ticket: {
            select: {
              id: true,
              eventId: true,
              recipient: true,
              purchaser: true
            }
          }
        }
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty database gracefully', async () => {
      mockPrisma.refundedEvents.findMany.mockResolvedValue([]);

      const result = await RefundedEventsService.getAllRefundedEvents();

      expect(result.refundedEvents).toEqual([]);
    });

    it('should handle special characters in user names', async () => {
      const specialUserName = "O'Connor, Mary-Jane";
      const createData = {
        userName: specialUserName,
        ticketId: 'ticket-id-123'
      };

      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      mockPrisma.purchasedEvents.findUnique.mockResolvedValue(mockPurchasedEvent);
      mockPrisma.refundedEvents.create.mockResolvedValue({
        ...mockRefundedEvent,
        userName: specialUserName
      });

      const result = await RefundedEventsService.createRefundedEvent(createData);

      expect(result.refundedEvent.userName).toBe(specialUserName);
    });

    it('should handle concurrent refund creation attempts', async () => {
      const createData = {
        userName: 'Hannah Episcopia',
        ticketId: 'ticket-id-123'
      };

      // First call finds no existing refund, second call finds existing one created concurrently
      mockPrisma.refundedEvents.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRefundedEvent);
      mockPrisma.purchasedEvents.findUnique.mockResolvedValue(mockPurchasedEvent);
      
      // Simulate unique constraint violation on create
      const uniqueConstraintError = new Error('Unique constraint violation');
      (uniqueConstraintError as any).code = 'P2002';
      mockPrisma.refundedEvents.create.mockRejectedValue(uniqueConstraintError);

      await expect(RefundedEventsService.createRefundedEvent(createData))
        .rejects.toThrow('Unique constraint violation');
    });
  });
});