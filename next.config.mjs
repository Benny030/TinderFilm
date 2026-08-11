 
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Necessario per @sparticuz/chromium e Playwright
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
 
