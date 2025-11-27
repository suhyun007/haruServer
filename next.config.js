/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude large data files from serverless function bundle
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        './data/foodData/json/**/*',
        './data/foodData/*.sqlite',
        './data/foodData/*.sqlite3',
      ],
    },
  },
}

module.exports = nextConfig

