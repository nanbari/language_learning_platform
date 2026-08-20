// Endpoint de santé pour les probes Kubernetes (liveness/readiness)
// et les health checks du load balancer.
export function GET() {
  return Response.json({ status: "ok" });
}
