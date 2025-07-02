import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseGenConTickets } from '@/utils/ticketParser';

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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Parse the tickets from the text
    const parsedTickets = parseGenConTickets(text);

    if (parsedTickets.length === 0) {
      return res.status(400).json({ error: 'No valid tickets found in the text' });
    }

    // Save tickets to database
    const savedTickets = [];
    for (const ticket of parsedTickets) {
      const savedTicket = await prisma.purchasedTicket.create({
        data: {
          eventId: ticket.eventId,
          eventName: ticket.eventName,
          recipient: ticket.recipient,
          purchaser: `${user.firstName} ${user.lastName}`,
        }
      });
      savedTickets.push(savedTicket);
    }

    // Now recalculate duplicates across ALL tickets in the database
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
      message: `Successfully parsed ${parsedTickets.length} tickets`,
      ticketsAdded: savedTickets.length,
      refundTickets
    });

  } catch (error: any) {
    console.error('Error parsing tickets:', error);
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

  console.log('DEBUG: Total tickets found:', allTickets.length);

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

  console.log('DEBUG: Ticket groups:', Array.from(ticketGroups.entries()).map(([key, tickets]) => ({
    key,
    count: tickets.length,
    tickets: tickets.map(t => ({ id: t.id, eventId: t.eventId, recipient: t.recipient, purchaser: t.purchaser }))
  })));

  // Mark duplicates for refund
  for (const [key, tickets] of ticketGroups) {
    if (tickets.length > 1) {
      console.log(`DEBUG: Found ${tickets.length} duplicates for key: ${key}`);
      // Multiple tickets for same event+recipient combination (duplicate!)
      // Keep the first ticket (earliest), mark others for refund
      const ticketsToRefund = tickets.slice(1);
      
      for (const ticket of ticketsToRefund) {
        console.log(`DEBUG: Marking ticket ${ticket.id} for refund (${ticket.eventId} - ${ticket.recipient})`);
        await prisma.purchasedTicket.update({
          where: { id: ticket.id },
          data: { needsRefund: true }
        });
      }
    }
  }
}
