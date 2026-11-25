/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_CODATA_GATE_URL: process.env.NEXT_PUBLIC_CODATA_GATE_URL || process.env.CODATA_GATE_URL || 'https://api.codata.io',
  },
};
export default nextConfig;
