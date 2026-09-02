import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Endpoint de santé pour les probes Kubernetes (liveness/readiness)
// et les health checks du load balancer.
//
// Avec ?deep=1, exécute aussi une requête minimale sur Supabase : c'est
// l'activité base de données qui empêche le plan gratuit de se mettre en
// pause (7 jours d'inactivité). Le cron .github/workflows/keepalive.yml
// appelle cette variante. Les probes K8s utilisent la variante rapide
// sans paramètre, qui ne dépend pas de la base.
export async function GET(req: NextRequest) {
  const deep = new URL(req.url).searchParams.get("deep");
  if (!deep) return Response.json({ status: "ok" });

  const { error } = await supabaseAdmin()
    .from("lessons")
    .select("id")
    .limit(1);

  if (error) {
    return Response.json({ status: "degraded", db: error.message }, { status: 503 });
  }
  return Response.json({ status: "ok", db: "ok" });
}
