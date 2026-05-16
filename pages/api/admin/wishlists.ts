import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify admin status
    const adminUser = await prisma.userList.findUnique({
      where: { email: session.user.email }
    });

    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    if (req.method === 'GET') {
      // Get all wishlists (desired events) grouped by user
      const wishlists = await prisma.desiredEvents.findMany({
        include: {
          eventsList: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              genConName: true,
              email: true
            }
          }
        },
        orderBy: [
          {
            user: {
              firstName: 'asc'
            }
          },
          {
            eventsList: {
              startDateTime: 'asc'
            }
          }
        ]
      });

      // Group by user
      const wishlistsByUser: Record<string, any> = {};
      wishlists.forEach(item => {
        const userId = item.user.id;
        if (!wishlistsByUser[userId]) {
          wishlistsByUser[userId] = {
            user: item.user,
            events: []
          };
        }
        wishlistsByUser[userId].events.push({
          desiredEventId: item.id,
          event: {
            id: item.eventsList.id,
            title: item.eventsList.title,
            startDateTime: item.eventsList.startDateTime,
            endDateTime: item.eventsList.endDateTime,
            eventType: item.eventsList.eventType,
            location: item.eventsList.location,
            cost: item.eventsList.cost,
            ticketsAvailable: item.eventsList.ticketsAvailable,
            isCanceled: item.eventsList.isCanceled
          }
        });
      });

      // Convert to array
      const wishlistsArray = Object.values(wishlistsByUser);

      return res.status(200).json({
        wishlists: wishlistsArray,
        totalUsers: wishlistsArray.length,
        totalEvents: wishlists.length
      });
    }

    if (req.method === 'DELETE') {
      const { desiredEventId, userId, eventId } = req.body;

      // Allow deletion by either desiredEventId or userId+eventId combination
      if (!desiredEventId && (!userId || !eventId)) {
        return res.status(400).json({ 
          error: 'Either desiredEventId or both userId and eventId are required' 
        });
      }

      let deletedEvent;

      if (desiredEventId) {
        // Delete by desiredEventId
        deletedEvent = await prisma.desiredEvents.delete({
          where: { id: desiredEventId },
          include: {
            eventsList: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                genConName: true
              }
            }
          }
        });
      } else {
        // Delete by userId and eventId
        deletedEvent = await prisma.desiredEvents.delete({
          where: {
            userId_eventsListId: {
              userId,
              eventsListId: eventId
            }
          },
          include: {
            eventsList: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                genConName: true
              }
            }
          }
        });
      }

      return res.status(200).json({
        message: `Successfully removed "${deletedEvent.eventsList.title}" from ${deletedEvent.user.firstName} ${deletedEvent.user.lastName}'s wishlist`,
        deletedEvent
      });
    }

    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in admin wishlists API:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
