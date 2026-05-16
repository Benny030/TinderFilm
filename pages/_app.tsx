import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';


export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#E8386D" />
        <title>CineDate💜</title>
      </Head>
      {/* ─── Sfondo grigio su desktop per far risaltare l'app ─────────────── */}
      <div style={{ minHeight: '100vh', background: '#F0F0F0' }}>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </div>
    </>
  );
}