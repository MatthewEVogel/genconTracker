import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

interface TransactionWithDetails {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
  type: 'purchase' | 'refund';
  createdAt: Date;
  refundId?: string;
  eventTitle?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetTransactions(req, res);
  } else if (req.method === 'DELETE') {
    return handleDeleteTransaction(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

async function handleGetTransactions(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { adminUserId } = req.query;

    if (!adminUserId || typeof adminUserId !== 'string') {
      return res.status(400).json({ error: 'Admin user ID is required' });
    }

    // Verify the requesting user is an admin
    const adminUser = await prisma.userList.findUnique({
      where: { id: adminUserId }
    });

    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Fetch all purchased events with their refund information
    const purchasedEvents = await prisma.purchasedEvents.findMany({
      include: {
        refundedEvents: true
      },
      orderBy: {
        eventId: 'asc'
      }
    });

    // Fetch event details for better display
    const eventIds = [...new Set(purchasedEvents.map(pe => pe.eventId))];
    const events = await prisma.eventsList.findMany({
      where: {
        id: { in: eventIds }
      },
      select: {
        id: true,
        title: true
      }
    });

    const eventTitleMap = events.reduce((acc, event) => {
      acc[event.id] = event.title;
      return acc;
    }, {} as Record<string, string>);

    // Transform data for admin view
    const transactions: TransactionWithDetails[] = [];

    // Add purchases
    purchasedEvents.forEach(purchase => {
      transactions.push({
        id: purchase.id,
        eventId: purchase.eventId,
        recipient: purchase.recipient,
        purchaser: purchase.purchaser,
        type: 'purchase',
        createdAt: (purchase as any).createdAt || new Date(),
        eventTitle: eventTitleMap[purchase.eventId] || 'Unknown Event'
      });

      // Add refunds for this purchase
      purchase.refundedEvents.forEach(refund => {
        transactions.push({
          id: refund.id,
          eventId: purchase.eventId,
          recipient: refund.userName,
          purchaser: purchase.purchaser,
          type: 'refund',
          createdAt: (refund as any).createdAt || new Date(),
          refundId: refund.id,
          eventTitle: eventTitleMap[purchase.eventId] || 'Unknown Event'
        });
      });
    });

    // Sort transactions by createdAt (newest first)
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Group transactions by user for better organization
    const transactionsByUser = transactions.reduce((acc, transaction) => {
      const key = transaction.purchaser;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(transaction);
      return acc;
    }, {} as Record<string, TransactionWithDetails[]>);

    return res.status(200).json({
      transactions,
      transactionsByUser,
      totalPurchases: purchasedEvents.length,
      totalRefunds: purchasedEvents.reduce((sum, pe) => sum + pe.refundedEvents.length, 0)
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function handleDeleteTransaction(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { adminUserId, transactionId, transactionType } = req.body;

    if (!adminUserId || !transactionId || !transactionType) {
      return res.status(400).json({ error: 'Admin user ID, transaction ID, and transaction type are required' });
    }

    // Verify the requesting user is an admin
    const adminUser = await prisma.userList.findUnique({
      where: { id: adminUserId }
    });

    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (transactionType === 'purchase') {
      // Delete purchase and all associated refunds (cascade delete)
      const deletedPurchase = await prisma.purchasedEvents.delete({
        where: { id: transactionId },
        include: {
          refundedEvents: true
        }
      });

      return res.status(200).json({
        success: true,
        message: `Deleted purchase for event ${deletedPurchase.eventId} and ${deletedPurchase.refundedEvents.length} associated refunds`,
        deletedPurchase,
        deletedRefunds: deletedPurchase.refundedEvents.length
      });

    } else if (transactionType === 'refund') {
      // Delete only the refund
      const deletedRefund = await prisma.refundedEvents.delete({
        where: { id: transactionId },
        include: {
          ticket: true
        }
      });

      return res.status(200).json({
        success: true,
        message: `Deleted refund for event ${deletedRefund.ticket.eventId}`,
        deletedRefund
      });

    } else {
      return res.status(400).json({ error: 'Invalid transaction type. Must be "purchase" or "refund"' });
    }

  } catch (error) {
    console.error('Error deleting transaction:', error);
    
    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Transaction not found' });
      }
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
