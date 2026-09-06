 
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Compile only the icons used by each page.
    optimizePackageImports: ['@phosphor-icons/react'],
  },

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
 
