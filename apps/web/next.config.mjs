/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@ums/config", "@ums/contracts"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL || "http://localhost:5500/api/v1",
  },
};

export default nextConfig;
