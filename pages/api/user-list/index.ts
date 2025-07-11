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

    if (req.method === 'GET') {
      // Get all users
      const data = await UserListService.getAllUsers();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { firstName, lastName, email, isAdmin, googleId, provider, image, emailNotifications, pushNotifications } = req.body;

      // Validate required fields
      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return res.status(400).json({ error: 'First name is required' });
      }
      if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        return res.status(400).json({ error: 'Last name is required' });
      }
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if user already exists
      const emailExists = await UserListService.userExistsByEmail(email);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Check if this is the admin account
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const isAdminAccount = trimmedEmail === 'matthewvogel1729@gmail.com' && 
                            trimmedFirstName === 'm-admin' && 
                            trimmedLastName === 'v-admin';

      // Create user
      const data = await UserListService.createUser({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        isAdmin: isAdminAccount || isAdmin || false,
        googleId,
        provider: provider || 'manual',
        image,
        emailNotifications: emailNotifications || false,
        pushNotifications: pushNotifications || false,
      });

      return res.status(201).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error in user-list API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}