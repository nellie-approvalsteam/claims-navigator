/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Content is read from disk at request time (see lib/content.ts), so
  // pages that depend on it must not be statically cached at build time.
  // Individual routes opt into dynamic rendering with `export const dynamic`.
};

export default nextConfig;
