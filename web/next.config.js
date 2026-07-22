/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // sharp is used at runtime for thumbnails; keep it external so the standalone
  // build copies the native binary instead of trying to bundle it.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "sharp", "bcryptjs"],
  },
};

module.exports = nextConfig;
