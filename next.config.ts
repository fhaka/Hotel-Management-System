import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@react-pdf/renderer", "nodemailer"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
