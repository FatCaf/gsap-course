/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Zoom embedded SDK references optional deps it doesn't use in the browser
    // build. Alias to false so webpack stops failing to resolve them.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@zoom/download-manager": false,
    };
    return config;
  },
};

export default nextConfig;