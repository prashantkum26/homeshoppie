import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    domains: ['images.unsplash.com'], // Add any allowed domains here
  },
};

export default nextConfig;
