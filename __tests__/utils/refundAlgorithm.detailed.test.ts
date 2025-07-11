/**
 * Comprehensive tests for the refund algorithm
 */

import {
  analyzeRefundCandidates,
  getRefundCandidateTickets,
  shouldTicketBeRefunded,
  getRecipientRefundInfo,
  getRefundStatistics,
  DuplicateTicket,
  RefundAnalysis
} from '@/utils/refundAlgorithm';
import { PurchasedEvent } from '@/lib/services/server/refundService';

describe('Refund Algorithm', () => {
  // Helper function to create test tickets
  const createTicket = (id: string, eventId: string, recipient: string, purchaser: string = 'John Purchaser'): PurchasedEvent => ({
    id,
    eventId,
    recipient,
    purchaser
  });

  describe('analyzeRefundCandidates', () => {
    it('should return empty analysis for no tickets', () => {
      const result = analyzeRefundCandidates([]);
      
      expect(result).toEqual({
        duplicates: [],
        totalDuplicateTickets: 0,
        totalRefundCandidates: 0,
        affectedRecipients: [],
        affectedEvents: []
      });
    });

    it('should return empty analysis for unique tickets', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT2', 'Bob'),
        createTicket('3', 'EVENT3', 'Charlie')
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result).toEqual({
        duplicates: [],
        totalDuplicateTickets: 0,
        totalRefundCandidates: 0,
        affectedRecipients: [],
        affectedEvents: []
      });
    });

    it('should identify simple duplicate for same recipient and event', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'), // Duplicate
        createTicket('3', 'EVENT2', 'Bob')
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]).toEqual({
        eventId: 'EVENT1',
        recipient: 'Alice', // Uses original case
        duplicateTickets: [tickets[0], tickets[1]], // Sorted by ID
        refundCandidates: [tickets[1]] // All but first
      });
      
      expect(result.totalDuplicateTickets).toBe(2);
      expect(result.totalRefundCandidates).toBe(1);
      expect(result.affectedRecipients).toContain('alice'); // Normalized
      expect(result.affectedEvents).toContain('EVENT1');
    });

    it('should handle multiple duplicates for same recipient', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'), // Duplicate 1
        createTicket('3', 'EVENT1', 'Alice'), // Duplicate 2
        createTicket('4', 'EVENT2', 'Alice')
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(3);
      expect(result.duplicates[0].refundCandidates).toHaveLength(2); // Keep first, refund other 2
      expect(result.totalRefundCandidates).toBe(2);
    });

    it('should handle duplicates for multiple recipients', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'), // Alice duplicate
        createTicket('3', 'EVENT1', 'Bob'),
        createTicket('4', 'EVENT1', 'Bob'), // Bob duplicate
        createTicket('5', 'EVENT2', 'Charlie')
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(2);
      expect(result.totalRefundCandidates).toBe(2);
      expect(result.affectedRecipients).toHaveLength(2);
      expect(result.affectedRecipients).toContain('alice');
      expect(result.affectedRecipients).toContain('bob');
      expect(result.affectedEvents).toEqual(['EVENT1']);
    });

    it('should handle duplicates across multiple events', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'), // EVENT1 duplicate
        createTicket('3', 'EVENT2', 'Alice'),
        createTicket('4', 'EVENT2', 'Alice'), // EVENT2 duplicate
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(2);
      expect(result.totalRefundCandidates).toBe(2);
      expect(result.affectedRecipients).toEqual(['alice']);
      expect(result.affectedEvents).toHaveLength(2);
      expect(result.affectedEvents).toContain('EVENT1');
      expect(result.affectedEvents).toContain('EVENT2');
    });

    it('should normalize recipient names (case insensitive)', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice Smith'),
        createTicket('2', 'EVENT1', 'ALICE SMITH'), // Same person, different case
        createTicket('3', 'EVENT1', 'alice smith'), // Same person, different case
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(3);
      expect(result.duplicates[0].refundCandidates).toHaveLength(2);
      expect(result.duplicates[0].recipient).toBe('Alice Smith'); // Uses original case from first ticket
    });

    it('should handle whitespace in recipient names', () => {
      const tickets = [
        createTicket('1', 'EVENT1', ' Alice Smith '),
        createTicket('2', 'EVENT1', 'Alice Smith'),
        createTicket('3', 'EVENT1', '  Alice Smith  '),
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(3);
      expect(result.duplicates[0].refundCandidates).toHaveLength(2);
    });

    it('should sort tickets by ID for consistent ordering', () => {
      const tickets = [
        createTicket('c', 'EVENT1', 'Alice'),
        createTicket('a', 'EVENT1', 'Alice'),
        createTicket('b', 'EVENT1', 'Alice'),
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates[0].duplicateTickets).toEqual([
        tickets[1], // 'a'
        tickets[2], // 'b'
        tickets[0]  // 'c'
      ]);
      expect(result.duplicates[0].refundCandidates).toEqual([
        tickets[2], // 'b'
        tickets[0]  // 'c'
      ]);
    });

    it('should handle complex scenario with multiple recipients and events', () => {
      const tickets = [
        // Alice: EVENT1 (3 tickets), EVENT2 (2 tickets)
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'),
        createTicket('3', 'EVENT1', 'Alice'),
        createTicket('4', 'EVENT2', 'Alice'),
        createTicket('5', 'EVENT2', 'Alice'),
        
        // Bob: EVENT1 (2 tickets), EVENT3 (1 ticket)
        createTicket('6', 'EVENT1', 'Bob'),
        createTicket('7', 'EVENT1', 'Bob'),
        createTicket('8', 'EVENT3', 'Bob'),
        
        // Charlie: EVENT2 (1 ticket)
        createTicket('9', 'EVENT2', 'Charlie')
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(3);
      expect(result.totalDuplicateTickets).toBe(7); // Alice: 5, Bob: 2
      expect(result.totalRefundCandidates).toBe(4); // Alice: 2+1=3, Bob: 1
      expect(result.affectedRecipients).toHaveLength(2);
      expect(result.affectedEvents).toHaveLength(2);
      expect(result.affectedEvents).toContain('EVENT1');
      expect(result.affectedEvents).toContain('EVENT2');
    });

    it('should handle empty and null inputs gracefully', () => {
      const result1 = analyzeRefundCandidates([]);
      const result2 = analyzeRefundCandidates([] as PurchasedEvent[]);
      
      expect(result1.duplicates).toEqual([]);
      expect(result2.duplicates).toEqual([]);
    });

    it('should handle special characters in recipient names', () => {
      const tickets = [
        createTicket('1', 'EVENT1', "O'Connor, Mary-Jane"),
        createTicket('2', 'EVENT1', "o'connor, mary-jane"),
        createTicket('3', 'EVENT1', "O'CONNOR, MARY-JANE"),
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(3);
      expect(result.duplicates[0].refundCandidates).toHaveLength(2);
    });
  });

  describe('getRefundCandidateTickets', () => {
    it('should return only tickets that need refunding', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'), // Should be refunded
        createTicket('3', 'EVENT1', 'Alice'), // Should be refunded
        createTicket('4', 'EVENT2', 'Bob'),    // Unique, keep
        createTicket('5', 'EVENT2', 'Alice'),  // Unique, keep
      ];

      const result = getRefundCandidateTickets(tickets);
      
      expect(result).toHaveLength(2);
      expect(result).toContain(tickets[1]);
      expect(result).toContain(tickets[2]);
    });

    it('should return empty array for no duplicates', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT2', 'Bob'),
        createTicket('3', 'EVENT3', 'Charlie')
      ];

      const result = getRefundCandidateTickets(tickets);
      
      expect(result).toEqual([]);
    });

    it('should maintain order based on ticket ID sorting', () => {
      const tickets = [
        createTicket('z', 'EVENT1', 'Alice'),
        createTicket('a', 'EVENT1', 'Alice'),
        createTicket('m', 'EVENT1', 'Alice'),
      ];

      const result = getRefundCandidateTickets(tickets);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('m'); // Second in sorted order
      expect(result[1].id).toBe('z'); // Third in sorted order
    });
  });

  describe('shouldTicketBeRefunded', () => {
    const tickets = [
      createTicket('keep1', 'EVENT1', 'Alice'),
      createTicket('refund1', 'EVENT1', 'Alice'),
      createTicket('refund2', 'EVENT1', 'Alice'),
      createTicket('keep2', 'EVENT2', 'Bob'),
    ];

    it('should return true for tickets that need refunding', () => {
      expect(shouldTicketBeRefunded('refund1', tickets)).toBe(true);
      expect(shouldTicketBeRefunded('refund2', tickets)).toBe(true);
    });

    it('should return false for tickets to keep', () => {
      expect(shouldTicketBeRefunded('keep1', tickets)).toBe(false);
      expect(shouldTicketBeRefunded('keep2', tickets)).toBe(false);
    });

    it('should return false for non-existent tickets', () => {
      expect(shouldTicketBeRefunded('nonexistent', tickets)).toBe(false);
    });

    it('should return false for empty ticket list', () => {
      expect(shouldTicketBeRefunded('any', [])).toBe(false);
    });
  });

  describe('getRecipientRefundInfo', () => {
    const tickets = [
      createTicket('1', 'EVENT1', 'Alice'),
      createTicket('2', 'EVENT1', 'Alice'), // Duplicate
      createTicket('3', 'EVENT2', 'Alice'),
      createTicket('4', 'EVENT2', 'Alice'), // Duplicate
      createTicket('5', 'EVENT3', 'Alice'), // Unique
      createTicket('6', 'EVENT1', 'Bob'),   // Different recipient
    ];

    it('should return correct info for recipient with duplicates', () => {
      const result = getRecipientRefundInfo('Alice', tickets);
      
      expect(result.totalTickets).toBe(5);
      expect(result.duplicateEvents).toHaveLength(2);
      expect(result.duplicateEvents).toContain('EVENT1');
      expect(result.duplicateEvents).toContain('EVENT2');
      expect(result.refundCandidates).toHaveLength(2);
    });

    it('should return empty info for recipient with no tickets', () => {
      const result = getRecipientRefundInfo('Charlie', tickets);
      
      expect(result.totalTickets).toBe(0);
      expect(result.duplicateEvents).toEqual([]);
      expect(result.refundCandidates).toEqual([]);
    });

    it('should return correct info for recipient with only unique tickets', () => {
      const uniqueTickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT2', 'Alice'),
        createTicket('3', 'EVENT3', 'Alice'),
      ];

      const result = getRecipientRefundInfo('Alice', uniqueTickets);
      
      expect(result.totalTickets).toBe(3);
      expect(result.duplicateEvents).toEqual([]);
      expect(result.refundCandidates).toEqual([]);
    });

    it('should handle case-insensitive recipient matching', () => {
      const result1 = getRecipientRefundInfo('alice', tickets);
      const result2 = getRecipientRefundInfo('ALICE', tickets);
      const result3 = getRecipientRefundInfo('Alice', tickets);
      
      expect(result1.totalTickets).toBe(5);
      expect(result2.totalTickets).toBe(5);
      expect(result3.totalTickets).toBe(5);
    });

    it('should handle whitespace in recipient names', () => {
      const result = getRecipientRefundInfo(' Alice ', tickets);
      
      expect(result.totalTickets).toBe(5);
    });
  });

  describe('getRefundStatistics', () => {
    const tickets = [
      // Alice: EVENT1 (3), EVENT2 (2) = 5 total, 2 refunds
      createTicket('1', 'EVENT1', 'Alice'),
      createTicket('2', 'EVENT1', 'Alice'),
      createTicket('3', 'EVENT1', 'Alice'),
      createTicket('4', 'EVENT2', 'Alice'),
      createTicket('5', 'EVENT2', 'Alice'),
      
      // Bob: EVENT1 (2) = 2 total, 1 refund
      createTicket('6', 'EVENT1', 'Bob'),
      createTicket('7', 'EVENT1', 'Bob'),
      
      // Charlie: EVENT3 (1) = 1 total, 0 refunds
      createTicket('8', 'EVENT3', 'Charlie'),
    ];

    it('should return correct overall statistics', () => {
      const result = getRefundStatistics(tickets);
      
      expect(result.totalTickets).toBe(8);
      expect(result.uniqueRecipients).toBe(3);
      expect(result.uniqueEvents).toBe(3);
      expect(result.duplicateCount).toBe(7); // Alice: 5, Bob: 2
      expect(result.refundAmount).toBe(4); // Alice: 3, Bob: 1
      expect(result.duplicateRate).toBe(50); // 4/8 * 100
    });

    it('should identify most duplicated event', () => {
      const result = getRefundStatistics(tickets);
      
      expect(result.mostDuplicatedEvent).toEqual({
        eventId: 'EVENT1',
        duplicateCount: 3 // Alice: 2 refunds + Bob: 1 refund
      });
    });

    it('should identify most duplicated recipient', () => {
      const result = getRefundStatistics(tickets);
      
      expect(result.mostDuplicatedRecipient).toEqual({
        recipient: 'alice', // Normalized
        duplicateCount: 3 // Alice has 3 total refunds
      });
    });

    it('should handle empty ticket list', () => {
      const result = getRefundStatistics([]);
      
      expect(result.totalTickets).toBe(0);
      expect(result.uniqueRecipients).toBe(0);
      expect(result.uniqueEvents).toBe(0);
      expect(result.duplicateCount).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.duplicateRate).toBe(0);
      expect(result.mostDuplicatedEvent).toBeNull();
      expect(result.mostDuplicatedRecipient).toBeNull();
    });

    it('should handle tickets with no duplicates', () => {
      const uniqueTickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT2', 'Bob'),
        createTicket('3', 'EVENT3', 'Charlie'),
      ];

      const result = getRefundStatistics(uniqueTickets);
      
      expect(result.totalTickets).toBe(3);
      expect(result.uniqueRecipients).toBe(3);
      expect(result.uniqueEvents).toBe(3);
      expect(result.duplicateCount).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.duplicateRate).toBe(0);
      expect(result.mostDuplicatedEvent).toBeNull();
      expect(result.mostDuplicatedRecipient).toBeNull();
    });

    it('should handle ties in most duplicated calculations', () => {
      const tieTickets = [
        // EVENT1: Alice (2), Bob (2) = 2 total refunds
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'),
        createTicket('3', 'EVENT1', 'Bob'),
        createTicket('4', 'EVENT1', 'Bob'),
        
        // EVENT2: Charlie (2) = 1 refund
        createTicket('5', 'EVENT2', 'Charlie'),
        createTicket('6', 'EVENT2', 'Charlie'),
      ];

      const result = getRefundStatistics(tieTickets);
      
      // Should return first in sorted order when tied
      expect(result.mostDuplicatedEvent?.eventId).toBe('EVENT1');
      expect(result.mostDuplicatedEvent?.duplicateCount).toBe(2);
      
      // Alice and Bob both have 1 refund, should return first alphabetically
      expect(result.mostDuplicatedRecipient?.recipient).toBe('alice');
      expect(result.mostDuplicatedRecipient?.duplicateCount).toBe(1);
    });

    it('should calculate percentages correctly', () => {
      const testTickets = [
        createTicket('1', 'EVENT1', 'Alice'),
        createTicket('2', 'EVENT1', 'Alice'),
        createTicket('3', 'EVENT2', 'Bob'),
        createTicket('4', 'EVENT3', 'Charlie'),
      ];

      const result = getRefundStatistics(testTickets);
      
      expect(result.totalTickets).toBe(4);
      expect(result.refundAmount).toBe(1);
      expect(result.duplicateRate).toBe(25); // 1/4 * 100
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle tickets with empty recipient names', () => {
      const tickets = [
        createTicket('1', 'EVENT1', ''),
        createTicket('2', 'EVENT1', ''),
        createTicket('3', 'EVENT1', ' '),
      ];

      const result = analyzeRefundCandidates(tickets);
      
      // Empty names should be treated as same recipient
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(3);
    });

    it('should handle tickets with very long recipient names', () => {
      const longName = 'A'.repeat(1000);
      const tickets = [
        createTicket('1', 'EVENT1', longName),
        createTicket('2', 'EVENT1', longName.toLowerCase()),
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(2);
    });

    it('should handle tickets with special unicode characters', () => {
      const tickets = [
        createTicket('1', 'EVENT1', 'José María'),
        createTicket('2', 'EVENT1', 'josé maría'),
        createTicket('3', 'EVENT1', 'JOSÉ MARÍA'),
      ];

      const result = analyzeRefundCandidates(tickets);
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].duplicateTickets).toHaveLength(3);
    });

    it('should handle large number of tickets efficiently', () => {
      const tickets: PurchasedEvent[] = [];
      
      // Create 1000 tickets with some duplicates
      for (let i = 0; i < 1000; i++) {
        tickets.push(createTicket(
          `ticket-${i}`,
          `EVENT${i % 10}`, // 10 events
          `Recipient${i % 50}` // 50 recipients
        ));
      }

      const startTime = Date.now();
      const result = analyzeRefundCandidates(tickets);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.totalRefundCandidates).toBeGreaterThan(0);
    });

    it('should maintain referential integrity in complex scenarios', () => {
      const tickets = [
        createTicket('a', 'EVENT1', 'Alice'),
        createTicket('b', 'EVENT1', 'Alice'),
        createTicket('c', 'EVENT1', 'Bob'),
        createTicket('d', 'EVENT2', 'Alice'),
      ];

      const analysis = analyzeRefundCandidates(tickets);
      const refundCandidates = getRefundCandidateTickets(tickets);
      
      // Verify that all refund candidates are in the analysis
      for (const candidate of refundCandidates) {
        const found = analysis.duplicates.some(duplicate => 
          duplicate.refundCandidates.some(rc => rc.id === candidate.id)
        );
        expect(found).toBe(true);
      }
      
      // Verify that shouldTicketBeRefunded is consistent
      for (const ticket of tickets) {
        const shouldRefund = shouldTicketBeRefunded(ticket.id, tickets);
        const isInCandidates = refundCandidates.some(rc => rc.id === ticket.id);
        expect(shouldRefund).toBe(isInCandidates);
      }
    });
  });
});