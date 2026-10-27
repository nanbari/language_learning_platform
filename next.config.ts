import type { NextConfig } from "next";

// Content-Security-Policy : restreint d'où peuvent venir scripts, styles, images,
// frames, etc. `unsafe-inline` reste nécessaire pour les styles inline générés
// par Tailwind/CVA et pour les <style> JSX. Pour les iframes, on autorise
// uniquement YouTube (no-cookie), Google Maps embed et nos propres pages
// (l'aperçu élève de l'éditeur de leçons).
// `unsafe-eval` n'est nécessaire qu'au serveur de développement (Turbopack) :
// en production, les scripts sont compilés, l'évaluation dynamique est refusée.
const scriptSrc = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const cspDirectives = (frameAncestors: string) => [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // https: pour les vidéos/audios hébergés (bucket R2 public, liens directs).
  "media-src 'self' data: blob: https:",
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://www.google.com",
  // data:/blob: nécessaires : lessonStorage fait fetch() sur les data URLs
  // (images/audio) pour les convertir en Blob avant stockage IndexedDB.
  // *.r2.cloudflarestorage.com : PUT direct des médias vers R2 (URL signée).
  // *.r2.dev : le lecteur de diaporama fetch() les audios depuis le bucket public.
  "connect-src 'self' data: blob: https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://*.r2.dev",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
  "upgrade-insecure-requests",
].join("; ");
const csp = cspDirectives("'none'");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Build autonome pour le déploiement Docker/Kubernetes : .next/standalone
  // contient le serveur et les seuls node_modules nécessaires.
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  images: {
    // Photos provisoires de la page d'accueil, à remplacer par les vraies photos dans /public.
    // Et les médias des leçons sur R2 : next/image les redimensionne à la taille affichée
    // (les originaux font 2 à 3 Mo). Le domaine public du bucket vient de l'environnement ;
    // les buckets *.r2.dev sont acceptés en plus, pour les environnements sans variable.
    remotePatterns: [
      new URL("https://picsum.photos/**"),
      new URL("https://*.r2.dev/**"),
      ...(process.env.R2_PUBLIC_BASE_URL ? [new URL(`${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/**`)] : []),
    ],
    formats: ["image/avif", "image/webp"],
    // Les photos ne changent jamais sous la même clé R2 : un cache d'un mois côté CDN.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    qualities: [70, 75],
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
      // L'aperçu élève s'affiche dans un cadre de l'éditeur de leçons : seul
      // notre propre site peut l'encadrer.
      {
        source: "/teacher/create/apercu",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives("'self'") },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
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
