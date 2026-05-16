/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "ws",
    "bufferutil",
    "utf-8-validate",
  ],
};

export default nextConfig;
