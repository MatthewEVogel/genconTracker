import "@/styles/globals.css"; // Tailwind styles
import type { AppProps } from "next/app";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import useUserStore from "@/store/useUserStore";
import CanceledEventAlert from "@/components/CanceledEventAlert";

function AppContent({ Component, pageProps, router }: AppProps) {
  const { user, setUser } = useUserStore();
  const { data: session, status } = useSession();
  const nextRouter = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading

    if (session?.user) {
      // Update user store with session data
      setUser({
        id: session.user.id,
        firstName: session.user.firstName || '',
        lastName: session.user.lastName || '',
        email: session.user.email || '',
        genConName: session.user.genConName || '',
        isAdmin: session.user.isAdmin || false,
        approved: session.user.approved || false,
        provider: session.user.provider || 'manual',
        image: session.user.image || '',
        emailNotifications: session.user.emailNotifications || false,
        createdAt: new Date().toISOString()
      });

      // Check if user needs approval
      const isPublicPage = nextRouter.pathname === '/' || nextRouter.pathname === '/waiting-approval';
      
      if (session.user.provider === 'manual' && !session.user.approved && !isPublicPage) {
        nextRouter.push('/waiting-approval');
        return;
      }
      
      // If user is approved and on waiting approval page, redirect to schedule
      if (session.user.approved && nextRouter.pathname === '/waiting-approval') {
        nextRouter.push('/schedule');
        return;
      }
    }
  }, [session, status, nextRouter, setUser]);

  return (
    <>
      <Component {...pageProps} />
      {user && <CanceledEventAlert userId={user.id} />}
    </>
  );
}

// Optional: you could include layout or providers here if needed later
export default function App({ Component, pageProps: { session, ...pageProps }, router }: AppProps) {
  return (
    <SessionProvider session={session}>
      <AppContent Component={Component} pageProps={pageProps} router={router} />
    </SessionProvider>
  );
}
