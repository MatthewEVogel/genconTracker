import { NextApiRequest, NextApiResponse } from 'next';
import { updateEventsFromGenCon, UpdateResult } from '@/utils/eventUpdateService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify that this is a cron job request
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Automated event update started via cron job');

    // Perform the event update
    const result: UpdateResult = await updateEventsFromGenCon();

    // Log the result
    if (result.success) {
      console.log('Automated event update completed successfully:', result.stats);
    } else {
      console.error('Automated event update failed:', result.message);
    }

    // Return the result
    return res.status(result.success ? 200 : 500).json(result);

  } catch (error) {
    console.error('Error in automated event update:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return res.status(500).json({
      success: false,
      message: `Server error: ${errorMessage}`,
      stats: {
        downloaded: false,
        totalEvents: 0,
        newEvents: 0,
        updatedEvents: 0,
        canceledEvents: 0,
        deletedEvents: 0,
        errors: [errorMessage]
      }
    });
  }
}