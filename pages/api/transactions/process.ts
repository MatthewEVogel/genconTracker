import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

interface ParsedTransaction {
  eventId: string;
  recipient: string;
  amount: string;
  type: 'purchase' | 'refund';
  description: string;
}

interface ProcessTransactionsRequest {
  userId: string;
  transactions: ParsedTransaction[];
  year: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { userId, transactions, year }: ProcessTransactionsRequest = req.body;

    if (!userId || !transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Verify user exists
    const user = await prisma.userList.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let savedPurchases = 0;
    let savedRefunds = 0;
    const errors: string[] = [];

    // Process each transaction
    for (const transaction of transactions) {
      try {
        if (transaction.type === 'purchase') {
          // Save to PurchasedEvents table
          await prisma.purchasedEvents.create({
            data: {
              eventId: transaction.eventId,
              recipient: transaction.recipient,
              purchaser: user.email // Use the user's email as purchaser
            }
          });
          savedPurchases++;
        } else if (transaction.type === 'refund') {
          // For refunds, we need to find the corresponding purchase first
          const purchasedEvent = await prisma.purchasedEvents.findFirst({
            where: {
              eventId: transaction.eventId,
              recipient: transaction.recipient
            }
          });

          if (purchasedEvent) {
            // Check if refund already exists
            const existingRefund = await prisma.refundedEvents.findUnique({
              where: {
                userName_ticketId: {
                  userName: transaction.recipient,
                  ticketId: purchasedEvent.id
                }
              }
            });

            if (!existingRefund) {
              // Create refund record
              await prisma.refundedEvents.create({
                data: {
                  userName: transaction.recipient,
                  ticketId: purchasedEvent.id
                }
              });
              savedRefunds++;
            } else {
              errors.push(`Refund already exists for ${transaction.eventId} - ${transaction.recipient}`);
            }
          } else {
            // If no purchase found, we might still want to create the purchase record first
            // This handles cases where refunds appear before purchases in the data
            try {
              const newPurchase = await prisma.purchasedEvents.create({
                data: {
                  eventId: transaction.eventId,
                  recipient: transaction.recipient,
                  purchaser: user.email
                }
              });

              // Now create the refund
              await prisma.refundedEvents.create({
                data: {
                  userName: transaction.recipient,
                  ticketId: newPurchase.id
                }
              });
              
              savedPurchases++; // Count the implicit purchase
              savedRefunds++;
            } catch (error) {
              errors.push(`Could not process refund for ${transaction.eventId} - ${transaction.recipient}: ${error}`);
            }
          }
        }
      } catch (error) {
        // Handle duplicate purchases or other database errors
        if (error && typeof error === 'object' && 'code' in error) {
          if (error.code === 'P2002') {
            // Unique constraint violation - likely duplicate purchase
            if (transaction.type === 'purchase') {
              errors.push(`Purchase already exists for ${transaction.eventId} - ${transaction.recipient}`);
            }
          } else {
            errors.push(`Database error for ${transaction.eventId} - ${transaction.recipient}: ${error}`);
          }
        } else {
          errors.push(`Error processing ${transaction.eventId} - ${transaction.recipient}: ${error}`);
        }
      }
    }

    return res.status(200).json({
      savedPurchases,
      savedRefunds,
      errors,
      message: `Processed ${transactions.length} transactions`
    });

  } catch (error) {
    console.error('Error processing transactions:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}