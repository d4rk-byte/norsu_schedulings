import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const apiOrigin = (() => {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
})();

const backendOrigin = (() => {
  const value = process.env.INTERNAL_BACKEND_URL || 'http://localhost:8000';
  return value.replace(/\/+$/, '');
})();

const connectSources = ["'self'", apiOrigin];
if (!isProduction) {
  connectSources.push('ws:', 'wss:');
}
const connectSrc = connectSources.filter(Boolean).join(" ");

const scriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  `connect-src ${connectSrc}`,
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
];

const allowedDevOrigins = [
  'localhost',
  '127.0.0.1',
  '192.168.2.234',
  '*.ngrok-free.app',
  '*.ngrok-free.dev',
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
    
    turbopack: {
      root: __dirname,
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  
};

export default nextConfig;
