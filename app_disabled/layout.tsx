import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CineDate Supabase',
  description: 'Next.js app con Supabase SSR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
