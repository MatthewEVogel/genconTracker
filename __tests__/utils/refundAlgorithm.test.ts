import {
  analyzeRefundCandidates,
  getRefundCandidateTickets,
  shouldTicketBeRefunded,
  getRecipientRefundInfo,
  getRefundStatistics
} from '@/utils/refundAlgorithm';
import { PurchasedEvent } from '@/lib/services/server/refundService';

describe('Refund Algorithm Tests', () => {
  // Helper function to create test purchased events
  const createPurchasedEvent = (
    id: string,
    eventId: string,
    recipient: string,
    purchaser: string = 'Test Purchaser'
  ): PurchasedEvent => ({
    id,
    eventId,
    recipient,
    purchaser
  });

  describe('Duplicate Detection', () => {
    test('should identify no duplicates when all tickets are unique', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('3', 'EVENT003', 'Bob Johnson'),
        createPurchasedEvent('4', 'EVENT001', 'Alice Brown'), // Different person, same event
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(0);
      expect(analysis.totalRefundCandidates).toBe(0);
      expect(analysis.affectedRecipients).toHaveLength(0);
      expect(analysis.affectedEvents).toHaveLength(0);
    });

    test('should identify duplicates when same person has multiple tickets for same event', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'), // Duplicate
        createPurchasedEvent('3', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('4', 'EVENT001', 'John Doe'), // Another duplicate
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(1);
      expect(analysis.duplicates[0].eventId).toBe('EVENT001');
      expect(analysis.duplicates[0].recipient).toBe('John Doe');
      expect(analysis.duplicates[0].duplicateTickets).toHaveLength(3);
      expect(analysis.duplicates[0].refundCandidates).toHaveLength(2); // Keep first, refund others
      expect(analysis.totalRefundCandidates).toBe(2);
      expect(analysis.affectedRecipients).toContain('john doe'); // Normalized
      expect(analysis.affectedEvents).toContain('EVENT001');
    });

    test('should handle case-insensitive recipient names', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'JOHN DOE'), // Different case
        createPurchasedEvent('3', 'EVENT001', 'john doe'), // Different case
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(1);
      expect(analysis.duplicates[0].refundCandidates).toHaveLength(2);
      expect(analysis.totalRefundCandidates).toBe(2);
    });

    test('should handle whitespace in recipient names', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', ' John Doe '), // Extra whitespace
        createPurchasedEvent('3', 'EVENT001', '  JOHN DOE  '), // Extra whitespace and case
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(1);
      expect(analysis.duplicates[0].refundCandidates).toHaveLength(2);
    });

    test('should identify multiple duplicate groups', () => {
      const tickets: PurchasedEvent[] = [
        // John Doe duplicates for EVENT001
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'),
        // Jane Smith duplicates for EVENT002
        createPurchasedEvent('3', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('4', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('5', 'EVENT002', 'Jane Smith'),
        // No duplicates
        createPurchasedEvent('6', 'EVENT003', 'Bob Johnson'),
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(2);
      expect(analysis.totalRefundCandidates).toBe(3); // 1 from John + 2 from Jane
      expect(analysis.affectedRecipients).toHaveLength(2);
      expect(analysis.affectedEvents).toHaveLength(2);
    });
  });

  describe('Refund Candidate Identification', () => {
    test('should return correct refund candidate tickets', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'), // Should be refunded
        createPurchasedEvent('3', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('4', 'EVENT001', 'John Doe'), // Should be refunded
      ];

      const refundCandidates = getRefundCandidateTickets(tickets);

      expect(refundCandidates).toHaveLength(2);
      expect(refundCandidates.map(t => t.id)).toContain('2');
      expect(refundCandidates.map(t => t.id)).toContain('4');
      expect(refundCandidates.map(t => t.id)).not.toContain('1'); // First one should be kept
    });

    test('should correctly identify if specific ticket should be refunded', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'), // Duplicate
        createPurchasedEvent('3', 'EVENT002', 'Jane Smith'),
      ];

      expect(shouldTicketBeRefunded('1', tickets)).toBe(false); // First occurrence, keep it
      expect(shouldTicketBeRefunded('2', tickets)).toBe(true);  // Duplicate, refund it
      expect(shouldTicketBeRefunded('3', tickets)).toBe(false); // No duplicate, keep it
      expect(shouldTicketBeRefunded('999', tickets)).toBe(false); // Non-existent ticket
    });
  });

  describe('Recipient-Specific Analysis', () => {
    test('should provide detailed refund info for specific recipient', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'), // Duplicate
        createPurchasedEvent('3', 'EVENT002', 'John Doe'),
        createPurchasedEvent('4', 'EVENT002', 'John Doe'), // Duplicate
        createPurchasedEvent('5', 'EVENT003', 'John Doe'), // No duplicate
        createPurchasedEvent('6', 'EVENT001', 'Jane Smith'), // Different person
      ];

      const info = getRecipientRefundInfo('John Doe', tickets);

      expect(info.totalTickets).toBe(5); // John has 5 tickets total
      expect(info.duplicateEvents).toHaveLength(2); // EVENT001 and EVENT002
      expect(info.duplicateEvents).toContain('EVENT001');
      expect(info.duplicateEvents).toContain('EVENT002');
      expect(info.refundCandidates).toHaveLength(2); // 1 from each duplicate event
    });

    test('should handle case-insensitive recipient lookup', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'JOHN DOE'),
      ];

      const info = getRecipientRefundInfo('john doe', tickets);

      expect(info.totalTickets).toBe(2);
      expect(info.refundCandidates).toHaveLength(1);
    });
  });

  describe('Statistics and Reporting', () => {
    test('should generate comprehensive refund statistics', () => {
      const tickets: PurchasedEvent[] = [
        // John Doe: 3 tickets for EVENT001 (2 refunds), 1 for EVENT002
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'),
        createPurchasedEvent('3', 'EVENT001', 'John Doe'),
        createPurchasedEvent('4', 'EVENT002', 'John Doe'),
        // Jane Smith: 2 tickets for EVENT002 (1 refund)
        createPurchasedEvent('5', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('6', 'EVENT002', 'Jane Smith'),
        // Bob Johnson: 1 ticket for EVENT003 (no refunds)
        createPurchasedEvent('7', 'EVENT003', 'Bob Johnson'),
      ];

      const stats = getRefundStatistics(tickets);

      expect(stats.totalTickets).toBe(7);
      expect(stats.uniqueRecipients).toBe(3);
      expect(stats.uniqueEvents).toBe(3);
      expect(stats.duplicateCount).toBe(5); // Total tickets in duplicate groups
      expect(stats.refundAmount).toBe(3); // Total refunds needed
      expect(stats.duplicateRate).toBeCloseTo(42.86, 2); // 3/7 * 100
      expect(stats.mostDuplicatedEvent?.eventId).toBe('EVENT001'); // 2 refunds
      expect(stats.mostDuplicatedEvent?.duplicateCount).toBe(2);
      expect(stats.mostDuplicatedRecipient?.recipient).toBe('john doe');
      expect(stats.mostDuplicatedRecipient?.duplicateCount).toBe(2);
    });

    test('should handle empty ticket list', () => {
      const stats = getRefundStatistics([]);

      expect(stats.totalTickets).toBe(0);
      expect(stats.uniqueRecipients).toBe(0);
      expect(stats.uniqueEvents).toBe(0);
      expect(stats.duplicateCount).toBe(0);
      expect(stats.refundAmount).toBe(0);
      expect(stats.duplicateRate).toBe(0);
      expect(stats.mostDuplicatedEvent).toBeNull();
      expect(stats.mostDuplicatedRecipient).toBeNull();
    });

    test('should handle tickets with no duplicates', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT002', 'Jane Smith'),
        createPurchasedEvent('3', 'EVENT003', 'Bob Johnson'),
      ];

      const stats = getRefundStatistics(tickets);

      expect(stats.totalTickets).toBe(3);
      expect(stats.uniqueRecipients).toBe(3);
      expect(stats.uniqueEvents).toBe(3);
      expect(stats.duplicateCount).toBe(0);
      expect(stats.refundAmount).toBe(0);
      expect(stats.duplicateRate).toBe(0);
      expect(stats.mostDuplicatedEvent).toBeNull();
      expect(stats.mostDuplicatedRecipient).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle tickets with same recipient but different events', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT002', 'John Doe'),
        createPurchasedEvent('3', 'EVENT003', 'John Doe'),
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(0);
      expect(analysis.totalRefundCandidates).toBe(0);
    });

    test('should handle tickets with same event but different recipients', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'Jane Smith'),
        createPurchasedEvent('3', 'EVENT001', 'Bob Johnson'),
      ];

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(0);
      expect(analysis.totalRefundCandidates).toBe(0);
    });

    test('should maintain consistent ordering for refund candidates', () => {
      const tickets: PurchasedEvent[] = [
        createPurchasedEvent('3', 'EVENT001', 'John Doe'),
        createPurchasedEvent('1', 'EVENT001', 'John Doe'),
        createPurchasedEvent('2', 'EVENT001', 'John Doe'),
      ];

      const analysis = analyzeRefundCandidates(tickets);
      const refundCandidates = analysis.duplicates[0].refundCandidates;

      // Should keep ticket with ID '1' (first alphabetically) and refund '2' and '3'
      expect(refundCandidates.map(t => t.id)).toEqual(['2', '3']);
    });

    test('should handle very large numbers of duplicates', () => {
      const tickets: PurchasedEvent[] = [];
      
      // Create 100 duplicate tickets for the same person and event
      for (let i = 1; i <= 100; i++) {
        tickets.push(createPurchasedEvent(i.toString(), 'EVENT001', 'John Doe'));
      }

      const analysis = analyzeRefundCandidates(tickets);

      expect(analysis.duplicates).toHaveLength(1);
      expect(analysis.duplicates[0].duplicateTickets).toHaveLength(100);
      expect(analysis.duplicates[0].refundCandidates).toHaveLength(99); // Keep first, refund 99
      expect(analysis.totalRefundCandidates).toBe(99);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle complex multi-person, multi-event scenario', () => {
      const tickets: PurchasedEvent[] = [
        // Family group with some duplicates
        createPurchasedEvent('1', 'EVENT001', 'John Smith'),
        createPurchasedEvent('2', 'EVENT001', 'John Smith'), // Duplicate
        createPurchasedEvent('3', 'EVENT001', 'Mary Smith'),
        createPurchasedEvent('4', 'EVENT002', 'John Smith'),
        createPurchasedEvent('5', 'EVENT002', 'Mary Smith'),
        createPurchasedEvent('6', 'EVENT002', 'Mary Smith'), // Duplicate
        createPurchasedEvent('7', 'EVENT003', 'Tommy Smith'),
        
        // Another family with different duplicates
        createPurchasedEvent('8', 'EVENT001', 'Bob Johnson'),
        createPurchasedEvent('9', 'EVENT003', 'Bob Johnson'),
        createPurchasedEvent('10', 'EVENT003', 'Bob Johnson'), // Duplicate
        createPurchasedEvent('11', 'EVENT003', 'Bob Johnson'), // Another duplicate
        
        // Single person with no duplicates
        createPurchasedEvent('12', 'EVENT004', 'Alice Brown'),
      ];

      const analysis = analyzeRefundCandidates(tickets);
      const stats = getRefundStatistics(tickets);

      expect(analysis.duplicates).toHaveLength(3); // John/EVENT001, Mary/EVENT002, Bob/EVENT003
      expect(analysis.totalRefundCandidates).toBe(4); // 1 + 1 + 2
      expect(stats.totalTickets).toBe(12);
      expect(stats.uniqueRecipients).toBe(5);
      expect(stats.uniqueEvents).toBe(4);
      expect(stats.refundAmount).toBe(4);

      console.log('Complex Scenario Analysis:', {
        totalTickets: stats.totalTickets,
        refundAmount: stats.refundAmount,
        duplicateRate: Math.round(stats.duplicateRate * 100) / 100,
        affectedRecipients: analysis.affectedRecipients.length,
        affectedEvents: analysis.affectedEvents.length
      });
    });
  });
});
