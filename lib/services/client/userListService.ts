import { UserListData, CreateUserListData, UpdateUserListData, UserListResponse, UserListsResponse } from '../server/userListService';

export class UserListService {
  private static readonly BASE_URL = '/api/user-list';

  // Get all users
  static async getAllUsers(): Promise<UserListsResponse> {
    const response = await fetch(this.BASE_URL);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch users');
    }
    
    return response.json();
  }

  // Get user by ID
  static async getUserById(id: string): Promise<UserListResponse> {
    const response = await fetch(`${this.BASE_URL}/${id}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user');
    }
    
    return response.json();
  }

  // Create user
  static async createUser(data: CreateUserListData): Promise<UserListResponse> {
    const response = await fetch(this.BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }
    
    return response.json();
  }

  // Update user
  static async updateUser(id: string, data: UpdateUserListData): Promise<UserListResponse> {
    const response = await fetch(`${this.BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }
    
    return response.json();
  }

  // Delete user
  static async deleteUser(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  }

  // Check if user exists by email
  static async userExistsByEmail(email: string): Promise<boolean> {
    const response = await fetch(`${this.BASE_URL}/check-email?email=${encodeURIComponent(email)}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to check email');
    }
    
    const result = await response.json();
    return result.exists;
  }

  // Get admin users
  static async getAdminUsers(): Promise<UserListsResponse> {
    const response = await fetch(`${this.BASE_URL}/admins`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch admin users');
    }
    
    return response.json();
  }
}