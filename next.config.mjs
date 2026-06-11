/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "ws",
    "bufferutil",
    "utf-8-validate",
  ],
};

export default nextConfig;
