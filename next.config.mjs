
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ─── Necessario per @sparticuz/chromium ──────────────────────────────────
  serverExternalPackages: [
    'playwright-core',
    '@sparticuz/chromium',
  ],

  devIndicators: false,

  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

