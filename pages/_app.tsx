import "@/styles/globals.css"; // Tailwind styles
import type { AppProps } from "next/app";

// Optional: you could include layout or providers here if needed later
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
