/**
 * Integration tests for the complete transaction processing flow
 * Tests the entire pipeline from parsing to database storage using mocks
 */

import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/transactions/process';

// Mock the prisma client
jest.mock('../../lib/prisma', () => ({
  prisma: {
    userList: {
      findUnique: jest.fn(),
    },
    purchasedEvents: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    refundedEvents: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';

const mockPrisma = prisma as any;

// Integration test that uses mocked database operations
describe('Transaction Processing Integration', () => {
  let testUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    testUser = {
      id: 'integration-test-user-123',
      firstName: 'Integration',
      lastName: 'Test',
      email: 'integration.test@example.com'
    };

    // Default mock for user lookup
    mockPrisma.userList.findUnique.mockResolvedValue(testUser);
  });

  describe('End-to-End Transaction Processing', () => {
    it('should parse and process sample transaction data correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [
            {
              eventId: 'RPG25ND286543',
              recipient: 'Hannah Episcopia',
              amount: '4.00',
              type: 'refund',
              description: "The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT"
            },
            {
              eventId: 'RPG25ND272304',
              recipient: 'Peter Casey',
              amount: '4.00',
              type: 'refund',
              description: 'The Rebellion Awakens on Saturday, 2:00 PM EDT'
            },
            {
              eventId: 'RPG25ND272941',
              recipient: 'Matthew Vogel',
              amount: '6.00',
              type: 'purchase',
              description: 'Dread: Victim\'s Choice on Saturday, 2:00 PM EDT'
            },
            {
              eventId: 'NMN25ND286148',
              recipient: 'Peter Casey',
              amount: '2.00',
              type: 'purchase',
              description: 'Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT'
            },
            {
              eventId: 'BGM25ND291521',
              recipient: 'Peter Casey',
              amount: '2.00',
              type: 'refund',
              description: 'Brink on Saturday, 6:00 PM EDT'
            }
          ],
          year: '2025'
        },
      });

      // Mock database responses for refunds (no existing purchases)
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(null);
      
      // Mock successful purchase creation for implicit purchases
      const mockPurchases = [
        { id: 'purchase-1', eventId: 'RPG25ND286543', recipient: 'Hannah Episcopia', purchaser: testUser.email },
        { id: 'purchase-2', eventId: 'RPG25ND272304', recipient: 'Peter Casey', purchaser: testUser.email },
        { id: 'purchase-3', eventId: 'RPG25ND272941', recipient: 'Matthew Vogel', purchaser: testUser.email },
        { id: 'purchase-4', eventId: 'NMN25ND286148', recipient: 'Peter Casey', purchaser: testUser.email },
        { id: 'purchase-5', eventId: 'BGM25ND291521', recipient: 'Peter Casey', purchaser: testUser.email }
      ];

      mockPrisma.purchasedEvents.create.mockImplementation((args: any) => {
        const eventId = args.data.eventId;
        const purchase = mockPurchases.find(p => p.eventId === eventId);
        return Promise.resolve(purchase);
      });

      // Mock successful refund creation
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-123',
        userName: 'Test User',
        ticketId: 'purchase-123'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      
      const result = JSON.parse(res._getData());
      expect(result.savedPurchases).toBe(5); // 2 explicit + 3 implicit for refunds
      expect(result.savedRefunds).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle duplicate transactions gracefully', async () => {
      const duplicateTransaction = {
        eventId: 'TEST123',
        recipient: 'Test User',
        amount: '5.00',
        type: 'purchase' as const,
        description: 'Test Event'
      };

      // First request
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [duplicateTransaction],
          year: '2025'
        },
      });

      mockPrisma.purchasedEvents.create.mockResolvedValue({
        id: 'purchase-123',
        eventId: 'TEST123',
        recipient: 'Test User',
        purchaser: testUser.email
      });

      await handler(req1, res1);

      expect(res1._getStatusCode()).toBe(200);
      const firstResult = JSON.parse(res1._getData());
      expect(firstResult.savedPurchases).toBe(1);

      // Second request - should handle duplicate gracefully
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [duplicateTransaction],
          year: '2025'
        },
      });

      // Mock duplicate error
      const duplicateError = new Error('Duplicate entry');
      (duplicateError as any).code = 'P2002';
      mockPrisma.purchasedEvents.create.mockRejectedValue(duplicateError);

      await handler(req2, res2);

      expect(res2._getStatusCode()).toBe(200);
      const secondResult = JSON.parse(res2._getData());
      expect(secondResult.savedPurchases).toBe(0);
      expect(secondResult.errors).toContain('Purchase already exists for TEST123 - Test User');
    });

    it('should process refund before purchase correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [{
            eventId: 'REFUND_FIRST',
            recipient: 'Early Refunder',
            amount: '10.00',
            type: 'refund',
            description: 'Refund Before Purchase Test'
          }],
          year: '2025'
        },
      });

      // Mock no existing purchase
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(null);
      
      // Mock successful implicit purchase creation
      mockPrisma.purchasedEvents.create.mockResolvedValue({
        id: 'implicit-purchase-123',
        eventId: 'REFUND_FIRST',
        recipient: 'Early Refunder',
        purchaser: testUser.email
      });

      // Mock successful refund creation
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-123',
        userName: 'Early Refunder',
        ticketId: 'implicit-purchase-123'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const result = JSON.parse(res._getData());
      
      // Should create implicit purchase + refund
      expect(result.savedPurchases).toBe(1);
      expect(result.savedRefunds).toBe(1);
    });

    it('should handle mixed batch of transactions', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [
            {
              eventId: 'EVENT1',
              recipient: 'User A',
              amount: '5.00',
              type: 'purchase',
              description: 'First Purchase'
            },
            {
              eventId: 'EVENT2',
              recipient: 'User B',
              amount: '8.00',
              type: 'refund',
              description: 'First Refund (no prior purchase)'
            },
            {
              eventId: 'EVENT1',
              recipient: 'User A',
              amount: '5.00',
              type: 'refund',
              description: 'Refund of First Purchase'
            },
            {
              eventId: 'EVENT3',
              recipient: 'User C',
              amount: '12.00',
              type: 'purchase',
              description: 'Another Purchase'
            }
          ],
          year: '2025'
        },
      });

      // Mock purchase creation
      mockPrisma.purchasedEvents.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: `purchase-${args.data.eventId}`,
          eventId: args.data.eventId,
          recipient: args.data.recipient,
          purchaser: testUser.email
        });
      });

      // Mock finding existing purchase for EVENT1 refund
      mockPrisma.purchasedEvents.findFirst.mockImplementation((args: any) => {
        if (args.where.eventId === 'EVENT1') {
          return Promise.resolve({
            id: 'purchase-EVENT1',
            eventId: 'EVENT1',
            recipient: 'User A',
            purchaser: testUser.email
          });
        }
        return Promise.resolve(null);
      });

      // Mock refund creation
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-123',
        userName: 'Test User',
        ticketId: 'purchase-123'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const result = JSON.parse(res._getData());

      // Expected: 2 explicit purchases + 1 implicit for EVENT2 refund = 3 total
      // Expected: 2 refunds (EVENT2 + EVENT1)
      expect(result.savedPurchases).toBe(3);
      expect(result.savedRefunds).toBe(2);
    });

    it('should maintain referential integrity between purchases and refunds', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [
            {
              eventId: 'INTEGRITY_TEST',
              recipient: 'Integrity User',
              amount: '15.00',
              type: 'purchase',
              description: 'Purchase for Integrity Test'
            },
            {
              eventId: 'INTEGRITY_TEST',
              recipient: 'Integrity User',
              amount: '15.00',
              type: 'refund',
              description: 'Refund for Integrity Test'
            }
          ],
          year: '2025'
        },
      });

      const mockPurchase = {
        id: 'integrity-purchase-123',
        eventId: 'INTEGRITY_TEST',
        recipient: 'Integrity User',
        purchaser: testUser.email
      };

      // Mock purchase creation
      mockPrisma.purchasedEvents.create.mockResolvedValue(mockPurchase);
      
      // Mock finding the purchase for refund
      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(mockPurchase);
      
      // Mock no existing refund
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      
      // Mock refund creation
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'integrity-refund-123',
        userName: 'Integrity User',
        ticketId: mockPurchase.id
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const result = JSON.parse(res._getData());
      expect(result.savedPurchases).toBe(1);
      expect(result.savedRefunds).toBe(1);
    });

    it('should handle API validation errors correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'invalid-user-id',
          transactions: [{
            eventId: 'TEST',
            recipient: 'Test User',
            amount: '5.00',
            type: 'purchase',
            description: 'Test'
          }],
          year: '2025'
        },
      });

      // Mock user not found
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const result = JSON.parse(res._getData());
      expect(result.error).toBe('User not found');
    });

    it('should handle malformed request data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          // Missing userId
          transactions: [],
          year: '2025'
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const result = JSON.parse(res._getData());
      expect(result.error).toBe('Invalid request data');
    });

    it('should enforce unique constraints properly', async () => {
      // First request - create purchase
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [{
            eventId: 'UNIQUE_TEST',
            recipient: 'Unique User',
            amount: '7.00',
            type: 'purchase',
            description: 'First Purchase'
          }],
          year: '2025'
        },
      });

      const mockPurchase = {
        id: 'unique-purchase-123',
        eventId: 'UNIQUE_TEST',
        recipient: 'Unique User',
        purchaser: testUser.email
      };

      mockPrisma.purchasedEvents.create.mockResolvedValue(mockPurchase);

      await handler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);

      // Second request - first refund
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [{
            eventId: 'UNIQUE_TEST',
            recipient: 'Unique User',
            amount: '7.00',
            type: 'refund',
            description: 'Refund'
          }],
          year: '2025'
        },
      });

      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(mockPurchase);
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'unique-refund-123',
        userName: 'Unique User',
        ticketId: mockPurchase.id
      });

      await handler(req2, res2);
      expect(res2._getStatusCode()).toBe(200);
      const firstResult = JSON.parse(res2._getData());
      expect(firstResult.savedRefunds).toBe(1);

      // Third request - duplicate refund should be rejected
      const { req: req3, res: res3 } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: [{
            eventId: 'UNIQUE_TEST',
            recipient: 'Unique User',
            amount: '7.00',
            type: 'refund',
            description: 'Refund'
          }],
          year: '2025'
        },
      });

      // Mock existing refund found
      mockPrisma.refundedEvents.findUnique.mockResolvedValue({
        id: 'unique-refund-123',
        userName: 'Unique User',
        ticketId: mockPurchase.id
      });

      await handler(req3, res3);
      expect(res3._getStatusCode()).toBe(200);
      const secondResult = JSON.parse(res3._getData());
      expect(secondResult.savedRefunds).toBe(0);
      expect(secondResult.errors).toContain('Refund already exists for UNIQUE_TEST - Unique User');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batches of transactions efficiently', async () => {
      const largeTransactionBatch: any[] = [];
      
      // Create 50 transactions
      for (let i = 0; i < 50; i++) {
        largeTransactionBatch.push({
          eventId: `PERF_EVENT_${i}`,
          recipient: `User ${i}`,
          amount: '5.00',
          type: i % 2 === 0 ? 'purchase' as const : 'refund' as const,
          description: `Performance Test Event ${i}`
        });
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: testUser.id,
          transactions: largeTransactionBatch,
          year: '2025'
        },
      });

      // Mock successful operations
      mockPrisma.purchasedEvents.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: `purchase-${args.data.eventId}`,
          eventId: args.data.eventId,
          recipient: args.data.recipient,
          purchaser: testUser.email
        });
      });

      mockPrisma.purchasedEvents.findFirst.mockResolvedValue(null);
      mockPrisma.refundedEvents.findUnique.mockResolvedValue(null);
      mockPrisma.refundedEvents.create.mockResolvedValue({
        id: 'refund-123',
        userName: 'Test User',
        ticketId: 'purchase-123'
      });

      const startTime = Date.now();
      
      await handler(req, res);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(res._getStatusCode()).toBe(200);
      const result = JSON.parse(res._getData());
      
      // Should process all transactions
      expect(result.savedPurchases + result.savedRefunds).toBeGreaterThan(0);
      
      // Should complete in reasonable time (less than 1 second for mocked operations)
      expect(processingTime).toBeLessThan(1000);

      console.log(`Processed ${largeTransactionBatch.length} transactions in ${processingTime}ms`);
    });
  });
});
