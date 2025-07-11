/**
 * Integration tests for the complete transaction processing flow
 * Tests the entire pipeline from parsing to database storage
 */

import { testDatabase } from '../utils/testDatabase';

// Integration test that uses real database operations
describe('Transaction Processing Integration', () => {
  let testUser: any;

  beforeAll(async () => {
    await testDatabase.setupDatabase('transactions');
    testUser = await testDatabase.createTestUser({
      firstName: 'Integration',
      lastName: 'Test',
      email: 'integration.test@example.com'
    });
  });

  afterAll(async () => {
    await testDatabase.cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testDatabase.clearTestData();
  });

  const sampleTransactionData = `Transaction: 2025/06/08 05:04 PM
Description	Recipient	Amount
Gen Con Indy 2025 - Ticket Return - RPG25ND286543 (The (In)glorious Birth of New Kor'ak on Thursday, 2:00 PM EDT)	Hannah Episcopia	$4.00
Gen Con Indy 2025 - Ticket Return - RPG25ND272304 (The Rebellion Awakens on Saturday, 2:00 PM EDT)	Peter Casey	$4.00
Gen Con Indy 2025 - Ticket Purchase - RPG25ND272941 (Dread: Victim's Choice on Saturday, 2:00 PM EDT)	Matthew Vogel	$6.00
Gen Con Indy 2025 - Ticket Purchase - NMN25ND286148 (Horus Heresy: The Age of Darkness! on Saturday, 11:00 AM EDT)	Peter Casey	$2.00
Gen Con Indy 2025 - Ticket Return - BGM25ND291521 (Brink on Saturday, 6:00 PM EDT)	Peter Casey	$2.00`;

  describe('End-to-End Transaction Processing', () => {
    it('should parse and process sample transaction data correctly', async () => {
      // Make API call to process transactions
      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.savedPurchases).toBe(4); // 2 explicit + 2 implicit for refunds
      expect(result.savedRefunds).toBe(3);
      expect(result.errors).toHaveLength(0);

      // Verify data was actually saved to database
      const purchases = await testDatabase.prisma.purchasedEvents.findMany({
        where: {
          eventId: { in: ['RPG25ND286543', 'RPG25ND272304', 'RPG25ND272941', 'NMN25ND286148', 'BGM25ND291521'] }
        }
      });

      const refunds = await testDatabase.prisma.refundedEvents.findMany({
        where: {
          userName: { in: ['Hannah Episcopia', 'Peter Casey'] }
        },
        include: { ticket: true }
      });

      expect(purchases).toHaveLength(4);
      expect(refunds).toHaveLength(3);

      // Verify specific purchase details
      const matthewPurchase = purchases.find(p => p.eventId === 'RPG25ND272941');
      expect(matthewPurchase).toBeTruthy();
      expect(matthewPurchase?.recipient).toBe('Matthew Vogel');
      expect(matthewPurchase?.purchaser).toBe(testUser.email);

      // Verify specific refund details
      const hannahRefund = refunds.find(r => r.userName === 'Hannah Episcopia');
      expect(hannahRefund).toBeTruthy();
      expect(hannahRefund?.ticket.eventId).toBe('RPG25ND286543');
    });

    it('should handle duplicate transactions gracefully', async () => {
      const duplicateTransaction = {
        eventId: 'TEST123',
        recipient: 'Test User',
        amount: '5.00',
        type: 'purchase' as const,
        description: 'Test Event'
      };

      // Process the same transaction twice
      const firstResponse = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: [duplicateTransaction],
          year: '2025'
        }),
      });

      expect(firstResponse.status).toBe(200);
      const firstResult = await firstResponse.json();
      expect(firstResult.savedPurchases).toBe(1);

      // Process again - should handle duplicate gracefully
      const secondResponse = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: [duplicateTransaction],
          year: '2025'
        }),
      });

      expect(secondResponse.status).toBe(200);
      const secondResult = await secondResponse.json();
      expect(secondResult.savedPurchases).toBe(0);
      expect(secondResult.errors).toContain('Purchase already exists for TEST123 - Test User');

      // Verify only one record in database
      const purchases = await testDatabase.prisma.purchasedEvents.findMany({
        where: { eventId: 'TEST123' }
      });
      expect(purchases).toHaveLength(1);
    });

    it('should process refund before purchase correctly', async () => {
      const refundTransaction = {
        eventId: 'REFUND_FIRST',
        recipient: 'Early Refunder',
        amount: '10.00',
        type: 'refund' as const,
        description: 'Refund Before Purchase Test'
      };

      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: [refundTransaction],
          year: '2025'
        }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should create implicit purchase + refund
      expect(result.savedPurchases).toBe(1);
      expect(result.savedRefunds).toBe(1);

      // Verify both records exist
      const purchase = await testDatabase.prisma.purchasedEvents.findFirst({
        where: { eventId: 'REFUND_FIRST' }
      });
      const refund = await testDatabase.prisma.refundedEvents.findFirst({
        where: { userName: 'Early Refunder' },
        include: { ticket: true }
      });

      expect(purchase).toBeTruthy();
      expect(refund).toBeTruthy();
      expect(refund?.ticketId).toBe(purchase?.id);
    });

    it('should handle mixed batch of transactions', async () => {
      const mixedTransactions = [
        {
          eventId: 'EVENT1',
          recipient: 'User A',
          amount: '5.00',
          type: 'purchase' as const,
          description: 'First Purchase'
        },
        {
          eventId: 'EVENT2',
          recipient: 'User B',
          amount: '8.00',
          type: 'refund' as const,
          description: 'First Refund (no prior purchase)'
        },
        {
          eventId: 'EVENT1',
          recipient: 'User A',
          amount: '5.00',
          type: 'refund' as const,
          description: 'Refund of First Purchase'
        },
        {
          eventId: 'EVENT3',
          recipient: 'User C',
          amount: '12.00',
          type: 'purchase' as const,
          description: 'Another Purchase'
        }
      ];

      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: mixedTransactions,
          year: '2025'
        }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      // Expected: 3 explicit purchases + 1 implicit for EVENT2 refund = 4 total
      // Expected: 2 refunds (EVENT2 + EVENT1)
      expect(result.savedPurchases).toBe(4);
      expect(result.savedRefunds).toBe(2);

      // Verify final state
      const allPurchases = await testDatabase.prisma.purchasedEvents.findMany({
        where: { eventId: { in: ['EVENT1', 'EVENT2', 'EVENT3'] } }
      });
      const allRefunds = await testDatabase.prisma.refundedEvents.findMany({
        where: { userName: { in: ['User A', 'User B'] } }
      });

      expect(allPurchases).toHaveLength(4);
      expect(allRefunds).toHaveLength(2);
    });

    it('should maintain referential integrity between purchases and refunds', async () => {
      const transactions = [
        {
          eventId: 'INTEGRITY_TEST',
          recipient: 'Integrity User',
          amount: '15.00',
          type: 'purchase' as const,
          description: 'Purchase for Integrity Test'
        },
        {
          eventId: 'INTEGRITY_TEST',
          recipient: 'Integrity User',
          amount: '15.00',
          type: 'refund' as const,
          description: 'Refund for Integrity Test'
        }
      ];

      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions,
          year: '2025'
        }),
      });

      expect(response.status).toBe(200);

      // Get the purchase and refund
      const purchase = await testDatabase.prisma.purchasedEvents.findFirst({
        where: { eventId: 'INTEGRITY_TEST' }
      });
      const refund = await testDatabase.prisma.refundedEvents.findFirst({
        where: { userName: 'Integrity User' },
        include: { ticket: true }
      });

      expect(purchase).toBeTruthy();
      expect(refund).toBeTruthy();
      expect(refund?.ticketId).toBe(purchase?.id);
      expect(refund?.ticket.id).toBe(purchase?.id);
      expect(refund?.ticket.eventId).toBe('INTEGRITY_TEST');
      expect(refund?.ticket.recipient).toBe('Integrity User');
    });

    it('should handle API validation errors correctly', async () => {
      // Test with invalid user ID
      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'invalid-user-id',
          transactions: [{
            eventId: 'TEST',
            recipient: 'Test User',
            amount: '5.00',
            type: 'purchase',
            description: 'Test'
          }],
          year: '2025'
        }),
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('User not found');
    });

    it('should handle malformed request data', async () => {
      // Test with missing required fields
      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing userId
          transactions: [],
          year: '2025'
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Invalid request data');
    });

    it('should enforce unique constraints properly', async () => {
      // Create a purchase first
      const purchaseResponse = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: [{
            eventId: 'UNIQUE_TEST',
            recipient: 'Unique User',
            amount: '7.00',
            type: 'purchase',
            description: 'First Purchase'
          }],
          year: '2025'
        }),
      });

      expect(purchaseResponse.status).toBe(200);

      // Try to create a refund twice
      const refundTransaction = {
        eventId: 'UNIQUE_TEST',
        recipient: 'Unique User',
        amount: '7.00',
        type: 'refund' as const,
        description: 'Refund'
      };

      const firstRefundResponse = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: [refundTransaction],
          year: '2025'
        }),
      });

      expect(firstRefundResponse.status).toBe(200);
      const firstResult = await firstRefundResponse.json();
      expect(firstResult.savedRefunds).toBe(1);

      // Second refund should be rejected
      const secondRefundResponse = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: [refundTransaction],
          year: '2025'
        }),
      });

      expect(secondRefundResponse.status).toBe(200);
      const secondResult = await secondRefundResponse.json();
      expect(secondResult.savedRefunds).toBe(0);
      expect(secondResult.errors).toContain('Refund already exists for UNIQUE_TEST - Unique User');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batches of transactions efficiently', async () => {
      const largeTransactionBatch = [];
      
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

      const startTime = Date.now();
      
      const response = await fetch('http://localhost:3000/api/transactions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUser.id,
          transactions: largeTransactionBatch,
          year: '2025'
        }),
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Should process all transactions
      expect(result.savedPurchases + result.savedRefunds).toBeGreaterThan(0);
      
      // Should complete in reasonable time (less than 10 seconds)
      expect(processingTime).toBeLessThan(10000);

      console.log(`Processed ${largeTransactionBatch.length} transactions in ${processingTime}ms`);
    });
  });
});