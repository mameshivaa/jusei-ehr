/** @type {import('next').NextConfig} */

// Electron用ビルドかどうか
const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    instrumentationHook: true,
    serverComponentsExternalPackages: ["pdfkit"],
  },

  // Electron用ビルド設定（APIルートを含むためstandalone）
  ...(isElectronBuild && {
    output: "standalone",
    // Electronでは画像最適化を無効
    images: {
      unoptimized: true,
    },
  }),
};

module.exports = nextConfig;
