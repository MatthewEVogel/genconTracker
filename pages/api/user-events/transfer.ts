import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Determine if user has permission to transfer
    let canTransfer = false;
    let eventType = '';

    if (existingDesiredEvent) {
      // This is a desired event - check if current user owns it or is admin
      canTransfer = currentUser.isAdmin || currentUser.id === fromUserId;
      eventType = 'desired';
    } else if (activePurchasedEvents.length > 0) {
      // This is a purchased event - check if current user owns it or is admin
      canTransfer = currentUser.isAdmin || 
                   (!!currentUser.genConName && 
                    currentUser.genConName.toLowerCase().trim() === fromUser.genConName.toLowerCase().trim());
      eventType = 'purchased';
    } else {
      return res.status(404).json({ error: 'Event not found in source user schedule' });
    }

    if (!canTransfer) {
      return res.status(403).json({ error: 'You can only transfer your own events or must be an admin' });
    }

    // Get event details for conflict checking
    const event = await prisma.eventsList.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check for conflicts in target user's schedule
    const conflicts = await checkEventConflicts(toUserId, toUser.genConName, event);

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

// Helper function to check for event conflicts
async function checkEventConflicts(userId: string, genConName: string, newEvent: any) {
  const conflicts: Array<{
    id: string;
    title: string;
    startDateTime: string | null;
    endDateTime: string | null;
  }> = [];

  if (!newEvent.startDateTime || !newEvent.endDateTime) {
    return conflicts;
  }

  const newStart = new Date(newEvent.startDateTime);
  const newEnd = new Date(newEvent.endDateTime);

  // Check conflicts with desired events
  const desiredEvents = await prisma.desiredEvents.findMany({
    where: { userId },
    include: { eventsList: true }
  });

  for (const desiredEvent of desiredEvents) {
    const existingEvent = desiredEvent.eventsList;
    if (existingEvent.startDateTime && existingEvent.endDateTime) {
      const existingStart = new Date(existingEvent.startDateTime);
      const existingEnd = new Date(existingEvent.endDateTime);

      // Check for overlap
      if (newStart < existingEnd && newEnd > existingStart) {
        conflicts.push({
          id: existingEvent.id,
          title: existingEvent.title,
          startDateTime: existingEvent.startDateTime,
          endDateTime: existingEvent.endDateTime
        });
      }
    }
  }

  // Check conflicts with purchased events
  if (genConName) {
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      where: {
        recipient: {
          equals: genConName,
          mode: 'insensitive'
        }
      },
      include: {
        refundedEvents: true
      }
    });

    // Filter out refunded events and check for conflicts
    const activePurchasedEvents = purchasedEvents.filter(
      pe => pe.refundedEvents.length === 0
    );

    for (const purchasedEvent of activePurchasedEvents) {
      const eventData = await prisma.eventsList.findUnique({
        where: { id: purchasedEvent.eventId }
      });

      if (eventData?.startDateTime && eventData?.endDateTime) {
        const existingStart = new Date(eventData.startDateTime);
        const existingEnd = new Date(eventData.endDateTime);

        // Check for overlap
        if (newStart < existingEnd && newEnd > existingStart) {
          conflicts.push({
            id: eventData.id,
            title: `${eventData.title} (Purchased)`,
            startDateTime: eventData.startDateTime,
            endDateTime: eventData.endDateTime
          });
        }
      }
    }
  }

  return conflicts;
}
