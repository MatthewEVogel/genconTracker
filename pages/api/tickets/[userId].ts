import { NextApiRequest, NextApiResponse } from 'next';
import { getUserTicketAssignment, recalculateAndSaveTicketAssignments } from '@/utils/ticketAssignmentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Get user's ticket assignment from database
      const result = await getUserTicketAssignment(userId);

      if (!result) {
        // No assignments exist yet, trigger initial calculation
        await recalculateAndSaveTicketAssignments();
        const newResult = await getUserTicketAssignment(userId);
        
        if (!newResult) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        return res.status(200).json({
          assignment: newResult.assignment,
          errors: newResult.calculationRun.errors.filter((error: string) => 
            error.includes(newResult.assignment.userName)
          ),
          lastCalculated: newResult.calculationRun.createdAt,
          calculationId: newResult.calculationRun.id,
          recalculated: true
        });
      }

      return res.status(200).json({
        assignment: result.assignment,
        errors: result.calculationRun.errors.filter((error: string) => 
          error.includes(result.assignment.userName)
        ),
        lastCalculated: result.calculationRun.createdAt,
        calculationId: result.calculationRun.id,
        recalculated: false
      });
    } catch (error) {
      console.error('Error getting user ticket assignment:', error);
      return res.status(500).json({ error: 'Failed to get ticket assignment' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
