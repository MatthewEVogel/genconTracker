import { prisma } from '@/lib/prisma';

export interface PurchasedEvent {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
}

export interface CreatePurchasedEventData {
  eventId: string;
  recipient: string;
  purchaser: string;
}

export interface PurchasedEventsResponse {
  purchasedEvents: PurchasedEvent[];
}

export class PurchasedEventsService {
  // Get all purchased events
  static async getAllPurchasedEvents(): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      orderBy: {
        eventId: 'asc'
      }
    });

    return { purchasedEvents };
  }

  // Get purchased events by event ID
  static async getPurchasedEventsByEventId(eventId: string): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: { eventId },
      orderBy: {
        recipient: 'asc'
      }
    });

    return { purchasedEvents };
  }

  // Get purchased events by purchaser
  static async getPurchasedEventsByPurchaser(purchaser: string): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: { purchaser },
      orderBy: {
        eventId: 'asc'
      }
    });

    return { purchasedEvents };
  }

  // Get purchased events by recipient
  static async getPurchasedEventsByRecipient(recipient: string): Promise<PurchasedEventsResponse> {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: { recipient },
      orderBy: {
        eventId: 'asc'
      }
    });

    return { purchasedEvents };
  }

  // Create a new purchased event
  static async createPurchasedEvent(data: CreatePurchasedEventData): Promise<PurchasedEvent> {
    const purchasedEvent = await prisma.purchasedEvents.create({
      data: {
        eventId: data.eventId,
        recipient: data.recipient,
        purchaser: data.purchaser
      }
    });

    return purchasedEvent;
  }

  // Create multiple purchased events
  static async createManyPurchasedEvents(events: CreatePurchasedEventData[]): Promise<{ count: number }> {
    const result = await prisma.purchasedEvents.createMany({
      data: events,
      skipDuplicates: true
    });

    return { count: result.count };
  }

  // Delete a purchased event by ID
  static async deletePurchasedEvent(id: string): Promise<void> {
    const purchasedEvent = await prisma.purchasedEvents.findUnique({
      where: { id }
    });

    if (!purchasedEvent) {
      throw new Error('Purchased event not found');
    }

    await prisma.purchasedEvents.delete({
      where: { id }
    });
  }

  // Delete purchased events by event ID
  static async deletePurchasedEventsByEventId(eventId: string): Promise<{ count: number }> {
    const result = await prisma.purchasedEvents.deleteMany({
      where: { eventId }
    });

    return { count: result.count };
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
      orderBy: {
        eventId: 'asc'
      }
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