const nextConfig = {
  reactStrictMode: true,
   // ─── Necessario per @sparticuz/chromium ──────────────────────────────────
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  },
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
