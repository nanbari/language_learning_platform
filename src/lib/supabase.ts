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
        Row: { id: string; email: string; name: string; role: string; is_admin: boolean; points: number; created_at: string };
        Insert: { id?: string; email: string; name: string; role: string; is_admin?: boolean };
        Update: { name?: string; points?: number; is_admin?: boolean };
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
      exercise_events: {
        Row: {
          id: string; user_id: string; lesson_id: string; block_id: string;
          exercise_type: string; event_type: string; correct: boolean | null;
          answer: unknown; attempt_number: number | null; hint_count: number;
          time_ms: number | null; created_at: string;
        };
        Insert: {
          user_id: string; lesson_id: string; block_id: string;
          exercise_type: string; event_type: string; correct?: boolean | null;
          answer?: unknown; attempt_number?: number | null; hint_count?: number;
          time_ms?: number | null;
        };
        Update: never;
      };
      signup_requests: {
        Row: {
          id: string; email: string; name: string; password_hash: string | null;
          status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null;
        };
        Insert: { email: string; name: string; password_hash: string; status?: string };
        Update: { status?: string; password_hash?: string | null; reviewed_at?: string; reviewed_by?: string };
      };
      practice_sets: {
        Row: {
          id: string; user_id: string; lesson_id: string; blocks: unknown; sources: unknown;
          model: string | null; input_tokens: number | null; output_tokens: number | null; created_at: string;
        };
        Insert: {
          user_id: string; lesson_id: string; blocks: unknown; sources?: unknown;
          model?: string | null; input_tokens?: number | null; output_tokens?: number | null;
        };
        Update: never;
      };
    };
  };
};
