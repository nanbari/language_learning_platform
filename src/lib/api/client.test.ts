import { describe, it, expect } from "vitest";
import { ApiError, apiFetch, jsonOrThrow } from "@/lib/api/client";

const response = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("jsonOrThrow", () => {
  it("rend le JSON d'une réponse acceptée", async () => {
    expect(await jsonOrThrow<{ ok: true }>(response(200, { ok: true }))).toEqual({ ok: true });
  });

  it("lève ApiError avec le message du serveur, le statut et la référence", async () => {
    const err = await jsonOrThrow(response(500, { error: "Erreur serveur", ref: "ab12cd" })).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500, message: "Erreur serveur", ref: "ab12cd" });
  });

  it("garde un message lisible quand la réponse n'est pas du JSON", async () => {
    const err = await jsonOrThrow(new Response("<html>", { status: 502 })).catch((e) => e);
    expect(err).toMatchObject({ status: 502, message: "Erreur serveur (502)" });
  });
});

describe("apiFetch", () => {
  it("désactive le cache du navigateur pour les données privées", async () => {
    const calls: RequestInit[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { calls.push(init ?? {}); return response(200, []); }) as typeof fetch;
    try {
      await apiFetch("/api/x");
      await apiFetch("/api/y", { method: "DELETE" });
    } finally {
      globalThis.fetch = original;
    }
    expect(calls.map((c) => c.cache)).toEqual(["no-store", "no-store"]);
    expect(calls[1]?.method).toBe("DELETE");
  });
});
