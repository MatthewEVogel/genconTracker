import { prisma } from '@/lib/prisma';

export interface RefundedEvent {
  id: string;
  userName: string;
  ticketId: string;
  ticket?: {
    id: string;
    eventId: string;
    recipient: string;
    purchaser: string;
  };
}

export interface CreateRefundedEventData {
  userName: string;
  ticketId: string;
}

export interface RefundedEventsResponse {
  refundedEvents: RefundedEvent[];
}

export interface RefundedEventResponse {
  refundedEvent: RefundedEvent;
}

export class RefundedEventsService {
  // Get all refunded events
  static async getAllRefundedEvents(includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const refundedEvents = await prisma.refundedEvents.findMany({
      include: includeDetails ? {
        ticket: {
          select: {
            id: true,
            eventId: true,
            recipient: true,
            purchaser: true
          }
        }
      } : undefined,
      orderBy: {
        userName: 'asc'
      }
    });

    return { refundedEvents };
  }

  // Get refunded events by user name
  static async getRefundedEventsByUserName(userName: string, includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const refundedEvents = await prisma.refundedEvents.findMany({
      where: { userName },
      include: includeDetails ? {
        ticket: {
          select: {
            id: true,
            eventId: true,
            recipient: true,
            purchaser: true
          }
        }
      } : undefined,
      orderBy: {
        ticketId: 'asc'
      }
    });

    return { refundedEvents };
  }

  // Get refunded events by ticket ID
  static async getRefundedEventsByTicketId(ticketId: string, includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const refundedEvents = await prisma.refundedEvents.findMany({
      where: { ticketId },
      include: includeDetails ? {
        ticket: {
          select: {
            id: true,
            eventId: true,
            recipient: true,
            purchaser: true
          }
        }
      } : undefined,
      orderBy: {
        userName: 'asc'
      }
    });

    return { refundedEvents };
  }

  // Create a new refunded event record
  static async createRefundedEvent(data: CreateRefundedEventData): Promise<RefundedEventResponse> {
    // Check if this refund record already exists
    const existing = await prisma.refundedEvents.findUnique({
      where: {
        userName_ticketId: {
          userName: data.userName,
          ticketId: data.ticketId
        }
      }
    });

    if (existing) {
      throw new Error('This ticket has already been marked as refunded for this user');
    }

    // Verify that the ticket exists
    const ticket = await prisma.purchasedEvents.findUnique({
      where: { id: data.ticketId }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Create the refunded event record
    const refundedEvent = await prisma.refundedEvents.create({
      data: {
        userName: data.userName,
        ticketId: data.ticketId
      },
      include: {
        ticket: {
          select: {
            id: true,
            eventId: true,
            recipient: true,
            purchaser: true
          }
        }
      }
    });

    return { refundedEvent };
  }

  // Delete a refunded event record
  static async deleteRefundedEvent(refundedEventId: string): Promise<void> {
    const refundedEvent = await prisma.refundedEvents.findUnique({
      where: { id: refundedEventId }
    });

    if (!refundedEvent) {
      throw new Error('Refunded event record not found');
    }

    await prisma.refundedEvents.delete({
      where: { id: refundedEventId }
    });
  }

  // Check if a ticket is refunded for a specific user
  static async isTicketRefunded(userName: string, ticketId: string): Promise<boolean> {
    const refundedEvent = await prisma.refundedEvents.findUnique({
      where: {
        userName_ticketId: {
          userName,
          ticketId
        }
      }
    });

    return !!refundedEvent;
  }

  // Get a specific refunded event record
  static async getRefundedEvent(userName: string, ticketId: string): Promise<RefundedEvent | null> {
    const refundedEvent = await prisma.refundedEvents.findUnique({
      where: {
        userName_ticketId: {
          userName,
          ticketId
        }
      },
      include: {
        ticket: {
          select: {
            id: true,
            eventId: true,
            recipient: true,
            purchaser: true
          }
        }
      }
    });

    return refundedEvent;
  }

  // Get count of refunded events
  static async getRefundedEventsCount(): Promise<number> {
    return await prisma.refundedEvents.count();
  }

  // Get count of refunded events by user name
  static async getRefundedEventsCountByUserName(userName: string): Promise<number> {
    return await prisma.refundedEvents.count({
      where: { userName }
    });
  }

  // Get summary statistics
  static async getRefundedEventsSummary(): Promise<{
    totalRefunds: number;
    uniqueUsers: number;
    uniqueTickets: number;
    recentRefunds: RefundedEvent[];
  }> {
    const [
      totalRefunds,
      uniqueUsers,
      uniqueTickets,
      recentRefunds
    ] = await Promise.all([
      prisma.refundedEvents.count(),
      prisma.refundedEvents.groupBy({ by: ['userName'] }).then(result => result.length),
      prisma.refundedEvents.groupBy({ by: ['ticketId'] }).then(result => result.length),
      prisma.refundedEvents.findMany({
        take: 10,
        orderBy: { userName: 'asc' },
        include: {
          ticket: {
            select: {
              id: true,
              eventId: true,
              recipient: true,
              purchaser: true
            }
          }
        }
      })
    ]);

    return {
      totalRefunds,
      uniqueUsers,
      uniqueTickets,
      recentRefunds
    };
  }
}