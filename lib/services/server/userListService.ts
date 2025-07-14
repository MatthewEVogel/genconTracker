import { prisma } from '@/lib/prisma';

export interface UserListData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  genConName: string;
  isAdmin: boolean;
  approved: boolean;
  googleId?: string | null;
  provider: string;
  image?: string | null;
  emailNotifications: boolean;
  pushNotifications: boolean;
  createdAt: Date;
}

export interface CreateUserListData {
  firstName: string;
  lastName: string;
  email: string;
  genConName?: string;
  isAdmin?: boolean;
  approved?: boolean;
  googleId?: string;
  provider?: string;
  image?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface UpdateUserListData {
  firstName?: string;
  lastName?: string;
  email?: string;
  genConName?: string;
  isAdmin?: boolean;
  approved?: boolean;
  googleId?: string;
  provider?: string;
  image?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface UserListResponse {
  userList: UserListData;
}

export interface UserListsResponse {
  userLists: UserListData[];
}

export class UserListService {
  // Get all users
  static async getAllUsers(): Promise<UserListsResponse> {
    const userLists = await prisma.userList.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    return { userLists };
  }

  // Get user by ID
  static async getUserById(id: string): Promise<UserListResponse> {
    const userList = await prisma.userList.findUnique({
      where: { id }
    });

    if (!userList) {
      throw new Error('User not found');
    }

    return { userList };
  }

  // Get user by email
  static async getUserByEmail(email: string): Promise<UserListResponse> {
    const userList = await prisma.userList.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!userList) {
      throw new Error('User not found');
    }

    return { userList };
  }

  // Get user by Google ID
  static async getUserByGoogleId(googleId: string): Promise<UserListResponse> {
    const userList = await prisma.userList.findUnique({
      where: { googleId }
    });

    if (!userList) {
      throw new Error('User not found');
    }

    return { userList };
  }

  // Create user
  static async createUser(data: CreateUserListData): Promise<UserListResponse> {
    const userList = await prisma.userList.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        genConName: data.genConName ? data.genConName.trim() : `${data.firstName.trim()} ${data.lastName.trim()}`,
        isAdmin: data.isAdmin || false,
        approved: data.approved || false,
        googleId: data.googleId || null,
        provider: data.provider || 'manual',
        image: data.image || null,
        emailNotifications: data.emailNotifications || false,
        pushNotifications: data.pushNotifications || false,
      }
    });

    return { userList };
  }

  // Update user
  static async updateUser(id: string, data: UpdateUserListData): Promise<UserListResponse> {
    const updateData: any = {};
    
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
    if (data.genConName !== undefined) updateData.genConName = data.genConName.trim();
    if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;
    if (data.approved !== undefined) updateData.approved = data.approved;
    if (data.googleId !== undefined) updateData.googleId = data.googleId;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.emailNotifications !== undefined) updateData.emailNotifications = data.emailNotifications;
    if (data.pushNotifications !== undefined) updateData.pushNotifications = data.pushNotifications;

    const userList = await prisma.userList.update({
      where: { id },
      data: updateData
    });

    return { userList };
  }

  // Delete user
  static async deleteUser(id: string): Promise<void> {
    const userList = await prisma.userList.findUnique({
      where: { id }
    });

    if (!userList) {
      throw new Error('User not found');
    }

    await prisma.userList.delete({
      where: { id }
    });
  }

  // Check if user exists by email
  static async userExistsByEmail(email: string): Promise<boolean> {
    const userList = await prisma.userList.findUnique({
      where: { email: email.toLowerCase() }
    });

    return !!userList;
  }

  // Get admin users
  static async getAdminUsers(): Promise<UserListsResponse> {
    const userLists = await prisma.userList.findMany({
      where: { isAdmin: true },
      orderBy: { createdAt: 'asc' }
    });
    
    return { userLists };
  }

  // Get pending approval users (manual accounts that are not approved)
  static async getPendingUsers(): Promise<UserListsResponse> {
    const userLists = await prisma.userList.findMany({
      where: { 
        provider: 'manual',
        approved: false 
      },
      orderBy: { createdAt: 'asc' }
    });
    
    return { userLists };
  }

  // Approve user
  static async approveUser(id: string): Promise<UserListResponse> {
    const userList = await prisma.userList.update({
      where: { id },
      data: { approved: true }
    });

    return { userList };
  }

  // Reject user (delete the account)
  static async rejectUser(id: string): Promise<void> {
    await this.deleteUser(id);
  }
}
