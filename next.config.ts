import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@xenova/transformers',
    'onnxruntime-node',
    'onnxruntime-web',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@xenova/transformers',
        'onnxruntime-node',
        'onnxruntime-web',
      ];
    }
    return config;
  },
};

export default nextConfig;
