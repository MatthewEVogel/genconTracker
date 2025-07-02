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
      phoneNumber?: string | null
      emailNotifications?: boolean
      textNotifications?: boolean
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
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });

          if (existingUser) {
            // Update existing user with Google info if they don't have it
            if (!existingUser.googleId) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  googleId: user.id,
                  provider: "google",
                  image: user.image,
                  // Update name if it's different
                  firstName: (profile as any)?.given_name || existingUser.firstName,
                  lastName: (profile as any)?.family_name || existingUser.lastName,
                }
              });
            }
          } else {
            // Create new user with Google info
            const isAdminAccount = user.email === 'matthewvogel1729@gmail.com';
            
            await prisma.user.create({
              data: {
                id: user.id,
                email: user.email!,
                firstName: (profile as any)?.given_name || user.name?.split(' ')[0] || 'Unknown',
                lastName: (profile as any)?.family_name || user.name?.split(' ').slice(1).join(' ') || 'User',
                googleId: user.id,
                provider: "google",
                image: user.image,
                isAdmin: isAdminAccount,
                phoneNumber: null,
                emailNotifications: false,
                textNotifications: false
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
      const dbUser = await prisma.user.findUnique({
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
          phoneNumber: dbUser.phoneNumber,
          emailNotifications: dbUser.emailNotifications,
          textNotifications: dbUser.textNotifications
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
