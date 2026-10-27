import { supabaseAdmin } from "@/server/supabase";
import { liveTopics } from "@/lib/liveSession";

/**
 * Signal « il y a du neuf » envoyé par le serveur sur le canal de contrôle
 * de la séance (Supabase Realtime, diffusion par l'API REST avec la clé
 * service, qui seule a le droit d'y publier). Le message ne porte aucune
 * donnée : les navigateurs relisent l'état ou les réponses par les routes
 * API, qui vérifient leurs droits. Un échec est sans gravité, la relecture
 * périodique prend le relais.
 */
export type LivePokeEvent = "state" | "answers" | "end" | "muteAll";

export async function pokeLive(room: string, event: LivePokeEvent): Promise<void> {
  try {
    const channel = supabaseAdmin().channel(liveTopics(room).control, { config: { private: true } });
    await channel.httpSend(event, { at: Date.now() }, { timeout: 3000 });
  } catch (e) {
    console.warn(`[live] signal « ${event} » non envoyé :`, e instanceof Error ? e.message : e);
  }
}
