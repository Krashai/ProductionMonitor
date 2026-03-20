/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Opcjonalnie: wyłączamy sprawdzanie typów i linta podczas buildu na RPi, aby zaoszczędzić RAM
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
