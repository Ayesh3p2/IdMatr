/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_CP_API_URL: process.env.NEXT_PUBLIC_CP_API_URL || 'http://localhost:3010',
  },
};

module.exports = nextConfig;
