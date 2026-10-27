import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client anonyme côté serveur — sert uniquement à vérifier les identifiants
// (auth.signInWithPassword, route /api/auth). Pas de session persistée :
// l'état de session vit dans notre cookie signé (server/auth). Le navigateur
// a son propre client anonyme, lib/supabaseBrowser, réservé à Realtime.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Client anonyme neuf, sans session : pour échanger un lien magique contre
 * une session Supabase (server/liveToken) sans toucher au client partagé.
 */
export function supabaseAnonClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

let adminClient: SupabaseClient | null = null;

/**
 * Client service-role — RÉSERVÉ AUX ROUTES SERVEUR. Contourne la RLS ;
 * l'autorisation (rôle, propriété) est vérifiée dans chaque route via
 * lib/serverSession. Ne jamais importer depuis un composant client.
 *
 * Créé à la première demande et conservé : la clé service n'est disponible
 * qu'à l'exécution, pas au build (où Next évalue les modules des routes).
 */
export function supabaseAdmin() {
  if (adminClient) return adminClient;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
