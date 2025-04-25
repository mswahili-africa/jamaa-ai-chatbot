/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"], // Exclude from bundle
  },
  webpack: (config) => {
    // Skip PDF processing during build
    config.module.rules.push({
      test: /pdf-parse/,
      use: { loader: "null-loader" }
    });
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Allows images from any domain
      },
    ],
  },
};

export default nextConfig;
