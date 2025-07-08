import { NextApiRequest, NextApiResponse } from 'next';
import { ScheduleService } from '@/lib/services/server/scheduleService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      console.log('Schedule API: Starting to fetch schedule data');
      const result = await ScheduleService.getScheduleData();
      console.log('Schedule API: Successfully fetched schedule data:', result.scheduleData?.length, 'users');
      return res.status(200).json(result);
    } catch (error) {
      console.error('Schedule API: Error fetching schedule data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'Unknown';
      
      console.error('Schedule API: Error details:', {
        message: errorMessage,
        stack: errorStack,
        name: errorName
      });
      return res.status(500).json({ 
        error: 'Failed to fetch schedule data',
        details: errorMessage 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
