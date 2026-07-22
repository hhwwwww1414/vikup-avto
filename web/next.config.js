const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // sharp is used at runtime for thumbnails; keep it external so the standalone
  // build copies the native binary instead of trying to bundle it.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "sharp", "bcryptjs"],
  },
  // Resolve the "@/*" alias explicitly. tsconfig `paths` alone proved flaky in
  // the Linux/webpack production build, so we pin it to an absolute path here.
  webpack: (config) => {
    config.resolve.alias["@"] = path.join(__dirname, "src");
    return config;
  },
};

module.exports = nextConfig;
