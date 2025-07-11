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
  purchasedEvents: PurchasedEvent[];
}

export interface DeleteTicketResponse {
  message: string;
  purchasedEvents: PurchasedEvent[];
}

export class TicketService {
  // Get all purchased events
  static async getAllTickets(): Promise<PurchasedEventsResponse> {
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
    const allPurchasedEvents = await this.getAllTickets();

    return {
      message: `Successfully parsed ${parsedTickets.length} tickets`,
      ticketsAdded: savedTickets.length,
      purchasedEvents: allPurchasedEvents.purchasedEvents
    };
  }

  // Get all purchased events (for admin purposes) - alternative method name
  static async getAllPurchasedTickets() {
    return await prisma.purchasedEvents.findMany({
      orderBy: { eventId: 'asc' }
    });
  }

  // Get purchased events by user email
  static async getPurchasedEventsByUser(userEmail: string) {
    const user = await prisma.user.findUnique({
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

  // Delete a purchased event (admin only)
  static async deletePurchasedEvent(eventId: string): Promise<DeleteTicketResponse> {
    await prisma.purchasedEvents.delete({
      where: { id: eventId }
    });

    // Get updated list
    const allPurchasedEvents = await this.getAllTickets();

    return { 
      message: 'Event deleted successfully',
      purchasedEvents: allPurchasedEvents.purchasedEvents
    };
  }

  // Get purchased events by event ID
  static async getPurchasedEventsByEventId(eventId: string): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: { eventId },
      orderBy: { recipient: 'asc' }
    });

    return { purchasedEvents };
  }

  // Get purchased events by purchaser
  static async getPurchasedEventsByPurchaser(purchaser: string): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: { purchaser },
      orderBy: { eventId: 'asc' }
    });

    return { purchasedEvents };
  }

  // Get purchased events by recipient
  static async getPurchasedEventsByRecipient(recipient: string): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: { recipient },
      orderBy: { eventId: 'asc' }
    });

    return { purchasedEvents };
  }

  // Get count of purchased events by event ID
  static async getPurchasedEventsCount(eventId: string): Promise<number> {
    return await prisma.purchasedEvents.count({
      where: { eventId }
    });
  }

  // Get unique event IDs that have purchases
  static async getEventIdsWithPurchases(): Promise<string[]> {
    const events = await prisma.purchasedEvents.groupBy({
      by: ['eventId'],
      orderBy: { eventId: 'asc' }
    });

    return events.map(event => event.eventId);
  }

  // Get summary statistics
  static async getPurchasesSummary(): Promise<{
    totalPurchases: number;
    uniqueEvents: number;
    uniquePurchasers: number;
    uniqueRecipients: number;
  }> {
    const [
      totalPurchases,
      uniqueEvents,
      uniquePurchasers,
      uniqueRecipients
    ] = await Promise.all([
      prisma.purchasedEvents.count(),
      prisma.purchasedEvents.groupBy({ by: ['eventId'] }).then(result => result.length),
      prisma.purchasedEvents.groupBy({ by: ['purchaser'] }).then(result => result.length),
      prisma.purchasedEvents.groupBy({ by: ['recipient'] }).then(result => result.length)
    ]);

    return {
      totalPurchases,
      uniqueEvents,
      uniquePurchasers,
      uniqueRecipients
    };
  }
}