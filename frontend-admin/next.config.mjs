/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for minimal Docker image builds
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
