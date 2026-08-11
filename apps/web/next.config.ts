import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mashrum/shared"],
  reactStrictMode: true,
};

export default nextConfig;
