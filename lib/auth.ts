import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "./prisma"

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      firstName?: string
      lastName?: string
      isAdmin?: boolean
      provider?: string
      emailNotifications?: boolean
    }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          // Check if user already exists by email
          const existingUser = await prisma.userList.findUnique({
            where: { email: user.email! }
          });

          if (existingUser) {
            // Check if user should be admin
            const adminEmails = ['matthewvogel1729@gmail.com', 'kencoder@gmail.com'];
            const shouldBeAdmin = adminEmails.includes(user.email!);
            
            // Update existing user with Google info if they don't have it, and check admin status
            const updateData: any = {};
            
            if (!existingUser.googleId) {
              updateData.googleId = user.id;
              updateData.provider = "google";
              updateData.image = user.image;
              updateData.firstName = (profile as any)?.given_name || existingUser.firstName;
              updateData.lastName = (profile as any)?.family_name || existingUser.lastName;
            }
            
            // Update admin status if needed
            if (existingUser.isAdmin !== shouldBeAdmin) {
              updateData.isAdmin = shouldBeAdmin;
            }
            
            // Only update if there are changes
            if (Object.keys(updateData).length > 0) {
              await prisma.userList.update({
                where: { id: existingUser.id },
                data: updateData
              });
            }
          } else {
            // Create new user with Google info
            const adminEmails = ['matthewvogel1729@gmail.com', 'kencoder@gmail.com'];
            const isAdminAccount = adminEmails.includes(user.email!);
            
            await prisma.userList.create({
              data: {
                id: user.id,
                email: user.email!,
                firstName: (profile as any)?.given_name || user.name?.split(' ')[0] || 'Unknown',
                lastName: (profile as any)?.family_name || user.name?.split(' ').slice(1).join(' ') || 'User',
                googleId: user.id,
                provider: "google",
                image: user.image,
                isAdmin: isAdminAccount,
                emailNotifications: false,
                pushNotifications: false
              }
            });
          }
          
          return true;
        } catch (error) {
          console.error("Error during Google sign in:", error);
          return false;
        }
      }
      
      return true;
    },
    async session({ session, user }) {
      // Get the full user data from database
      const dbUser = await prisma.userList.findUnique({
        where: { email: session.user?.email! }
      });

      if (dbUser) {
        session.user = {
          ...session.user,
          id: dbUser.id,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          isAdmin: dbUser.isAdmin,
          provider: dbUser.provider,
          image: dbUser.image,
          emailNotifications: dbUser.emailNotifications
        };
      }

      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }
  },
  pages: {
    signIn: '/', // Redirect to our custom landing page
  },
  session: {
    strategy: "jwt"
  }
}
