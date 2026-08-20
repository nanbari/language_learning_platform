import type { NextConfig } from "next";

// Content-Security-Policy : restreint d'où peuvent venir scripts, styles, images,
// frames, etc. `unsafe-inline` reste nécessaire pour les styles inline générés
// par Tailwind/CVA et pour les <style> JSX. Pour les iframes, on autorise
// uniquement YouTube (no-cookie) et Google Maps embed.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next dev a besoin de eval
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.google.com",
  // data:/blob: nécessaires : lessonStorage fait fetch() sur les data URLs
  // (images/audio) pour les convertir en Blob avant stockage IndexedDB.
  "connect-src 'self' data: blob: https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 800,
        aggregateTimeout: 200,
        ignored: /node_modules/,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    // La page d'accueil marketing n'est pas encore prête pour le public —
    // on redirige vers la connexion en attendant. Le code de /page.tsx reste
    // en place pour le jour où l'on retire cette redirection.
    return [
      { source: "/", destination: "/login", permanent: false },
    ];
  },
};

export default nextConfig;
