import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase du navigateur : clé anonyme (publique), sans session
 * persistée. Il ne sert qu'à Supabase Realtime pendant le cours en direct —
 * les canaux sont privés, ouverts avec le jeton émis par le serveur
 * (hooks/useLiveSession → `supabase.realtime.setAuth`). Aucune lecture de
 * table ne passe par ici : les données viennent des routes /api.
 */
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
