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
  static async getRefundTickets(): Promise<RefundTicketsResponse> {
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
    const refundTickets = await prisma.purchasedTicket.findMany({
      where: {
        needsRefund: true,
        isRefunded: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      message: `Successfully parsed ${parsedTickets.length} tickets`,
      ticketsAdded: savedTickets.length,
      refundTickets
    };
  }

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
    const refundTickets = await prisma.purchasedTicket.findMany({
      where: {
        needsRefund: true,
        isRefunded: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      message: 'Ticket marked as refunded',
      refundTickets
    };
  }

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