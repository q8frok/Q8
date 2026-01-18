/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
      },
      // Google profile images (OAuth)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Google CDN variations
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      // Gravatar (common email avatar fallback)
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 'gravatar.com',
      },
    ],
  },
};

module.exports = nextConfig;
