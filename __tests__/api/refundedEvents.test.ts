/**
 * Tests for RefundedEvents API endpoints with new userName-based schema
 */

import { createMocks } from 'node-mocks-http';
import indexHandler from '@/pages/api/refunded-events/index';
import userHandler from '@/pages/api/refunded-events/user/[userName]';
import checkHandler from '@/pages/api/refunded-events/check/[userName]/[ticketId]';

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}));

// Mock the service
jest.mock('@/lib/services/server/refundedEventsService', () => ({
  RefundedEventsService: {
    getAllRefundedEvents: jest.fn(),
    getRefundedEventsByUserName: jest.fn(),
    createRefundedEvent: jest.fn(),
    isTicketRefunded: jest.fn(),
  }
}));

import { getServerSession } from 'next-auth/next';
import { RefundedEventsService } from '@/lib/services/server/refundedEventsService';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockService = RefundedEventsService as jest.Mocked<typeof RefundedEventsService>;

describe('RefundedEvents API Endpoints', () => {
  const mockSession = {
    user: {
      email: 'test@example.com'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
  });

  describe('/api/refunded-events (index)', () => {
    it('should get all refunded events successfully', async () => {
      const mockRefundedEvents = {
        refundedEvents: [
          {
            id: 'refund-1',
            userName: 'Hannah Episcopia',
            ticketId: 'ticket-1',
            ticket: {
              id: 'ticket-1',
              eventId: 'RPG25ND286543',
              recipient: 'Hannah Episcopia',
              purchaser: 'test@example.com'
            }
          }
        ]
      };

      mockService.getAllRefundedEvents.mockResolvedValue(mockRefundedEvents);

      const { req, res } = createMocks({
        method: 'GET',
        query: { includeDetails: 'true' }
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockRefundedEvents);
      expect(mockService.getAllRefundedEvents).toHaveBeenCalledWith(true);
    });

    it('should create a new refunded event successfully', async () => {
      const mockRefundedEvent = {
        refundedEvent: {
          id: 'refund-123',
          userName: 'Hannah Episcopia',
          ticketId: 'ticket-123'
        }
      };

      mockService.createRefundedEvent.mockResolvedValue(mockRefundedEvent);

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userName: 'Hannah Episcopia',
          ticketId: 'ticket-123'
        }
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(JSON.parse(res._getData())).toEqual(mockRefundedEvent);
      expect(mockService.createRefundedEvent).toHaveBeenCalledWith({
        userName: 'Hannah Episcopia',
        ticketId: 'ticket-123'
      });
    });

    it('should return 400 when userName or ticketId missing', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userName: 'Hannah Episcopia'
          // Missing ticketId
        }
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User name and Ticket ID are required'
      });
    });

    it('should handle duplicate refund error', async () => {
      mockService.createRefundedEvent.mockRejectedValue(
        new Error('This ticket has already been marked as refunded for this user')
      );

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userName: 'Hannah Episcopia',
          ticketId: 'ticket-123'
        }
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'This ticket has already been marked as refunded for this user'
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'GET'
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized'
      });
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createMocks({
        method: 'DELETE'
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method DELETE not allowed'
      });
    });
  });

  describe('/api/refunded-events/user/[userName]', () => {
    it('should get refunded events by user name successfully', async () => {
      const mockUserRefunds = {
        refundedEvents: [
          {
            id: 'refund-1',
            userName: 'Hannah Episcopia',
            ticketId: 'ticket-1'
          }
        ]
      };

      mockService.getRefundedEventsByUserName.mockResolvedValue(mockUserRefunds);

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          userName: 'Hannah Episcopia',
          includeDetails: 'true'
        }
      });

      await userHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockUserRefunds);
      expect(mockService.getRefundedEventsByUserName).toHaveBeenCalledWith('Hannah Episcopia', true);
    });

    it('should return 400 for invalid userName', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { userName: '' }
      });

      await userHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Valid user name is required'
      });
    });

    it('should handle special characters in userName', async () => {
      const specialUserName = "O'Connor, Mary-Jane";
      const mockUserRefunds = {
        refundedEvents: []
      };

      mockService.getRefundedEventsByUserName.mockResolvedValue(mockUserRefunds);

      const { req, res } = createMocks({
        method: 'GET',
        query: { userName: specialUserName }
      });

      await userHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockService.getRefundedEventsByUserName).toHaveBeenCalledWith(specialUserName, false);
    });

    it('should return empty array for user with no refunds', async () => {
      const mockEmptyRefunds = {
        refundedEvents: []
      };

      mockService.getRefundedEventsByUserName.mockResolvedValue(mockEmptyRefunds);

      const { req, res } = createMocks({
        method: 'GET',
        query: { userName: 'Unknown User' }
      });

      await userHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockEmptyRefunds);
    });
  });

  describe('/api/refunded-events/check/[userName]/[ticketId]', () => {
    it('should check if ticket is refunded successfully', async () => {
      mockService.isTicketRefunded.mockResolvedValue(true);

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          userName: 'Hannah Episcopia',
          ticketId: 'ticket-123'
        }
      });

      await checkHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ isRefunded: true });
      expect(mockService.isTicketRefunded).toHaveBeenCalledWith('Hannah Episcopia', 'ticket-123');
    });

    it('should return false for non-refunded ticket', async () => {
      mockService.isTicketRefunded.mockResolvedValue(false);

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          userName: 'Hannah Episcopia',
          ticketId: 'ticket-456'
        }
      });

      await checkHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ isRefunded: false });
    });

    it('should return 400 for missing userName', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          ticketId: 'ticket-123'
          // Missing userName
        }
      });

      await checkHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Valid user name and ticket ID are required'
      });
    });

    it('should return 400 for missing ticketId', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          userName: 'Hannah Episcopia'
          // Missing ticketId
        }
      });

      await checkHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Valid user name and ticket ID are required'
      });
    });

    it('should handle service errors gracefully', async () => {
      mockService.isTicketRefunded.mockRejectedValue(new Error('Database connection failed'));

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          userName: 'Hannah Episcopia',
          ticketId: 'ticket-123'
        }
      });

      await checkHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Internal server error'
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without valid session', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'GET'
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized'
      });
    });

    it('should reject requests with invalid session', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          // Missing email
        }
      });

      const { req, res } = createMocks({
        method: 'GET'
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service unavailable errors', async () => {
      mockService.getAllRefundedEvents.mockRejectedValue(new Error('Service temporarily unavailable'));

      const { req, res } = createMocks({
        method: 'GET'
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Internal server error'
      });
    });

    it('should handle validation errors from service', async () => {
      mockService.createRefundedEvent.mockRejectedValue(new Error('User not found'));

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userName: 'Nonexistent User',
          ticketId: 'ticket-123'
        }
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User not found'
      });
    });

    it('should handle malformed request bodies', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: null
      });

      await indexHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'User name and Ticket ID are required'
      });
    });
  });
});