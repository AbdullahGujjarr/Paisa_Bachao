const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Native or file-reading packages must load from node_modules, not the bundle.
  serverExternalPackages: [
    'mongoose',
    'sharp',
    'tesseract.js',
    '@tesseract.js-data/eng',
    'unpdf',
    '@napi-rs/canvas',
    'heic-convert',
    'pdfkit',
    'exceljs',
    'bcryptjs',
    'nodemailer',
    'cloudinary',
  ],
  images: { remotePatterns: [{ hostname: 'res.cloudinary.com' }, { hostname: 'lh3.googleusercontent.com' }] },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
