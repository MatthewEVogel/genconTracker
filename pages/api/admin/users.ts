import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId || typeof adminUserId !== 'string') {
        return res.status(400).json({ error: 'Admin user ID is required' });
      }

      // Verify the requesting user is an admin
      const adminUser = await prisma.userList.findUnique({
        where: { id: adminUserId }
      });

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Get all users
      const users = await prisma.userList.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isAdmin: true,
          createdAt: true,
          _count: {
            select: {
              desiredEvents: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({ users });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { adminUserId, userIdToUpdate, isAdmin } = req.body;

      if (!adminUserId || typeof adminUserId !== 'string') {
        return res.status(400).json({ error: 'Admin user ID is required' });
      }

      if (!userIdToUpdate || typeof userIdToUpdate !== 'string') {
        return res.status(400).json({ error: 'User ID to update is required' });
      }

      if (typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: 'isAdmin must be a boolean value' });
      }

      // Verify the requesting user is an admin
      const adminUser = await prisma.userList.findUnique({
        where: { id: adminUserId }
      });

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Prevent admin from removing their own admin status
      if (adminUserId === userIdToUpdate && !isAdmin) {
        return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
      }

      // Get user to update for logging
      const userToUpdate = await prisma.userList.findUnique({
        where: { id: userIdToUpdate },
        select: { firstName: true, lastName: true, email: true, isAdmin: true }
      });

      if (!userToUpdate) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user admin status
      const updatedUser = await prisma.userList.update({
        where: { id: userIdToUpdate },
        data: { isAdmin: isAdmin }
      });

      console.log(`Admin ${adminUser.email} ${isAdmin ? 'granted' : 'revoked'} admin privileges for: ${userToUpdate.email}`);
      res.status(200).json({ 
        message: `User admin status updated successfully`,
        updatedUser: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          isAdmin: updatedUser.isAdmin
        }
      });
    } catch (error: any) {
      console.error('Error updating user admin status:', error);
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else if (req.method === 'DELETE') {
    try {
      const { adminUserId, userIdToDelete } = req.body;

      if (!adminUserId || typeof adminUserId !== 'string') {
        return res.status(400).json({ error: 'Admin user ID is required' });
      }

      if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        return res.status(400).json({ error: 'User ID to delete is required' });
      }

      // Verify the requesting user is an admin
      const adminUser = await prisma.userList.findUnique({
        where: { id: adminUserId }
      });

      if (!adminUser || !adminUser.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Prevent admin from deleting themselves
      if (adminUserId === userIdToDelete) {
        return res.status(400).json({ error: 'Cannot delete your own admin account' });
      }

      // Get user to delete for logging
      const userToDelete = await prisma.userList.findUnique({
        where: { id: userIdToDelete },
        select: { firstName: true, lastName: true, email: true, isAdmin: true }
      });

      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deleting other admin accounts
      if (userToDelete.isAdmin) {
        return res.status(400).json({ error: 'Cannot delete other admin accounts' });
      }

      // Delete user (cascade will handle related records)
      await prisma.userList.delete({
        where: { id: userIdToDelete }
      });

      console.log(`Admin ${adminUser.email} deleted user: ${userToDelete.email}`);
      res.status(200).json({ 
        message: 'User deleted successfully',
        deletedUser: {
          firstName: userToDelete.firstName,
          lastName: userToDelete.lastName,
          email: userToDelete.email
        }
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
