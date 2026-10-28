/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.POLICYFORGE_TEST_BUILD_DIR || ".next",
};

export default nextConfig;
