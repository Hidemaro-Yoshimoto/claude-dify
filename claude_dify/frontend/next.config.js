/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['storage.googleapis.com'],
    unoptimized: true // For Cloud Run deployment
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    NEXT_PUBLIC_APP_NAME: 'Claude Dify Checker'
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`
      }
    ];
  },
  // For standalone deployment
  output: 'standalone',
  // Disable source maps in production for smaller build size
  productionBrowserSourceMaps: false,
  // Optimize for Cloud Run
  compress: true,
  poweredByHeader: false
};

module.exports = nextConfig;