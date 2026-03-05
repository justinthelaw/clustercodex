/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Codex SDK packages external on the server so optional platform
  // binaries resolve from node_modules at runtime.
  serverExternalPackages: [
    "@openai/codex-sdk",
    "@openai/codex",
    "@openai/codex-linux-x64",
    "@openai/codex-linux-arm64",
    "@openai/codex-darwin-x64",
    "@openai/codex-darwin-arm64",
    "@openai/codex-win32-x64",
    "@openai/codex-win32-arm64"
  ]
};

export default nextConfig;
