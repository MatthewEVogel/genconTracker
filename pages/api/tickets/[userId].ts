import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { calculateTicketAssignments } from '@/utils/ticketAlgorithm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Verify the user exists
    const requestedUser = await prisma.userList.findUnique({
      where: { id: userId }
    });

    if (!requestedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all users for the algorithm
    const allUsers = await prisma.userList.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    const formattedUsers = allUsers.map(user => ({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`
    }));

    // Get all desired events (user events) for the algorithm
    const desiredEvents = await prisma.desiredEvents.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        eventsList: {
          select: {
            id: true,
            title: true,
            cost: true,
            priority: true
          }
        }
      }
    });

    // Format the data for the ticket algorithm
    const userEventsData = desiredEvents.map(de => ({
      userId: de.user.id,
      userName: `${de.user.firstName} ${de.user.lastName}`,
      eventId: de.eventsList.id,
      eventTitle: de.eventsList.title,
      cost: de.eventsList.cost?.toString() || '0',
      eventPriority: de.eventsList.priority || 1
    }));

    // Calculate ticket assignments
    const { assignments, errors } = calculateTicketAssignments(userEventsData, formattedUsers);

    // Find the assignment for the requested user
    const userAssignment = assignments.find(a => a.userId === userId);

    if (!userAssignment) {
      return res.status(200).json({
        assignment: null,
        errors: ['No assignment found for user'],
        lastCalculated: new Date().toISOString()
      });
    }

    return res.status(200).json({
      assignment: userAssignment,
      errors,
      lastCalculated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error calculating ticket assignments:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
