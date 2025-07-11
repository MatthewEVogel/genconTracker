// Mock the prisma import first
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  prisma: {
    userList: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { UserListService } from '../../../lib/services/server/userListService';
import { prisma } from '../../../lib/prisma';

// Get the mocked prisma instance
const mockPrisma = prisma as any;

describe('UserListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    isAdmin: false,
    googleId: null,
    provider: 'manual',
    image: null,
    emailNotifications: false,
    pushNotifications: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockAdminUser = {
    id: 'admin-123',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    isAdmin: true,
    googleId: null,
    provider: 'manual',
    image: null,
    emailNotifications: true,
    pushNotifications: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockGoogleUser = {
    id: 'google-123',
    firstName: 'Google',
    lastName: 'User',
    email: 'google.user@gmail.com',
    isAdmin: false,
    googleId: 'google-id-123',
    provider: 'google',
    image: 'https://example.com/avatar.jpg',
    emailNotifications: true,
    pushNotifications: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  describe('createUser', () => {
    it('should successfully create a new user with minimal data', async () => {
      const createData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
      };

      const expectedUser = {
        id: 'user-456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        isAdmin: false,
        googleId: null,
        provider: 'manual',
        image: null,
        emailNotifications: false,
        pushNotifications: false,
        createdAt: new Date(),
      };

      mockPrisma.userList.create.mockResolvedValue(expectedUser);

      const result = await UserListService.createUser(createData);

      expect(result.userList).toEqual(expectedUser);
      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          isAdmin: false,
          googleId: null,
          provider: 'manual',
          image: null,
          emailNotifications: false,
          pushNotifications: false,
        },
      });
    });

    it('should create a user with all optional fields', async () => {
      const createData = {
        firstName: 'Google',
        lastName: 'User',
        email: 'google.user@gmail.com',
        isAdmin: true,
        googleId: 'google-id-456',
        provider: 'google',
        image: 'https://example.com/avatar.jpg',
        emailNotifications: true,
        pushNotifications: true,
      };

      mockPrisma.userList.create.mockResolvedValue(mockGoogleUser);

      const result = await UserListService.createUser(createData);

      expect(result.userList).toEqual(mockGoogleUser);
      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Google',
          lastName: 'User',
          email: 'google.user@gmail.com',
          isAdmin: true,
          googleId: 'google-id-456',
          provider: 'google',
          image: 'https://example.com/avatar.jpg',
          emailNotifications: true,
          pushNotifications: true,
        },
      });
    });

    it('should trim whitespace and convert email to lowercase', async () => {
      const createData = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  JOHN.DOE@EXAMPLE.COM  ',
      };

      const expectedUser = {
        ...mockUser,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      };

      mockPrisma.userList.create.mockResolvedValue(expectedUser);

      await UserListService.createUser(createData);

      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          isAdmin: false,
          googleId: null,
          provider: 'manual',
          image: null,
          emailNotifications: false,
          pushNotifications: false,
        },
      });
    });
  });

  describe('deleteUser', () => {
    it('should successfully delete an existing user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userList.delete.mockResolvedValue(mockUser);

      await UserListService.deleteUser(mockUser.id);

      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(mockPrisma.userList.delete).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw error when trying to delete non-existent user', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        UserListService.deleteUser('non-existent-id')
      ).rejects.toThrow('User not found');

      expect(mockPrisma.userList.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should successfully update user with partial data', async () => {
      const updateData = {
        firstName: 'Johnny',
        email: 'johnny.doe@example.com',
        isAdmin: true,
      };

      const updatedUser = {
        ...mockUser,
        firstName: 'Johnny',
        email: 'johnny.doe@example.com',
        isAdmin: true,
      };

      mockPrisma.userList.update.mockResolvedValue(updatedUser);

      const result = await UserListService.updateUser(mockUser.id, updateData);

      expect(result.userList).toEqual(updatedUser);
      expect(mockPrisma.userList.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          firstName: 'Johnny',
          email: 'johnny.doe@example.com',
          isAdmin: true,
        },
      });
    });

    it('should trim whitespace and convert email to lowercase on update', async () => {
      const updateData = {
        firstName: '  Updated Name  ',
        email: '  UPDATED.EMAIL@EXAMPLE.COM  ',
      };

      const updatedUser = {
        ...mockUser,
        firstName: 'Updated Name',
        email: 'updated.email@example.com',
      };

      mockPrisma.userList.update.mockResolvedValue(updatedUser);

      await UserListService.updateUser(mockUser.id, updateData);

      expect(mockPrisma.userList.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          firstName: 'Updated Name',
          email: 'updated.email@example.com',
        },
      });
    });

    it('should update notification preferences', async () => {
      const updateData = {
        emailNotifications: true,
        pushNotifications: true,
      };

      const updatedUser = {
        ...mockUser,
        emailNotifications: true,
        pushNotifications: true,
      };

      mockPrisma.userList.update.mockResolvedValue(updatedUser);

      const result = await UserListService.updateUser(mockUser.id, updateData);

      expect(result.userList).toEqual(updatedUser);
      expect(mockPrisma.userList.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          emailNotifications: true,
          pushNotifications: true,
        },
      });
    });

    it('should only update provided fields', async () => {
      const updateData = {
        firstName: 'NewName',
      };

      const updatedUser = {
        ...mockUser,
        firstName: 'NewName',
      };

      mockPrisma.userList.update.mockResolvedValue(updatedUser);

      await UserListService.updateUser(mockUser.id, updateData);

      expect(mockPrisma.userList.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          firstName: 'NewName',
        },
      });
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockUser);

      const result = await UserListService.getUserById(mockUser.id);

      expect(result.userList).toEqual(mockUser);
      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw error when user not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        UserListService.getUserById('non-existent-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockUser);

      const result = await UserListService.getUserByEmail(mockUser.email);

      expect(result.userList).toEqual(mockUser);
      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { email: mockUser.email.toLowerCase() },
      });
    });

    it('should convert email to lowercase when searching', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockUser);

      await UserListService.getUserByEmail('JOHN.DOE@EXAMPLE.COM');

      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { email: 'john.doe@example.com' },
      });
    });

    it('should throw error when user not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        UserListService.getUserByEmail('nonexistent@example.com')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getUserByGoogleId', () => {
    it('should return user when found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockGoogleUser);

      const result = await UserListService.getUserByGoogleId(mockGoogleUser.googleId!);

      expect(result.userList).toEqual(mockGoogleUser);
      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { googleId: mockGoogleUser.googleId },
      });
    });

    it('should throw error when user not found', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      await expect(
        UserListService.getUserByGoogleId('non-existent-google-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('should return all users ordered by creation date', async () => {
      const mockUsers = [mockUser, mockAdminUser, mockGoogleUser];
      mockPrisma.userList.findMany.mockResolvedValue(mockUsers);

      const result = await UserListService.getAllUsers();

      expect(result.userLists).toEqual(mockUsers);
      expect(mockPrisma.userList.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no users exist', async () => {
      mockPrisma.userList.findMany.mockResolvedValue([]);

      const result = await UserListService.getAllUsers();

      expect(result.userLists).toEqual([]);
    });
  });

  describe('getAdminUsers', () => {
    it('should return only admin users', async () => {
      const mockAdminUsers = [mockAdminUser];
      mockPrisma.userList.findMany.mockResolvedValue(mockAdminUsers);

      const result = await UserListService.getAdminUsers();

      expect(result.userLists).toEqual(mockAdminUsers);
      expect(mockPrisma.userList.findMany).toHaveBeenCalledWith({
        where: { isAdmin: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no admin users exist', async () => {
      mockPrisma.userList.findMany.mockResolvedValue([]);

      const result = await UserListService.getAdminUsers();

      expect(result.userLists).toEqual([]);
    });
  });

  describe('userExistsByEmail', () => {
    it('should return true when user exists', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockUser);

      const result = await UserListService.userExistsByEmail(mockUser.email);

      expect(result).toBe(true);
      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { email: mockUser.email.toLowerCase() },
      });
    });

    it('should return false when user does not exist', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(null);

      const result = await UserListService.userExistsByEmail('nonexistent@example.com');

      expect(result).toBe(false);
    });

    it('should convert email to lowercase when checking existence', async () => {
      mockPrisma.userList.findUnique.mockResolvedValue(mockUser);

      await UserListService.userExistsByEmail('JOHN.DOE@EXAMPLE.COM');

      expect(mockPrisma.userList.findUnique).toHaveBeenCalledWith({
        where: { email: 'john.doe@example.com' },
      });
    });
  });

  describe('Edge Cases and Data Validation', () => {
    it('should handle user creation with empty optional fields', async () => {
      const createData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        googleId: '',
        image: '',
      };

      const expectedUser = {
        ...mockUser,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      };

      mockPrisma.userList.create.mockResolvedValue(expectedUser);

      await UserListService.createUser(createData);

      expect(mockPrisma.userList.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          isAdmin: false,
          googleId: null,
          provider: 'manual',
          image: null,
          emailNotifications: false,
          pushNotifications: false,
        },
      });
    });

    it('should handle update with undefined values (should not update those fields)', async () => {
      const updateData = {
        firstName: 'NewName',
        lastName: undefined,
        email: undefined,
      };

      const updatedUser = {
        ...mockUser,
        firstName: 'NewName',
      };

      mockPrisma.userList.update.mockResolvedValue(updatedUser);

      await UserListService.updateUser(mockUser.id, updateData);

      expect(mockPrisma.userList.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          firstName: 'NewName',
        },
      });
    });

    it('should handle boolean false values correctly in updates', async () => {
      const updateData = {
        isAdmin: false,
        emailNotifications: false,
        pushNotifications: false,
      };

      const updatedUser = {
        ...mockUser,
        isAdmin: false,
        emailNotifications: false,
        pushNotifications: false,
      };

      mockPrisma.userList.update.mockResolvedValue(updatedUser);

      await UserListService.updateUser(mockUser.id, updateData);

      expect(mockPrisma.userList.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isAdmin: false,
          emailNotifications: false,
          pushNotifications: false,
        },
      });
    });
  });
});
