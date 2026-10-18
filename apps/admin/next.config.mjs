/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@adonis/database", "@adonis/design-tokens", "@adonis/core"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "node-ical", "sharp", "@aws-sdk/client-s3"],
  },
};

export default nextConfig;
