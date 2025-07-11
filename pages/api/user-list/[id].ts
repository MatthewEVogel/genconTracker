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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Valid user ID is required' });
    }

    if (req.method === 'GET') {
      // Get user by ID
      const data = await UserListService.getUserById(id);
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const { firstName, lastName, email, isAdmin, googleId, provider, image, emailNotifications, pushNotifications } = req.body;

      // Validate required fields
      if (firstName !== undefined && (!firstName || typeof firstName !== 'string' || !firstName.trim())) {
        return res.status(400).json({ error: 'First name is required' });
      }
      if (lastName !== undefined && (!lastName || typeof lastName !== 'string' || !lastName.trim())) {
        return res.status(400).json({ error: 'Last name is required' });
      }
      if (email !== undefined && (!email || typeof email !== 'string' || !email.trim())) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format if provided
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
      }

      // Update user
      const data = await UserListService.updateUser(id, {
        firstName,
        lastName,
        email,
        isAdmin,
        googleId,
        provider,
        image,
        emailNotifications,
        pushNotifications,
      });

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      // Delete user
      await UserListService.deleteUser(id);
      return res.status(200).json({ message: 'User deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in user-list/[id] API:', error);
    
    // Handle specific error cases
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}