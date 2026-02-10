/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tells Next.js to skip bundling these packages.
  // This is the ONLY way to fix that "Module not found" error for ffmpeg.
  serverExternalPackages: ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
};

module.exports = nextConfig;