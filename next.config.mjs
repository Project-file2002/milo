/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mounting WebRTC peer connections in development
  swcMinify: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
