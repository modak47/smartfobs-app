import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "smartfobs.co.uk",
        pathname: "/cdn/shop/files/**",
      },
    ],
  },
};

export default nextConfig;
