/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace engine package from source.
  transpilePackages: ["@astro/engine"],
};

module.exports = nextConfig;
