const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function approveExistingUsers() {
  try {
    console.log('Approving all existing users...');
    
    // Update all users to be approved
    const result = await prisma.userList.updateMany({
      where: {
        approved: false
      },
      data: {
        approved: true
      }
    });
    
    console.log(`Successfully approved ${result.count} users`);
    
    // Show the current state
    const allUsers = await prisma.userList.findMany({
      select: {
        firstName: true,
        lastName: true,
        email: true,
        provider: true,
        approved: true,
        isAdmin: true
      }
    });
    
    console.log('\nCurrent user status:');
    allUsers.forEach(user => {
      console.log(`${user.firstName} ${user.lastName} (${user.email}) - ${user.provider} - Approved: ${user.approved} - Admin: ${user.isAdmin}`);
    });
    
  } catch (error) {
    console.error('Error approving users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approveExistingUsers();
