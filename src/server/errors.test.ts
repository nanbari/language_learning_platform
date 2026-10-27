import { describe, it, expect, vi, afterEach } from "vitest";
import { serverError, unavailable } from "@/server/errors";

afterEach(() => vi.restoreAllMocks());

describe("serverError / unavailable", () => {
  it("renvoie un message stable et une référence, et garde le détail côté serveur", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError("/api/test error", { message: 'relation "public.secret_table" does not exist', code: "42P01" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Erreur serveur");
    expect(body.ref).toMatch(/^[a-z0-9]{4,8}$/);
    expect(JSON.stringify(body)).not.toContain("secret_table");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain(body.ref);
    expect(String(log.mock.calls[0][0])).toContain("secret_table");
  });

  it("503 pour une autorisation impossible à établir", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = unavailable("session", new Error("ECONNRESET"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/indisponible/);
    expect(JSON.stringify(body)).not.toContain("ECONNRESET");
  });
});
