/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@mycelix/sdk'],
  env: {
    NEXT_PUBLIC_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ROUTER_ADDRESS,
    NEXT_PUBLIC_FLOW_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_FLOW_TOKEN_ADDRESS,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '31337',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545',
  },
  images: {
    domains: ['w3s.link', 'ipfs.io'],
  },
};

module.exports = nextConfig;
