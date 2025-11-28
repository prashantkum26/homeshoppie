import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Image configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/api/**',
      },
    ],
  },
  
  // Turbopack configuration (Next.js 16+)
  turbopack: {}, // Empty config to silence Turbopack warnings
  
  // Development optimizations for webpack (fallback)
  ...(process.env.NODE_ENV === 'development' && {
    webpack: (config: any, { dev }: any) => {
      if (dev) {
        // Suppress source map warnings in development
        config.devtool = false;
        
        // Reduce bundle analysis warnings
        config.stats = {
          ...config.stats,
          warningsFilter: [
            /source-map-loader/,
            /Failed to parse source map/,
            /sourceMapURL could not be parsed/,
          ],
        };
      }
      return config;
    },
  }),
  
};

export default nextConfig;
