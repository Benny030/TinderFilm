import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import '../styles/pages/landing.css';
import '../styles/pages/home.css';
import '../styles/pages/auth.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import RoomLifecycleGuard from '@/components/RoomLifecycleGuard';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <meta name="theme-color" content="#E8386D" />
        <title>CineDate💜</title>
      </Head>

      <ThemeProvider>
        <AuthProvider>
          <RoomLifecycleGuard />
          <Component {...pageProps} />
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
