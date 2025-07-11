/**
 * Tests for transaction processing API
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/transactions/process';
import { testDatabase } from '../utils/testDatabase';

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userList: {
      findUnique: jest.fn(),
    },
    purchasedEvents: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    refundedEvents: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/transactions/process', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validUserId = 'test-user-id-123';
  const validTransactions = [
    {
      eventId: 'RPG25ND286543',
      recipient: 'Hannah Episcopia',
      amount: '4.00',
      type: 'purchase' as const,
      description: 'Test Purchase Event'
    },
    {
      eventId: 'RPG25ND286543',
      recipient: 'Hannah Episcopia',
      amount: '4.00',
      type: 'refund' as const,
      description: 'Test Refund Event'
    }
  ];

  const validUser = {
    id: validUserId,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  };

  describe('POST /api/transactions/process', () => {
    it('should successfully process purchase transactions', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: [validTransactions[0]], // Only purchase
          year: '2025'
        },
      });

      // Mock database responses
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      mockPrisma.purchasedEvents.create.mockResolvedValue({
        id: 'purchase-id-123',
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        purchaser: 'test@example.com'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const data = JSON.parse(res._getData());
      expect(data).toEqual({
        savedPurchases: 1,
        savedRefunds: 0,
        errors: [],
        message: 'Processed 1 transactions'
      });

      expect(mockPrisma.purchasedEvents.create).toHaveBeenCalledWith({
        data: {
          eventId: 'RPG25ND286543',
          recipient: 'Hannah Episcopia',
          purchaser: 'test@example.com'
        }
      });
    });

    it('should successfully process refund transactions', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: [validTransactions[1]], // Only refund
          year: '2025'
        },
      });

      const existingPurchase = {
        id: 'purchase-id-123',
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        purchaser: 'test@example.com'
      };

      // Mock database responses
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(existingPurchase);
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null); // No existing refund
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-id-123',
        userName: 'Hannah Episcopia',
        ticketId: 'purchase-id-123'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const data = JSON.parse(res._getData());
      expect(data).toEqual({
        savedPurchases: 0,
        savedRefunds: 1,
        errors: [],
        message: 'Processed 1 transactions'
      });

      expect(mockPrisma.refundedEvents.create).toHaveBeenCalledWith({
        data: {
          userName: 'Hannah Episcopia',
          ticketId: 'purchase-id-123'
        }
      });
    });

    it('should handle refund before purchase (create purchase first)', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: [validTransactions[1]], // Only refund
          year: '2025'
        },
      });

      const newPurchase = {
        id: 'new-purchase-id-123',
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        purchaser: 'test@example.com'
      };

      // Mock database responses
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(null); // No existing purchase
      mockPrisma.purchasedEvents.create.mockResolvedValue(newPurchase);
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-id-123',
        userName: 'Hannah Episcopia',
        ticketId: 'new-purchase-id-123'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const data = JSON.parse(res._getData());
      expect(data).toEqual({
        savedPurchases: 1, // Created implicit purchase
        savedRefunds: 1,
        errors: [],
        message: 'Processed 1 transactions'
      });

      expect(mockPrisma.purchasedEvents.create).toHaveBeenCalledWith({
        data: {
          eventId: 'RPG25ND286543',
          recipient: 'Hannah Episcopia',
          purchaser: 'test@example.com'
        }
      });
    });

    it('should handle duplicate purchases gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: [validTransactions[0]], // Purchase
          year: '2025'
        },
      });

      // Mock database responses
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      
      // Simulate unique constraint violation
      const duplicateError = new Error('Duplicate entry');
      (duplicateError as any).code = 'P2002';
      mockPrisma.purchasedEvents.create.mockRejectedValue(duplicateError);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const data = JSON.parse(res._getData());
      expect(data.savedPurchases).toBe(0);
      expect(data.errors).toContain('Purchase already exists for RPG25ND286543 - Hannah Episcopia');
    });

    it('should handle duplicate refunds gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: [validTransactions[1]], // Refund
          year: '2025'
        },
      });

      const existingPurchase = {
        id: 'purchase-id-123',
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        purchaser: 'test@example.com'
      };

      const existingRefund = {
        id: 'existing-refund-123',
        userName: 'Hannah Episcopia',
        ticketId: 'purchase-id-123'
      };

      // Mock database responses
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(existingPurchase);
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(existingRefund); // Existing refund

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const data = JSON.parse(res._getData());
      expect(data.savedRefunds).toBe(0);
      expect(data.errors).toContain('Refund already exists for RPG25ND286543 - Hannah Episcopia');
    });

    it('should return 400 for invalid user ID', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'invalid-user-id',
          transactions: validTransactions,
          year: '2025'
        },
      });

      // Mock user not found
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('User not found');
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          // Missing userId
          transactions: validTransactions,
          year: '2025'
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid request data');
    });

    it('should return 400 for invalid transactions array', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: 'not-an-array',
          year: '2025'
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid request data');
    });

    it('should return 405 for non-POST methods', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Method GET not allowed');
    });

    it('should process mixed transactions correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: validTransactions, // Both purchase and refund
          year: '2025'
        },
      });

      const newPurchase = {
        id: 'purchase-id-123',
        eventId: 'RPG25ND286543',
        recipient: 'Hannah Episcopia',
        purchaser: 'test@example.com'
      };

      // Mock database responses
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      mockPrisma.purchasedEvents.create.mockResolvedValue(newPurchase);
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(newPurchase);
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-id-123',
        userName: 'Hannah Episcopia',
        ticketId: 'purchase-id-123'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const data = JSON.parse(res._getData());
      expect(data).toEqual({
        savedPurchases: 1,
        savedRefunds: 1,
        errors: [],
        message: 'Processed 2 transactions'
      });
    });

    it('should handle database errors gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: validUserId,
          transactions: [validTransactions[0]],
          year: '2025'
        },
      });

      // Mock user lookup succeeds but purchase creation fails
      mockPrisma.userList.findUnique.mockResolvedValue(validUser);
      mockPrisma.purchasedEvents.create.mockRejectedValue(new Error('Database connection failed'));

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Internal server error');
    });
  });
});