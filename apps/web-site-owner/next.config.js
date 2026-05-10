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
};

module.exports = nextConfig;
