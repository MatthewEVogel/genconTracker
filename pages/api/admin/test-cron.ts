import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication and admin status
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user from database to check admin status
    const user = await prisma.userList.findUnique({
      where: { email: session.user.email },
      select: { id: true, isAdmin: true, firstName: true, lastName: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log(`Admin ${user.firstName} ${user.lastName} (${user.id}) testing cron endpoint`);

    // Test the cron endpoint
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res.status(500).json({ error: 'CRON_SECRET not configured' });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const cronUrl = `${baseUrl}/api/cron/update-events`;

    const response = await fetch(cronUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    return res.status(response.status).json({
      ...result,
      testInfo: {
        testedBy: `${user.firstName} ${user.lastName}`,
        cronUrl,
        status: response.status
      }
    });

  } catch (error) {
    console.error('Error testing cron endpoint:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return res.status(500).json({
      error: `Test failed: ${errorMessage}`
    });
  }
}