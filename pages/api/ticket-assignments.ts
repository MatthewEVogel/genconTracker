import { NextApiRequest, NextApiResponse } from 'next';
import { getLatestTicketAssignments, recalculateAndSaveTicketAssignments } from '@/utils/ticketAssignmentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { recalculate } = req.query;
      
      // If recalculate is requested, run the algorithm and save to database
      if (recalculate === 'true') {
        const result = await recalculateAndSaveTicketAssignments();
        const latestAssignments = await getLatestTicketAssignments();
        
        return res.status(200).json({
          assignments: latestAssignments?.assignments || [],
          errors: result.errors,
          totalUsers: result.totalUsers,
          totalEvents: result.totalEvents,
          calculationId: result.calculationId,
          recalculated: true
        });
      }
      
      // Otherwise, get the latest stored assignments
      const latestAssignments = await getLatestTicketAssignments();
      
      if (!latestAssignments) {
        // No assignments exist, trigger initial calculation
        const result = await recalculateAndSaveTicketAssignments();
        const newAssignments = await getLatestTicketAssignments();
        
        return res.status(200).json({
          assignments: newAssignments?.assignments || [],
          errors: result.errors,
          totalUsers: result.totalUsers,
          totalEvents: result.totalEvents,
          calculationId: result.calculationId,
          recalculated: true
        });
      }
      
      return res.status(200).json({
        assignments: latestAssignments.assignments,
        errors: latestAssignments.calculationRun.errors,
        totalUsers: latestAssignments.calculationRun.totalUsers,
        totalEvents: latestAssignments.calculationRun.totalEvents,
        calculationId: latestAssignments.calculationRun.id,
        lastCalculated: latestAssignments.calculationRun.createdAt,
        recalculated: false
      });
    } catch (error) {
      console.error('Error getting ticket assignments:', error);
      return res.status(500).json({ error: 'Failed to get ticket assignments' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
