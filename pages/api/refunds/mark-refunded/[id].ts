import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Mark ticket as refunded
    const updatedTicket = await prisma.purchasedTicket.update({
      where: { id },
      data: { 
        isRefunded: true,
        needsRefund: false
      }
    });

    // Recalculate duplicates after removing this ticket
    await recalculateDuplicates();

    // Get updated refund list
    const refundTickets = await prisma.purchasedTicket.findMany({
      where: {
        needsRefund: true,
        isRefunded: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      message: 'Ticket marked as refunded',
      refundTickets
    });

  } catch (error: any) {
    console.error('Error marking ticket as refunded:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to recalculate duplicates across all tickets
async function recalculateDuplicates() {
  // Reset all needsRefund flags
  await prisma.purchasedTicket.updateMany({
    data: { needsRefund: false }
  });

  // Get all non-refunded tickets
  const allTickets = await prisma.purchasedTicket.findMany({
    where: { isRefunded: false },
    orderBy: { createdAt: 'asc' } // Keep earliest tickets
  });

  // Group by eventId + recipient combination
  const ticketGroups = new Map<string, any[]>();
  allTickets.forEach(ticket => {
    // Create a unique key combining eventId and recipient
    const key = `${ticket.eventId}|${ticket.recipient}`;
    if (!ticketGroups.has(key)) {
      ticketGroups.set(key, []);
    }
    ticketGroups.get(key)!.push(ticket);
  });

  // Mark duplicates for refund
  for (const [key, tickets] of ticketGroups) {
    if (tickets.length > 1) {
      // Multiple tickets for same event+recipient combination (duplicate!)
      // Keep the first ticket (earliest), mark others for refund
      const ticketsToRefund = tickets.slice(1);
      
      for (const ticket of ticketsToRefund) {
        await prisma.purchasedTicket.update({
          where: { id: ticket.id },
          data: { needsRefund: true }
        });
      }
    }
  }
}
