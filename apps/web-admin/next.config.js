/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@zombietech/shared'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.amazonaws.com' }],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
