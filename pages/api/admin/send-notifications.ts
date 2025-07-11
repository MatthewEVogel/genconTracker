import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAndSendRegistrationReminders, sendTestNotifications } from '@/utils/notificationService';

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
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database to check admin status
    const user = await prisma.userList.findUnique({
      where: { email: session.user.email! }
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if this is a test request
    const { test } = req.body;
    
    let result;
    if (test) {
      // Send test notifications immediately
      result = await sendTestNotifications();
    } else {
      // Check and send registration reminders based on timing
      result = await checkAndSendRegistrationReminders();
    }

    if (!result.success) {
      return res.status(400).json({ 
        error: result.message || result.error || 'Failed to send notifications' 
      });
    }

    res.status(200).json({
      message: test ? 'Test notifications sent' : 'Notification check completed',
      ...result
    });

  } catch (error) {
    console.error('Error in send-notifications API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
