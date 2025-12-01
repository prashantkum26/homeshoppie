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
    // Allow local API routes and static images
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
  
  // Development and production optimizations
  webpack: (config: any, { dev, isServer }: any) => {
    if (dev) {
      // Suppress source map warnings in development
      config.devtool = false;
      
      // Ignore source map parsing errors
      config.ignoreWarnings = [
        /Failed to parse source map/,
        /sourceMapURL could not be parsed/,
        /Invalid source map/,
        ...(config.ignoreWarnings || [])
      ];
      
      // Reduce bundle analysis warnings
      config.stats = {
        ...config.stats,
        warningsFilter: [
          /source-map-loader/,
          /Failed to parse source map/,
          /sourceMapURL could not be parsed/,
          /Invalid source map/,
          /Critical dependency/,
        ],
      };
    }
    
    // Optimize for better performance
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          default: false,
          vendors: false,
          // Bundle next/node_modules separately
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Bundle common modules
          common: {
            minChunks: 2,
            chunks: 'all',
            name: 'common',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      },
    };
    
    return config;
  },
  
  // Additional experimental features
  experimental: {
    // Suppress hydration warnings in development
    ...(process.env.NODE_ENV === 'development' && {
      suppressHydrationWarning: true,
    }),
    // Optimize package imports
    optimizePackageImports: ['@prisma/client', 'razorpay', 'zustand'],
  },
  
};

export default nextConfig;
