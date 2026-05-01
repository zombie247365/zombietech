/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@zombietech/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },
  // Proxy /api/* → Express backend in development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `https://zombietech-production.up.railway.app/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
