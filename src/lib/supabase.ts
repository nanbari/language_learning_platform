import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client anonyme — sert uniquement à vérifier les identifiants
// (auth.signInWithPassword). Pas de session persistée : chaque appel est
// indépendant, l'état de session vit dans notre cookie signé (lib/auth).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Client service-role — RÉSERVÉ AUX ROUTES SERVEUR. Contourne la RLS ;
 * l'autorisation (rôle, propriété) est vérifiée dans chaque route via la
 * session du cookie. Ne jamais importer depuis un composant client.
 */
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; name: string; role: string; points: number; created_at: string };
        Insert: { email: string; name: string; role: string };
        Update: { name?: string; points?: number };
      };
      lessons: {
        Row: { id: string; title: string; subject: string; age_group: string; author_id: string; exercises: unknown; published_at: string | null; created_at: string };
        Insert: { title: string; subject: string; age_group: string; author_id: string; exercises: unknown };
        Update: { title?: string; exercises?: unknown; published_at?: string };
      };
      progress: {
        Row: { id: string; user_id: string; lesson_id: string; score: number; completed_at: string };
        Insert: { user_id: string; lesson_id: string; score: number };
        Update: { score?: number };
      };
    };
  };
};
