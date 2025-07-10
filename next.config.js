// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // any other Next.js options…
  typescript: {
    ignoreBuildErrors: false, // ✅ fail the build on TS errors (this is the default)
  },
  eslint: {
    ignoreDuringBuilds: false, // optional: fail on ESLint errors too
  },
};

module.exports = nextConfig;
