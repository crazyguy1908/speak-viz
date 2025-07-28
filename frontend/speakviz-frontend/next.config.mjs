/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@vladmandic/human'],
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        os: false,
        crypto: false,
        util: false,
        stream: false,
        buffer: false,
      };

      config.externals = config.externals || [];
      config.externals.push({
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
        '@tensorflow/tfjs-node-gpu': 'commonjs @tensorflow/tfjs-node-gpu',
      });
    }

    return config;
  },
};

export default nextConfig;