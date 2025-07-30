// next.config.mjs
/** @type {import('next').NextConfig} */
export default {
  webpack(config, { isServer }) {
    //
    // ── 1. Server: stop at the import boundary ─────────────────────────────
    //
    if (isServer) {
      //   a) Make the library external so SSR webpack never resolves it
      //      (dynamic import in the browser still works → it’s executed only
      //       after hydration, on the client).
      config.externals = [
        ...(config.externals || []),
        '@vladmandic/human',
      ];

      //   b) And just in case something reaches into sub-paths, alias them
      //      to `false` so resolution immediately ends.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@vladmandic/human/dist/human.node.js': false,
        '@vladmandic/human/dist/human.esm.js' : false,
        '@tensorflow/tfjs-node'               : false,
        '@tensorflow/tfjs-node-gpu'           : false,
      };
      return config;
    }

    //
    // ── 2. Client: always use the pure-browser ESM build ──────────────────
    //
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@vladmandic/human/dist/human.node.js': false,
      '@tensorflow/tfjs-node'               : false,
      '@tensorflow/tfjs-node-gpu'           : false,
    };

    return config;
  },
};
