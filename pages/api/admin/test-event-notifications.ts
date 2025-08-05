import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEventUpdateNotifications } from '@/utils/notificationService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database to check admin status
    const user = await prisma.userList.findUnique({
      where: { email: session.user.email! }
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    // Get the event to test with
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId },
      include: {
        trackedBy: {
          where: {
            emailNotifications: true
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            emailNotifications: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    console.log(`Testing event update notifications for event: ${event.title}`);
    console.log(`Users tracking this event with notifications enabled: ${event.trackedBy.length}`);

    // Send test event update notifications
    const result = await sendEventUpdateNotifications(
      eventId,
      event.title,
      ['title', 'location', 'cost'] // Test with multiple changes
    );

    console.log('Event notification test result:', result);

    if (!result.success) {
      return res.status(400).json({ 
        error: (result as any).error || 'Failed to send event update notifications',
        details: result
      });
    }

    res.status(200).json({
      message: 'Test event update notifications sent',
      eventTitle: event.title,
      usersTracking: event.trackedBy.length,
      ...result
    });

  } catch (error) {
    console.error('Error in test-event-notifications API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
