import { PurchasedEvent } from '@/lib/services/server/refundService';

export interface DuplicateTicket {
  eventId: string;
  recipient: string;
  duplicateTickets: PurchasedEvent[];
  refundCandidates: PurchasedEvent[]; // All but the first one should be refunded
}

export interface RefundAnalysis {
  duplicates: DuplicateTicket[];
  totalDuplicateTickets: number;
  totalRefundCandidates: number;
  affectedRecipients: string[];
  affectedEvents: string[];
}

/**
 * Analyzes purchased tickets to identify duplicates that need refunds
 * A duplicate is when the same recipient has multiple tickets for the same event
 */
export function analyzeRefundCandidates(purchasedEvents: PurchasedEvent[]): RefundAnalysis {
  // Group tickets by eventId and recipient
  const ticketGroups = new Map<string, Map<string, PurchasedEvent[]>>();
  
  for (const ticket of purchasedEvents) {
    const eventId = ticket.eventId;
    const recipient = ticket.recipient.trim().toLowerCase(); // Normalize recipient name
    
    if (!ticketGroups.has(eventId)) {
      ticketGroups.set(eventId, new Map());
    }
    
    const eventGroup = ticketGroups.get(eventId)!;
    if (!eventGroup.has(recipient)) {
      eventGroup.set(recipient, []);
    }
    
    eventGroup.get(recipient)!.push(ticket);
  }
  
  // Find duplicates (groups with more than 1 ticket for same event/recipient)
  const duplicates: DuplicateTicket[] = [];
  const affectedRecipients = new Set<string>();
  const affectedEvents = new Set<string>();
  let totalRefundCandidates = 0;
  
  for (const [eventId, eventGroup] of ticketGroups) {
    for (const [recipient, tickets] of eventGroup) {
      if (tickets.length > 1) {
        // Sort tickets by ID to ensure consistent ordering (keep the first one)
        const sortedTickets = tickets.sort((a, b) => a.id.localeCompare(b.id));
        const refundCandidates = sortedTickets.slice(1); // All but the first
        
        duplicates.push({
          eventId,
          recipient: tickets[0].recipient, // Use original case from first ticket
          duplicateTickets: sortedTickets,
          refundCandidates
        });
        
        affectedRecipients.add(recipient);
        affectedEvents.add(eventId);
        totalRefundCandidates += refundCandidates.length;
      }
    }
  }
  
  return {
    duplicates,
    totalDuplicateTickets: duplicates.reduce((sum, d) => sum + d.duplicateTickets.length, 0),
    totalRefundCandidates,
    affectedRecipients: Array.from(affectedRecipients),
    affectedEvents: Array.from(affectedEvents)
  };
}

/**
 * Gets all tickets that should be refunded (duplicates only, keeping the first occurrence)
 */
export function getRefundCandidateTickets(purchasedEvents: PurchasedEvent[]): PurchasedEvent[] {
  const analysis = analyzeRefundCandidates(purchasedEvents);
  return analysis.duplicates.flatMap(d => d.refundCandidates);
}

/**
 * Checks if a specific ticket should be refunded based on duplicate analysis
 */
export function shouldTicketBeRefunded(ticketId: string, purchasedEvents: PurchasedEvent[]): boolean {
  const refundCandidates = getRefundCandidateTickets(purchasedEvents);
  return refundCandidates.some(ticket => ticket.id === ticketId);
}

/**
 * Gets detailed refund information for a specific recipient
 */
export function getRecipientRefundInfo(recipient: string, purchasedEvents: PurchasedEvent[]): {
  totalTickets: number;
  duplicateEvents: string[];
  refundCandidates: PurchasedEvent[];
} {
  const normalizedRecipient = recipient.trim().toLowerCase();
  const recipientTickets = purchasedEvents.filter(
    ticket => ticket.recipient.trim().toLowerCase() === normalizedRecipient
  );
  
  const analysis = analyzeRefundCandidates(recipientTickets);
  const duplicateEvents = analysis.duplicates.map(d => d.eventId);
  const refundCandidates = analysis.duplicates.flatMap(d => d.refundCandidates);
  
  return {
    totalTickets: recipientTickets.length,
    duplicateEvents,
    refundCandidates
  };
}

/**
 * Gets refund statistics for reporting
 */
export function getRefundStatistics(purchasedEvents: PurchasedEvent[]): {
  totalTickets: number;
  uniqueRecipients: number;
  uniqueEvents: number;
  duplicateCount: number;
  refundAmount: number;
  duplicateRate: number;
  mostDuplicatedEvent: { eventId: string; duplicateCount: number } | null;
  mostDuplicatedRecipient: { recipient: string; duplicateCount: number } | null;
} {
  const analysis = analyzeRefundCandidates(purchasedEvents);
  
  // Count unique recipients and events
  const uniqueRecipients = new Set(purchasedEvents.map(t => t.recipient.trim().toLowerCase())).size;
  const uniqueEvents = new Set(purchasedEvents.map(t => t.eventId)).size;
  
  // Find most duplicated event
  const eventDuplicateCounts = new Map<string, number>();
  analysis.duplicates.forEach(d => {
    eventDuplicateCounts.set(d.eventId, (eventDuplicateCounts.get(d.eventId) || 0) + d.refundCandidates.length);
  });
  
  const mostDuplicatedEvent = Array.from(eventDuplicateCounts.entries())
    .sort((a, b) => b[1] - a[1])[0];
  
  // Find most duplicated recipient
  const recipientDuplicateCounts = new Map<string, number>();
  analysis.duplicates.forEach(d => {
    const recipient = d.recipient.trim().toLowerCase();
    recipientDuplicateCounts.set(recipient, (recipientDuplicateCounts.get(recipient) || 0) + d.refundCandidates.length);
  });
  
  const mostDuplicatedRecipient = Array.from(recipientDuplicateCounts.entries())
    .sort((a, b) => b[1] - a[1])[0];
  
  return {
    totalTickets: purchasedEvents.length,
    uniqueRecipients,
    uniqueEvents,
    duplicateCount: analysis.totalDuplicateTickets,
    refundAmount: analysis.totalRefundCandidates,
    duplicateRate: purchasedEvents.length > 0 ? (analysis.totalRefundCandidates / purchasedEvents.length) * 100 : 0,
    mostDuplicatedEvent: mostDuplicatedEvent ? { eventId: mostDuplicatedEvent[0], duplicateCount: mostDuplicatedEvent[1] } : null,
    mostDuplicatedRecipient: mostDuplicatedRecipient ? { recipient: mostDuplicatedRecipient[0], duplicateCount: mostDuplicatedRecipient[1] } : null
  };
}
