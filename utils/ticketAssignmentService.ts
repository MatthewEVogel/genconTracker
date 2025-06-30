import { prisma } from '@/lib/prisma';
import { calculateTicketAssignments } from './ticketAlgorithm';

interface UserEventData {
  userId: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  priority: number;
  cost: string;
}

export async function recalculateAndSaveTicketAssignments(): Promise<{
  calculationId: string;
  totalUsers: number;
  totalEvents: number;
  errors: string[];
}> {
  try {
    // Get all users with their events and priorities
    const users = await prisma.user.findMany({
      include: {
        userEvents: {
          include: {
            event: true
          }
        }
      }
    });

    // Transform data for the algorithm
    const userEventData: UserEventData[] = users.flatMap(user =>
      user.userEvents.map(userEvent => ({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        eventId: userEvent.event.id,
        eventTitle: userEvent.event.title,
        priority: userEvent.priority,
        cost: userEvent.event.cost || '0'
      }))
    );

    // Prepare all users list (including those with no events)
    const allUsers = users.map(user => ({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`
    }));

    // Calculate ticket assignments with all users
    const { assignments, errors } = calculateTicketAssignments(userEventData, allUsers);

    // Create a new calculation run
    const calculationRun = await prisma.calculationRun.create({
      data: {
        totalUsers: users.length,
        totalEvents: new Set(userEventData.map(ue => ue.eventId)).size,
        errors: JSON.stringify(errors)
      }
    });

    // Clear old assignments (keep only the latest calculation)
    await prisma.ticketAssignment.deleteMany({
      where: {
        calculationId: {
          not: calculationRun.id
        }
      }
    });

    // Save new assignments to database
    const assignmentPromises = assignments.flatMap(assignment =>
      assignment.events.map(event =>
        prisma.ticketAssignment.create({
          data: {
            userId: assignment.userId,
            eventId: event.eventId,
            calculationId: calculationRun.id,
            buyingFor: JSON.stringify(event.buyingFor),
            priority: event.priority,
            cost: event.cost
          }
        })
      )
    );

    await Promise.all(assignmentPromises);

    console.log(`Ticket assignments recalculated. Calculation ID: ${calculationRun.id}`);
    console.log(`Total assignments created: ${assignmentPromises.length}`);

    return {
      calculationId: calculationRun.id,
      totalUsers: users.length,
      totalEvents: new Set(userEventData.map(ue => ue.eventId)).size,
      errors
    };

  } catch (error) {
    console.error('Error recalculating ticket assignments:', error);
    throw error;
  }
}

export async function getLatestTicketAssignments() {
  try {
    // Get the latest calculation run
    const latestCalculation = await prisma.calculationRun.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          include: {
            user: true,
            event: true
          }
        }
      }
    });

    if (!latestCalculation) {
      return null;
    }

    // Transform to the expected format
    const userAssignments = new Map<string, any>();

    for (const assignment of latestCalculation.assignments) {
      if (!userAssignments.has(assignment.userId)) {
        userAssignments.set(assignment.userId, {
          userId: assignment.userId,
          userName: `${assignment.user.firstName} ${assignment.user.lastName}`,
          events: [],
          totalTickets: 0
        });
      }

      const userAssignment = userAssignments.get(assignment.userId);
      userAssignment.events.push({
        eventId: assignment.eventId,
        eventTitle: assignment.event.title,
        priority: assignment.priority,
        buyingFor: JSON.parse(assignment.buyingFor),
        cost: assignment.cost
      });
      userAssignment.totalTickets += 1;
    }

    return {
      assignments: Array.from(userAssignments.values()),
      calculationRun: {
        id: latestCalculation.id,
        createdAt: latestCalculation.createdAt,
        totalUsers: latestCalculation.totalUsers,
        totalEvents: latestCalculation.totalEvents,
        errors: JSON.parse(latestCalculation.errors)
      }
    };

  } catch (error) {
    console.error('Error getting latest ticket assignments:', error);
    throw error;
  }
}

export async function getUserTicketAssignment(userId: string) {
  try {
    // Get the latest calculation run
    const latestCalculation = await prisma.calculationRun.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!latestCalculation) {
      return null;
    }

    // Get assignments for this user
    const assignments = await prisma.ticketAssignment.findMany({
      where: {
        userId,
        calculationId: latestCalculation.id
      },
      include: {
        event: true,
        user: true
      }
    });

    if (assignments.length === 0) {
      // User exists but has no assignments
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return null;
      }

      return {
        assignment: {
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          events: [],
          totalTickets: 0
        },
        calculationRun: {
          id: latestCalculation.id,
          createdAt: latestCalculation.createdAt,
          totalUsers: latestCalculation.totalUsers,
          totalEvents: latestCalculation.totalEvents,
          errors: JSON.parse(latestCalculation.errors)
        }
      };
    }

    // Transform to expected format
    const userAssignment = {
      userId,
      userName: `${assignments[0].user.firstName} ${assignments[0].user.lastName}`,
      events: assignments.map(assignment => ({
        eventId: assignment.eventId,
        eventTitle: assignment.event.title,
        priority: assignment.priority,
        buyingFor: JSON.parse(assignment.buyingFor),
        cost: assignment.cost
      })),
      totalTickets: assignments.length
    };

    return {
      assignment: userAssignment,
      calculationRun: {
        id: latestCalculation.id,
        createdAt: latestCalculation.createdAt,
        totalUsers: latestCalculation.totalUsers,
        totalEvents: latestCalculation.totalEvents,
        errors: JSON.parse(latestCalculation.errors)
      }
    };

  } catch (error) {
    console.error('Error getting user ticket assignment:', error);
    throw error;
  }
}
