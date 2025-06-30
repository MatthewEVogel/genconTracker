import "@/styles/globals.css"; // Tailwind styles
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import useUserStore from "@/store/useUserStore";
import CanceledEventAlert from "@/components/CanceledEventAlert";

function AppContent({ Component, pageProps, router }: AppProps) {
  const { user } = useUserStore();

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
