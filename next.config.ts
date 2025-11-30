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
    // Allow local API routes with query strings
    localPatterns: [
      {
        pathname: '/api/public/images/**',
      },
      {
        pathname: '/api/admin/images/**',
      },
      {
        pathname: '/images/**',
        search: '',
      },
    ],
    // Allow SVG images for fallback placeholders
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
