import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@xenova/transformers',
    'onnxruntime-node',
    'onnxruntime-web',
    'onnxruntime-common',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        '@xenova/transformers',
        'onnxruntime-node',
        'onnxruntime-web',
        'onnxruntime-common'
      );
    }
    return config;
  },
  turbopack: {}, // Silence the Next.js 16 error when using a custom webpack config
};

export default nextConfig;
