import { prisma } from '@/lib/prisma';
import { parseGenConTickets } from '@/utils/ticketParser';

export interface RefundTicket {
  id: string;
  eventId: string;
  eventName: string;
  recipient: string;
  purchaser: string;
  createdAt: Date;
  needsRefund: boolean;
  isRefunded: boolean;
}

export interface ParsedTicket {
  eventId: string;
  eventName: string;
  recipient: string;
}

export interface RefundTicketsResponse {
  refundTickets: RefundTicket[];
}

export interface ParseTicketsResponse {
  message: string;
  ticketsAdded: number;
  refundTickets: RefundTicket[];
}

export interface MarkRefundedResponse {
  message: string;
  refundTickets: RefundTicket[];
}

export class RefundService {
  // Get all tickets that need refunds
  static async getRefundTickets(): Promise<RefundTicketsResponse> {
    // For now, continue using the legacy PurchasedTicket table during migration
    // TODO: After migration, this should query PurchasedEvent for duplicates
    const refundTickets = await prisma.purchasedTicket.findMany({
      where: {
        needsRefund: true,
        isRefunded: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { refundTickets };
  }

  // Parse tickets from GenCon purchase text and save them
  static async parseTickets(text: string, userEmail: string): Promise<ParseTicketsResponse> {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Parse the tickets from the text
    const parsedTickets = parseGenConTickets(text);

    if (parsedTickets.length === 0) {
      throw new Error('No valid tickets found in the text');
    }

    // Save tickets to database
    const savedTickets = [];
    for (const ticket of parsedTickets) {
      const savedTicket = await prisma.purchasedTicket.create({
        data: {
          eventId: ticket.eventId,
          eventName: ticket.eventName,
          recipient: ticket.recipient,
          purchaser: `${user.firstName} ${user.lastName}`,
        }
      });
      savedTickets.push(savedTicket);
    }

    // Recalculate duplicates across ALL tickets in the database
    await this.recalculateDuplicates();

    // Get updated refund list
    const refundTickets = await this.getRefundTickets();

    return {
      message: `Successfully parsed ${parsedTickets.length} tickets`,
      ticketsAdded: savedTickets.length,
      refundTickets: refundTickets.refundTickets
    };
  }

  // Mark a ticket as refunded
  static async markTicketAsRefunded(ticketId: string): Promise<MarkRefundedResponse> {
    // Mark ticket as refunded
    const updatedTicket = await prisma.purchasedTicket.update({
      where: { id: ticketId },
      data: { 
        isRefunded: true,
        needsRefund: false
      }
    });

    // Recalculate duplicates after removing this ticket
    await this.recalculateDuplicates();

    // Get updated refund list
    const refundTickets = await this.getRefundTickets();

    return {
      message: 'Ticket marked as refunded',
      refundTickets: refundTickets.refundTickets
    };
  }

  // Get all purchased tickets (for admin purposes)
  static async getAllPurchasedTickets() {
    return await prisma.purchasedTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get purchased tickets by user email
  static async getPurchasedTicketsByUser(userEmail: string) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return await prisma.purchasedTicket.findMany({
      where: {
        purchaser: `${user.firstName} ${user.lastName}`
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Delete a purchased ticket (admin only)
  static async deletePurchasedTicket(ticketId: string) {
    await prisma.purchasedTicket.delete({
      where: { id: ticketId }
    });

    // Recalculate duplicates after deletion
    await this.recalculateDuplicates();

    return { message: 'Ticket deleted successfully' };
  }

  // NEW METHODS for migrated schema (to be used after migration):
  
  // Get purchased events that are duplicates and need refunds
  static async getPurchasedEventDuplicates(): Promise<RefundTicketsResponse> {
    // Find duplicate purchased events (same eventId + recipient combination)
    const duplicates = await prisma.$queryRaw`
      SELECT pe.*, u.email as purchaser_email
      FROM purchased_events pe
      JOIN users u ON pe.user_id = u.id
      WHERE (pe.event_id, pe.recipient) IN (
        SELECT event_id, recipient
        FROM purchased_events
        GROUP BY event_id, recipient
        HAVING COUNT(*) > 1
      )
      ORDER BY pe.event_id, pe.recipient, pe.purchase_date ASC
    `;

    // Transform to expected format
    const refundTickets = (duplicates as any[])
      .slice(1) // Remove first occurrence, keep duplicates
      .map(ticket => ({
        id: ticket.id,
        eventId: ticket.event_id,
        eventName: ticket.event_id, // Will be derived from Event table
        recipient: ticket.recipient,
        purchaser: ticket.purchaser_email,
        createdAt: ticket.created_at,
        needsRefund: true, // These are duplicates that need refunds
        isRefunded: false, // Not yet refunded
      }));

    return { refundTickets };
  }

  // Move purchased event to refunded events
  static async refundPurchasedEvent(purchasedEventId: string, refundReason?: string): Promise<MarkRefundedResponse> {
    return await prisma.$transaction(async (tx) => {
      // Get the purchased event
      const purchasedEvent = await tx.purchasedEvent.findUnique({
        where: { id: purchasedEventId },
        include: { user: true, event: true }
      });

      if (!purchasedEvent) {
        throw new Error('Purchased event not found');
      }

      // Create refunded event record
      await tx.refundedEvent.create({
        data: {
          userId: purchasedEvent.userId,
          eventId: purchasedEvent.eventId,
          recipient: purchasedEvent.recipient,
          originalCost: purchasedEvent.cost,
          refundAmount: purchasedEvent.cost, // Assume full refund
          purchaseDate: purchasedEvent.purchaseDate,
          refundReason: refundReason,
          confirmation: purchasedEvent.confirmation,
        }
      });

      // Delete the purchased event
      await tx.purchasedEvent.delete({
        where: { id: purchasedEventId }
      });

      // Get updated duplicates list
      const updatedDuplicates = await this.getPurchasedEventDuplicates();

      return {
        message: 'Event refunded successfully',
        refundTickets: updatedDuplicates.refundTickets
      };
    });
  }

  // Private method to recalculate duplicates across all tickets
  private static async recalculateDuplicates(): Promise<void> {
    // Reset all needsRefund flags
    await prisma.purchasedTicket.updateMany({
      data: { needsRefund: false }
    });

    // Get all non-refunded tickets
    const allTickets = await prisma.purchasedTicket.findMany({
      where: { isRefunded: false },
      orderBy: { createdAt: 'asc' } // Keep earliest tickets
    });

    console.log('DEBUG: Total tickets found:', allTickets.length);

    // Group by eventId + recipient combination
    const ticketGroups = new Map<string, any[]>();
    allTickets.forEach(ticket => {
      // Create a unique key combining eventId and recipient
      const key = `${ticket.eventId}|${ticket.recipient}`;
      if (!ticketGroups.has(key)) {
        ticketGroups.set(key, []);
      }
      ticketGroups.get(key)!.push(ticket);
    });

    console.log('DEBUG: Ticket groups:', Array.from(ticketGroups.entries()).map(([key, tickets]) => ({
      key,
      count: tickets.length,
      tickets: tickets.map(t => ({ id: t.id, eventId: t.eventId, recipient: t.recipient, purchaser: t.purchaser }))
    })));

    // Mark duplicates for refund
    for (const [key, tickets] of ticketGroups) {
      if (tickets.length > 1) {
        console.log(`DEBUG: Found ${tickets.length} duplicates for key: ${key}`);
        // Multiple tickets for same event+recipient combination (duplicate!)
        // Keep the first ticket (earliest), mark others for refund
        const ticketsToRefund = tickets.slice(1);
        
        for (const ticket of ticketsToRefund) {
          console.log(`DEBUG: Marking ticket ${ticket.id} for refund (${ticket.eventId} - ${ticket.recipient})`);
          await prisma.purchasedTicket.update({
            where: { id: ticket.id },
            data: { needsRefund: true }
          });
        }
      }
    }
  }
}