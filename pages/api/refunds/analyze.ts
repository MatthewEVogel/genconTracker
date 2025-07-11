import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyzeRefundCandidates, DuplicateTicket } from '@/utils/refundAlgorithm';
import { PurchasedEvent } from '@/lib/services/server/refundService';

export interface RefundAnalysisResult {
  recipient: string;
  needsRefund: RefundCandidateTicket[];
  alreadyRefunded: RefundedTicketInfo[];
  totalTickets: number;
  ticketsToRefund: number;
}

export interface RefundCandidateTicket {
  id: string;
  eventId: string;
  recipient: string;
  purchaser: string;
  eventTitle?: string;
}

export interface RefundedTicketInfo {
  eventId: string;
  recipient: string;
  refundedCount: number;
}

export interface RefundsAnalysisResponse {
  refundAnalysis: RefundAnalysisResult[];
  summary: {
    totalRecipients: number;
    totalTicketsNeedingRefund: number;
    totalRecipientsNeedingRefunds: number;
  };
  error?: string;
}

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

    if (req.method === 'GET') {
      // Get all purchased events
      const purchasedEvents = await prisma.purchasedEvents.findMany({
        orderBy: [
          { recipient: 'asc' },
          { eventId: 'asc' }
        ]
      });

      // Get all refunded events
      const refundedEvents = await prisma.refundedEvents.findMany({
        include: {
          ticket: {
            select: {
              eventId: true,
              recipient: true
            }
          }
        }
      });

      // Create a map of refunded tickets by recipient and eventId
      const refundedMap = new Map<string, Map<string, number>>();
      refundedEvents.forEach(refund => {
        const recipient = refund.userName.trim().toLowerCase();
        const eventId = refund.ticket.eventId;
        
        if (!refundedMap.has(recipient)) {
          refundedMap.set(recipient, new Map());
        }
        
        const recipientMap = refundedMap.get(recipient)!;
        recipientMap.set(eventId, (recipientMap.get(eventId) || 0) + 1);
      });

      // Use the existing algorithm to find duplicates
      const duplicateAnalysis = analyzeRefundCandidates(purchasedEvents);

      // Process each duplicate group to account for already refunded tickets
      const refundAnalysisResults: RefundAnalysisResult[] = [];

      // Group duplicates by recipient
      const duplicatesByRecipient = new Map<string, DuplicateTicket[]>();
      duplicateAnalysis.duplicates.forEach(duplicate => {
        const normalizedRecipient = duplicate.recipient.trim().toLowerCase();
        if (!duplicatesByRecipient.has(normalizedRecipient)) {
          duplicatesByRecipient.set(normalizedRecipient, []);
        }
        duplicatesByRecipient.get(normalizedRecipient)!.push(duplicate);
      });

      // Process each recipient's duplicates
      for (const [normalizedRecipient, recipientDuplicates] of duplicatesByRecipient) {
        const originalRecipient = recipientDuplicates[0].recipient; // Use original case
        const recipientRefundMap = refundedMap.get(normalizedRecipient) || new Map();
        
        const needsRefund: RefundCandidateTicket[] = [];
        const alreadyRefunded: RefundedTicketInfo[] = [];
        let totalTickets = 0;

        for (const duplicate of recipientDuplicates) {
          const eventId = duplicate.eventId;
          const duplicateCount = duplicate.duplicateTickets.length;
          const refundedCount = recipientRefundMap.get(eventId) || 0;
          
          totalTickets += duplicateCount;

          // Add to already refunded if any exist
          if (refundedCount > 0) {
            alreadyRefunded.push({
              eventId,
              recipient: originalRecipient,
              refundedCount
            });
          }

          // Calculate how many still need refunding
          // We keep 1 ticket and refund the rest, minus any already refunded
          const shouldRefund = duplicateCount - 1; // Total that should be refunded
          const stillNeedsRefund = Math.max(0, shouldRefund - refundedCount);

          if (stillNeedsRefund > 0) {
            // Take the required number of refund candidates
            const ticketsToRefund = duplicate.refundCandidates.slice(0, stillNeedsRefund);
            needsRefund.push(...ticketsToRefund.map(ticket => ({
              id: ticket.id,
              eventId: ticket.eventId,
              recipient: ticket.recipient,
              purchaser: ticket.purchaser
            })));
          }
        }

        // Only include recipients who still need refunds
        if (needsRefund.length > 0) {
          refundAnalysisResults.push({
            recipient: originalRecipient,
            needsRefund,
            alreadyRefunded,
            totalTickets,
            ticketsToRefund: needsRefund.length
          });
        }
      }

      // Sort by recipient name
      refundAnalysisResults.sort((a, b) => a.recipient.localeCompare(b.recipient));

      const summary = {
        totalRecipients: refundAnalysisResults.length,
        totalTicketsNeedingRefund: refundAnalysisResults.reduce((sum, r) => sum + r.ticketsToRefund, 0),
        totalRecipientsNeedingRefunds: refundAnalysisResults.length
      };

      return res.status(200).json({
        refundAnalysis: refundAnalysisResults,
        summary
      } as RefundsAnalysisResponse);
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in refunds analyze API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}