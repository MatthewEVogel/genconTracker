import { prisma } from '@/lib/prisma';
import { parseGenConTickets } from '@/utils/ticketParser';

export interface PurchasedEvent {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
}

export interface ParsedTicket {
  eventId: string;
  eventName: string;
  recipient: string;
}

export interface PurchasedEventsResponse {
  purchasedEvents: PurchasedEvent[];
}

export interface ParseTicketsResponse {
  message: string;
  ticketsAdded: number;
  refundTickets: PurchasedEvent[];
}

export interface DeleteTicketResponse {
  message: string;
  purchasedEvents: PurchasedEvent[];
}

export class RefundService {
  // Get all purchased events (replaces getRefundTickets)
  static async getRefundTickets(): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      orderBy: {
        eventId: 'asc'
      }
    });

    return { purchasedEvents };
  }

  // Parse tickets from GenCon purchase text and save them
  static async parseTickets(text: string, userEmail: string): Promise<ParseTicketsResponse> {
    // Get user from database
    const user = await prisma.userList.findUnique({
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
      const savedTicket = await prisma.purchasedEvents.create({
        data: {
          eventId: ticket.eventId,
          recipient: ticket.recipient,
          purchaser: `${user.firstName} ${user.lastName}`,
        }
      });
      savedTickets.push(savedTicket);
    }

    // Get updated list
    const allPurchasedEvents = await this.getRefundTickets();

    return {
      message: `Successfully parsed ${parsedTickets.length} tickets`,
      ticketsAdded: savedTickets.length,
      refundTickets: allPurchasedEvents.purchasedEvents
    };
  }

  // Delete a purchased event (admin only)
  static async deletePurchasedEvent(eventId: string): Promise<DeleteTicketResponse> {
    await prisma.purchasedEvents.delete({
      where: { id: eventId }
    });

    // Get updated list
    const allPurchasedEvents = await this.getRefundTickets();

    return { 
      message: 'Event deleted successfully',
      purchasedEvents: allPurchasedEvents.purchasedEvents
    };
  }

  // Get all purchased events (for admin purposes)
  static async getAllPurchasedEvents() {
    return await prisma.purchasedEvents.findMany({
      orderBy: { eventId: 'asc' }
    });
  }

  // Get purchased events by user email
  static async getPurchasedEventsByUser(userEmail: string) {
    const user = await prisma.userList.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return await prisma.purchasedEvents.findMany({
      where: {
        purchaser: `${user.firstName} ${user.lastName}`
      },
      orderBy: { eventId: 'asc' }
    });
  }

  // Backwards compatibility: mark as refunded = delete
  static async markTicketAsRefunded(ticketId: string): Promise<DeleteTicketResponse> {
    // In the new system, this just deletes the ticket
    return await this.deletePurchasedEvent(ticketId);
  }
}