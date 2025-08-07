import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ConflictDetectionService } from '@/lib/services/server/conflictDetectionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { eventId, fromUserId, toUserId } = req.body;

    if (!eventId || !fromUserId || !toUserId) {
      return res.status(400).json({ error: 'Event ID, from user ID, and to user ID are required' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot transfer event to the same user' });
    }

    // Verify the current user has permission to transfer this event
    const currentUser = await prisma.userList.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    // Verify both users exist
    const fromUser = await prisma.userList.findUnique({
      where: { id: fromUserId }
    });

    const toUser = await prisma.userList.findUnique({
      where: { id: toUserId }
    });

    if (!fromUser) {
      return res.status(404).json({ error: 'Source user not found' });
    }

    if (!toUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Check if this is a desired event or purchased event
    const existingDesiredEvent = await prisma.desiredEvents.findUnique({
      where: {
        userId_eventsListId: {
          userId: fromUserId,
          eventsListId: eventId
        }
      }
    });

    // Check if this is a purchased event for the current user
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: {
        eventId: eventId,
        recipient: {
          equals: fromUser.genConName,
          mode: 'insensitive'
        }
      },
      include: {
        refundedEvents: true
      }
    });

    // Filter out refunded events
    const activePurchasedEvents = purchasedEvents.filter(
      pe => pe.refundedEvents.length === 0
    );

    // Determine event type - anyone can transfer any event
    let eventType = '';

    if (existingDesiredEvent) {
      eventType = 'desired';
    } else if (activePurchasedEvents.length > 0) {
      eventType = 'purchased';
    } else {
      return res.status(404).json({ error: 'Event not found in source user schedule' });
    }

    // Get event details for conflict checking
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check for conflicts in target user's schedule using the unified service
    const conflictResult = await ConflictDetectionService.checkConflicts({
      userId: toUserId,
      startTime: event.startDateTime || '',
      endTime: event.endDateTime || ''
    });

    const conflicts = conflictResult.hasConflicts ? conflictResult.conflicts.map(conflict => ({
      id: conflict.id,
      title: conflict.title,
      startDateTime: conflict.startTime,
      endDateTime: conflict.endTime
    })) : [];

    // Perform the transfer based on event type
    let transferResult;
    if (eventType === 'desired') {
      transferResult = await transferDesiredEvent(eventId, fromUserId, toUserId);
    } else {
      transferResult = await transferPurchasedEvent(eventId, fromUser.genConName, toUser.genConName);
    }

    const response: any = {
      message: `Event transferred successfully from ${fromUser.firstName} ${fromUser.lastName} to ${toUser.firstName} ${toUser.lastName}`,
      fromUser: {
        id: fromUser.id,
        name: `${fromUser.firstName} ${fromUser.lastName}`
      },
      toUser: {
        id: toUser.id,
        name: `${toUser.firstName} ${toUser.lastName}`
      },
      eventType
    };

    if (conflicts.length > 0) {
      response.conflicts = conflicts;
      response.warning = `Transfer completed, but the event conflicts with ${conflicts.length} existing event(s) in ${toUser.firstName}'s schedule.`;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error transferring user event:', error);
    return res.status(500).json({ error: 'Failed to transfer event' });
  }
}

// Helper function to transfer desired events
async function transferDesiredEvent(eventId: string, fromUserId: string, toUserId: string) {
  // Check if target user already has this event
  const targetUserEvent = await prisma.desiredEvents.findUnique({
    where: {
      userId_eventsListId: {
        userId: toUserId,
        eventsListId: eventId
      }
    }
  });

  if (targetUserEvent) {
    throw new Error('Target user already has this event in their schedule');
  }

  // Perform the transfer in a transaction
  await prisma.$transaction(async (tx) => {
    // Remove event from source user
    await tx.desiredEvents.delete({
      where: {
        userId_eventsListId: {
          userId: fromUserId,
          eventsListId: eventId
        }
      }
    });

    // Add event to target user
    await tx.desiredEvents.create({
      data: {
        userId: toUserId,
        eventsListId: eventId
      }
    });
  });

  return { success: true };
}

// Helper function to transfer purchased events
async function transferPurchasedEvent(eventId: string, fromGenConName: string, toGenConName: string) {
  // Update all purchased events for this event and recipient
  const updateResult = await prisma.purchasedEvents.updateMany({
    where: {
      eventId: eventId,
      recipient: {
        equals: fromGenConName,
        mode: 'insensitive'
      }
    },
    data: {
      recipient: toGenConName
    }
  });

  if (updateResult.count === 0) {
    throw new Error('No purchased events found to transfer');
  }

  return { success: true, updatedCount: updateResult.count };
}
