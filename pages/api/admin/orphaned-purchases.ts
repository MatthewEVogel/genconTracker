import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

interface OrphanedPurchase {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
  createdAt: Date;
  eventTitle?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Admin authentication check
  const { adminUserId } = req.query;
  
  if (!adminUserId || typeof adminUserId !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: Admin user ID required' });
  }

  // Verify the user is an admin
  const admin = await prisma.userList.findUnique({
    where: { id: adminUserId }
  });

  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }

  if (req.method === 'GET') {
    try {
      // Get all purchased events (excluding refunded ones)
      const purchasedEvents = await prisma.purchasedEvents.findMany({
        include: {
          refundedEvents: true
        }
      });

      // Filter to only active purchases (not refunded)
      const activePurchases = purchasedEvents.filter(
        pe => pe.refundedEvents.length === 0
      );

      // Get all users with their genConNames
      const users = await prisma.userList.findMany({
        select: { genConName: true }
      });

      // Create a set of normalized valid genConNames
      const validNames = new Set(
        users.map(u => u.genConName.toLowerCase().trim())
      );

      // Identify orphaned purchases (recipients that don't match any user's genConName)
      const orphanedPurchases = activePurchases.filter(
        pe => !validNames.has(pe.recipient.toLowerCase().trim())
      );

      // Get event details for orphaned purchases
      const eventIds = [...new Set(orphanedPurchases.map(pe => pe.eventId))];
      const events = await prisma.eventsList.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, title: true }
      });

      const eventsMap = new Map(events.map(e => [e.id, e.title]));

      // Format the response with event titles
      const orphanedWithDetails: OrphanedPurchase[] = orphanedPurchases.map(pe => ({
        id: pe.id,
        eventId: pe.eventId,
        recipient: pe.recipient,
        purchaser: pe.purchaser,
        createdAt: pe.createdAt,
        eventTitle: eventsMap.get(pe.eventId) || 'Unknown Event'
      }));

      // Calculate summary stats
      const uniqueRecipients = new Set(orphanedPurchases.map(pe => pe.recipient));
      const uniqueEvents = new Set(orphanedPurchases.map(pe => pe.eventId));

      return res.status(200).json({
        orphanedPurchases: orphanedWithDetails,
        summary: {
          total: orphanedPurchases.length,
          uniqueRecipients: uniqueRecipients.size,
          uniqueEvents: uniqueEvents.size,
          recipientNames: Array.from(uniqueRecipients)
        }
      });
    } catch (error) {
      console.error('Error fetching orphaned purchases:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch orphaned purchases',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      console.log('[Orphaned Purchases API] DELETE request received');
      console.log('[Orphaned Purchases API] Admin user:', adminUserId);
      
      const { purchaseIds } = req.body;
      console.log('[Orphaned Purchases API] Purchase IDs to delete:', purchaseIds);

      if (!purchaseIds || !Array.isArray(purchaseIds) || purchaseIds.length === 0) {
        console.error('[Orphaned Purchases API] Invalid purchaseIds:', purchaseIds);
        return res.status(400).json({ error: 'Invalid request: purchaseIds array required' });
      }

      console.log(`[Orphaned Purchases API] Attempting to delete ${purchaseIds.length} purchase(s)...`);

      // Delete the orphaned purchases (this will cascade delete any associated refunds)
      const deleteResult = await prisma.purchasedEvents.deleteMany({
        where: {
          id: { in: purchaseIds }
        }
      });

      console.log(`[Orphaned Purchases API] Successfully deleted ${deleteResult.count} purchase(s)`);

      return res.status(200).json({
        message: `Successfully deleted ${deleteResult.count} orphaned purchase(s)`,
        deletedCount: deleteResult.count
      });
    } catch (error) {
      console.error('[Orphaned Purchases API] Error deleting orphaned purchases:', error);
      return res.status(500).json({ 
        error: 'Failed to delete orphaned purchases',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
