/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@adonis/database", "@adonis/design-tokens"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "node-ical"],
  },
};

export default nextConfig;
