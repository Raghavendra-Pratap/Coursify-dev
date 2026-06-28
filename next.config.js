/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // TODO: Add image domains when implementing file uploads
  // images: {
  //   domains: ['your-supabase-project.supabase.co'],
  // },
}

module.exports = nextConfig
