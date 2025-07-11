import { UserListService } from '@/lib/services/server/userListService';
import { testDatabase } from './utils/testDatabase';

describe('UserListService', () => {
  beforeEach(async () => {
    await testDatabase.setup();
  });

  afterEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.disconnect();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await UserListService.getAllUsers();

      expect(result.userLists).toHaveLength(3);
      expect(result.userLists[0].firstName).toBe('Alice');
      expect(result.userLists[0].lastName).toBe('Smith');
      expect(result.userLists[0].email).toBe('alice.smith@example.com');
    });

    it('should return empty array when no users exist', async () => {
      const result = await UserListService.getAllUsers();

      expect(result.userLists).toHaveLength(0);
    });
  });

  describe('getUserById', () => {
    it('should return user details for valid ID', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await UserListService.getUserById('user-1');

      expect(result.userList).toBeDefined();
      expect(result.userList.id).toBe('user-1');
      expect(result.userList.firstName).toBe('Alice');
      expect(result.userList.lastName).toBe('Smith');
      expect(result.userList.email).toBe('alice.smith@example.com');
    });

    it('should throw error for non-existent user ID', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        UserListService.getUserById('non-existent-user')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user details for valid email', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await UserListService.getUserByEmail('alice.smith@example.com');

      expect(result.userList).toBeDefined();
      expect(result.userList.id).toBe('user-1');
      expect(result.userList.firstName).toBe('Alice');
      expect(result.userList.lastName).toBe('Smith');
      expect(result.userList.email).toBe('alice.smith@example.com');
    });

    it('should handle email case insensitivity', async () => {
      await testDatabase.createTestScenario('simple');

      const result = await UserListService.getUserByEmail('ALICE.SMITH@EXAMPLE.COM');

      expect(result.userList).toBeDefined();
      expect(result.userList.id).toBe('user-1');
      expect(result.userList.firstName).toBe('Alice');
    });

    it('should throw error for non-existent email', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        UserListService.getUserByEmail('nonexistent@example.com')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getUserByGoogleId', () => {
    it('should return user details for valid Google ID', async () => {
      const users = [
        { 
          id: 'user-1', 
          firstName: 'Google', 
          lastName: 'User', 
          email: 'google@example.com',
          googleId: 'google-123',
          provider: 'google'
        }
      ];

      await testDatabase.seedUsers(users);

      const result = await UserListService.getUserByGoogleId('google-123');

      expect(result.userList).toBeDefined();
      expect(result.userList.googleId).toBe('google-123');
      expect(result.userList.firstName).toBe('Google');
    });

    it('should throw error for non-existent Google ID', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        UserListService.getUserByGoogleId('non-existent-google-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        isAdmin: false,
        emailNotifications: true,
        pushNotifications: false
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList).toBeDefined();
      expect(result.userList.firstName).toBe('John');
      expect(result.userList.lastName).toBe('Doe');
      expect(result.userList.email).toBe('john.doe@example.com');
      expect(result.userList.isAdmin).toBe(false);
      expect(result.userList.emailNotifications).toBe(true);
      expect(result.userList.pushNotifications).toBe(false);
      expect(result.userList.provider).toBe('manual');
    });

    it('should create user with minimal required data', async () => {
      const userData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com'
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList).toBeDefined();
      expect(result.userList.firstName).toBe('Jane');
      expect(result.userList.lastName).toBe('Smith');
      expect(result.userList.email).toBe('jane.smith@example.com');
      expect(result.userList.isAdmin).toBe(false); // Default value
      expect(result.userList.emailNotifications).toBe(false); // Default value
      expect(result.userList.pushNotifications).toBe(false); // Default value
      expect(result.userList.provider).toBe('manual'); // Default value
    });

    it('should create Google user with all fields', async () => {
      const userData = {
        firstName: 'Google',
        lastName: 'User',
        email: 'google.user@gmail.com',
        googleId: 'google-123456',
        provider: 'google',
        image: 'https://example.com/avatar.jpg'
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList.googleId).toBe('google-123456');
      expect(result.userList.provider).toBe('google');
      expect(result.userList.image).toBe('https://example.com/avatar.jpg');
    });

    it('should normalize email to lowercase', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'Test.User@Example.COM'
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList.email).toBe('test.user@example.com');
    });

    it('should trim whitespace from names and email', async () => {
      const userData = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  john.doe@example.com  '
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList.firstName).toBe('John');
      expect(result.userList.lastName).toBe('Doe');
      expect(result.userList.email).toBe('john.doe@example.com');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      await testDatabase.createTestScenario('simple');

      const updateData = {
        firstName: 'Updated Alice',
        lastName: 'Updated Smith',
        isAdmin: true,
        emailNotifications: true
      };

      const result = await UserListService.updateUser('user-1', updateData);

      expect(result.userList).toBeDefined();
      expect(result.userList.firstName).toBe('Updated Alice');
      expect(result.userList.lastName).toBe('Updated Smith');
      expect(result.userList.isAdmin).toBe(true);
      expect(result.userList.emailNotifications).toBe(true);
      expect(result.userList.email).toBe('alice.smith@example.com'); // Should remain unchanged
    });

    it('should update only provided fields', async () => {
      await testDatabase.createTestScenario('simple');

      const updateData = {
        firstName: 'Only First Name Updated'
      };

      const result = await UserListService.updateUser('user-1', updateData);

      expect(result.userList.firstName).toBe('Only First Name Updated');
      expect(result.userList.lastName).toBe('Smith'); // Should remain unchanged
      expect(result.userList.email).toBe('alice.smith@example.com'); // Should remain unchanged
    });

    it('should normalize email when updating', async () => {
      await testDatabase.createTestScenario('simple');

      const updateData = {
        email: '  UPDATED.EMAIL@EXAMPLE.COM  '
      };

      const result = await UserListService.updateUser('user-1', updateData);

      expect(result.userList.email).toBe('updated.email@example.com');
    });

    it('should throw error when updating non-existent user', async () => {
      await testDatabase.createTestScenario('simple');

      const updateData = {
        firstName: 'Updated Name'
      };

      await expect(
        UserListService.updateUser('non-existent-user', updateData)
      ).rejects.toThrow();
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      await testDatabase.createTestScenario('simple');

      // Verify user exists before deletion
      const userBefore = await UserListService.getUserById('user-1');
      expect(userBefore.userList).toBeDefined();

      await UserListService.deleteUser('user-1');

      // Verify user no longer exists
      await expect(
        UserListService.getUserById('user-1')
      ).rejects.toThrow('User not found');
    });

    it('should throw error when deleting non-existent user', async () => {
      await testDatabase.createTestScenario('simple');

      await expect(
        UserListService.deleteUser('non-existent-user')
      ).rejects.toThrow('User not found');
    });
  });

  describe('userExistsByEmail', () => {
    it('should return true for existing email', async () => {
      await testDatabase.createTestScenario('simple');

      const exists = await UserListService.userExistsByEmail('alice.smith@example.com');

      expect(exists).toBe(true);
    });

    it('should return true for existing email regardless of case', async () => {
      await testDatabase.createTestScenario('simple');

      const exists = await UserListService.userExistsByEmail('ALICE.SMITH@EXAMPLE.COM');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent email', async () => {
      await testDatabase.createTestScenario('simple');

      const exists = await UserListService.userExistsByEmail('nonexistent@example.com');

      expect(exists).toBe(false);
    });

    it('should return false when no users exist', async () => {
      const exists = await UserListService.userExistsByEmail('any@example.com');

      expect(exists).toBe(false);
    });
  });

  describe('getAdminUsers', () => {
    it('should return only admin users', async () => {
      const users = [
        { id: 'user-1', firstName: 'Admin', lastName: 'User', email: 'admin@example.com', isAdmin: true },
        { id: 'user-2', firstName: 'Regular', lastName: 'User', email: 'regular@example.com', isAdmin: false },
        { id: 'user-3', firstName: 'Another', lastName: 'Admin', email: 'admin2@example.com', isAdmin: true }
      ];

      await testDatabase.seedUsers(users);

      const result = await UserListService.getAdminUsers();

      expect(result.userLists).toHaveLength(2);
      expect(result.userLists[0].isAdmin).toBe(true);
      expect(result.userLists[1].isAdmin).toBe(true);
      
      const adminEmails = result.userLists.map(u => u.email).sort();
      expect(adminEmails).toEqual(['admin2@example.com', 'admin@example.com']);
    });

    it('should return empty array when no admin users exist', async () => {
      const users = [
        { id: 'user-1', firstName: 'Regular', lastName: 'User', email: 'regular@example.com', isAdmin: false }
      ];

      await testDatabase.seedUsers(users);

      const result = await UserListService.getAdminUsers();

      expect(result.userLists).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user creation with special characters in name', async () => {
      const userData = {
        firstName: "O'Connor",
        lastName: 'Smith-Jones',
        email: 'special.chars@example.com'
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList.firstName).toBe("O'Connor");
      expect(result.userList.lastName).toBe('Smith-Jones');
    });

    it('should handle long names and emails', async () => {
      const userData = {
        firstName: 'A'.repeat(50),
        lastName: 'B'.repeat(50),
        email: 'very.long.email.address@example.com'
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList.firstName).toBe('A'.repeat(50));
      expect(result.userList.lastName).toBe('B'.repeat(50));
      expect(result.userList.email).toBe('very.long.email.address@example.com');
    });

    it('should handle undefined values for optional fields', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
        // googleId and image are undefined (not provided)
      };

      const result = await UserListService.createUser(userData);

      expect(result.userList.googleId).toBeNull();
      expect(result.userList.image).toBeNull();
    });
  });
});
