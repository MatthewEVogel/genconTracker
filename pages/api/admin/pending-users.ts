import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { UserListService } from '@/lib/services/server/userListService';

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

    // Check if user is admin
    if (!session.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (req.method === 'GET') {
      // Get all pending users
      const data = await UserListService.getPendingUsers();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { userId, action } = req.body;

      if (!userId || !action) {
        return res.status(400).json({ error: 'User ID and action are required' });
      }

      if (action === 'approve') {
        const data = await UserListService.approveUser(userId);
        return res.status(200).json({ 
          message: 'User approved successfully',
          user: data.userList 
        });
      } else if (action === 'reject') {
        await UserListService.rejectUser(userId);
        return res.status(200).json({ 
          message: 'User rejected and account deleted' 
        });
      } else {
        return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject"' });
      }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in pending-users API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
