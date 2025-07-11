import { prisma } from '@/lib/prisma';

export interface RefundedEvent {
  id: string;
  userId: string;
  ticketId: string;
  createdAt: Date;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  ticket?: {
    id: string;
    eventId: string;
    recipient: string;
    purchaser: string;
  };
}

export interface CreateRefundedEventData {
  userId: string;
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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
        createdAt: 'desc'
      }
    });

    return { refundedEvents };
  }

  // Get refunded events by user ID
  static async getRefundedEventsByUserId(userId: string, includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const refundedEvents = await prisma.refundedEvents.findMany({
      where: { userId },
      include: includeDetails ? {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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
        createdAt: 'desc'
      }
    });

    return { refundedEvents };
  }

  // Get refunded events by ticket ID
  static async getRefundedEventsByTicketId(ticketId: string, includeDetails?: boolean): Promise<RefundedEventsResponse> {
    const refundedEvents = await prisma.refundedEvents.findMany({
      where: { ticketId },
      include: includeDetails ? {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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
        createdAt: 'desc'
      }
    });

    return { refundedEvents };
  }

  // Create a new refunded event record
  static async createRefundedEvent(data: CreateRefundedEventData): Promise<RefundedEventResponse> {
    // Check if this refund record already exists
    const existing = await prisma.refundedEvents.findUnique({
      where: {
        userId_ticketId: {
          userId: data.userId,
          ticketId: data.ticketId
        }
      }
    });

    if (existing) {
      throw new Error('This ticket has already been marked as refunded for this user');
    }

    // Verify that the user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    });

    if (!user) {
      throw new Error('User not found');
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
        userId: data.userId,
        ticketId: data.ticketId
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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
  static async isTicketRefunded(userId: string, ticketId: string): Promise<boolean> {
    const refundedEvent = await prisma.refundedEvents.findUnique({
      where: {
        userId_ticketId: {
          userId,
          ticketId
        }
      }
    });

    return !!refundedEvent;
  }

  // Get a specific refunded event record
  static async getRefundedEvent(userId: string, ticketId: string): Promise<RefundedEvent | null> {
    const refundedEvent = await prisma.refundedEvents.findUnique({
      where: {
        userId_ticketId: {
          userId,
          ticketId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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

  // Get count of refunded events by user
  static async getRefundedEventsCountByUser(userId: string): Promise<number> {
    return await prisma.refundedEvents.count({
      where: { userId }
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
      prisma.refundedEvents.groupBy({ by: ['userId'] }).then(result => result.length),
      prisma.refundedEvents.groupBy({ by: ['ticketId'] }).then(result => result.length),
      prisma.refundedEvents.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
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