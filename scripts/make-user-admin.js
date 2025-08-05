const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeUserAdmin() {
  try {
    const email = 'test@gmail.com';
    
    // First, let's find the user
    const user = await prisma.userList.findUnique({
      where: { email: email }
    });
    
    if (!user) {
      console.log(`User with email ${email} not found.`);
      console.log('Let me search for users with "test" in their email...');
      
      const testUsers = await prisma.userList.findMany({
        where: {
          email: {
            contains: 'test',
            mode: 'insensitive'
          }
        }
      });
      
      if (testUsers.length > 0) {
        console.log('Found users with "test" in email:');
        testUsers.forEach(user => {
          console.log(`- ${user.firstName} ${user.lastName} (${user.email}) - Admin: ${user.isAdmin}`);
        });
        
        // If there's exactly one test user, update them
        if (testUsers.length === 1) {
          const testUser = testUsers[0];
          console.log(`\nUpdating ${testUser.email} to admin status...`);
          
          const updatedUser = await prisma.userList.update({
            where: { id: testUser.id },
            data: { isAdmin: true }
          });
          
          console.log(`✅ Successfully updated ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email}) to admin status!`);
        } else {
          console.log('\nMultiple test users found. Please specify which one to update.');
        }
      } else {
        console.log('No users found with "test" in their email.');
      }
      return;
    }
    
    if (user.isAdmin) {
      console.log(`User ${user.firstName} ${user.lastName} (${user.email}) is already an admin.`);
      return;
    }
    
    // Update user to admin
    const updatedUser = await prisma.userList.update({
      where: { email: email },
      data: { isAdmin: true }
    });
    
    console.log(`✅ Successfully updated ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email}) to admin status!`);
    
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeUserAdmin();
