// Matrice d'accès HTTP : sonde une instance de l'application (de préférence
// `next start`, le serveur de dev plante sur les routes dynamiques) avec des
// identités SYNTHÉTIQUES (UUID aléatoires, présents dans aucune table).
//
// Non destructif par construction : chaque mutation envoyée DOIT être refusée
// (401/403/404/400) avant toute écriture ; les seules requêtes acceptées sont
// des GET. Le secret AUTH_SECRET est lu dans .env.local pour signer les
// cookies de test (même mécanisme que l'application) ; rien n'en est affiché.
//
//   node scripts/access-matrix.mjs http://localhost:3001 [docs/audit/access-matrix-results.json]
//
// Note : la base derrière l'instance est celle de .env.local. Les identités
// synthétiques n'y existant pas, les routes qui relisent le profil
// (lib/serverSession) répondent 401 « Session expirée » à toute identité
// signée : c'est le comportement attendu (un cookie valide sans compte ne
// donne rien). Les cas « autorisé » se prouvent par les tests Vitest
// (src/test/routes), avec une base simulée.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [BASE = "http://localhost:3001", OUT = "docs/audit/access-matrix-results.json"] = process.argv.slice(2);
const env = fs.readFileSync(".env.local", "utf8");
const secret = env.match(/^AUTH_SECRET=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const tok = (u, exp = Math.floor(Date.now() / 1000) + 3600) => {
  const p = Buffer.from(JSON.stringify({ ...u, exp })).toString("base64url");
  return `${p}.${crypto.createHmac("sha256", secret).update(p).digest("base64url")}`;
};
const id = () => crypto.randomUUID();
const A = { id: id(), email: "a@test.invalid", name: "Student A", role: "student", isAdmin: false };
const B = { id: id(), email: "b@test.invalid", name: "Student B", role: "student", isAdmin: false };
const T = { id: id(), email: "t@test.invalid", name: "Teacher", role: "teacher", isAdmin: false };
const ADMIN = { id: id(), email: "adm@test.invalid", name: "Admin", role: "teacher", isAdmin: true };
const EXPIRED = tok(A, Math.floor(Date.now() / 1000) - 10);
const TAMPERED = tok(A).replace(/\.[^.]+$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const UNKNOWN_CLASS = id();
const ROOM = id();

const who = { none: null, A: tok(A), B: tok(B), T: tok(T), ADMIN: tok(ADMIN), expired: EXPIRED, tampered: TAMPERED };
const results = [];
async function probe(name, actor, method, url, body, expect, forbidden = []) {
  const headers = { "Content-Type": "application/json" };
  if (who[actor]) headers.cookie = `ms_session=${who[actor]}`;
  let status = 0, redirect = "", text = "";
  try {
    const r = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    status = r.status; redirect = r.headers.get("location") ?? ""; text = await r.text();
  } catch (e) { text = e.message; }
  const statusOk = Array.isArray(expect) ? expect.includes(status) : status === expect;
  const leaked = forbidden.filter((f) => text.includes(f));
  const ok = statusOk && leaked.length === 0;
  results.push({ name, actor, method, url, status, ok, expect, redirect, leaked });
  const why = ok ? "" : `(expected ${expect}${leaked.length ? ", leaked " + leaked.join("|") : ""}) ${text.slice(0, 80).replace(/\s+/g, " ")}`;
  console.log(`${ok ? "PASS" : "FAIL"} ${status} ${actor.padEnd(8)} ${method.padEnd(6)} ${url}  ${why}`);
}

// ── Sans session : chaque route privée refuse ──
for (const [m, u] of [["GET", "/api/lessons"], ["GET", "/api/classes"], ["GET", "/api/events"], ["GET", "/api/progress"], ["GET", "/api/practice/summary"], ["GET", "/api/teacher/insights"], ["GET", "/api/letter-sounds"], ["GET", "/api/vocab-sounds"], ["GET", "/api/admin/signups"], ["GET", "/api/admin/staff"], ["POST", "/api/media"], ["POST", "/api/live-deck"], ["POST", "/api/lessons"], ["POST", "/api/classes"], ["POST", "/api/events"], ["PUT", "/api/letter-sounds"], ["POST", "/api/admin/teachers"],
  ["GET", `/api/classes/${UNKNOWN_CLASS}/live/state?room=${ROOM}`], ["GET", `/api/classes/${UNKNOWN_CLASS}/live/token?room=${ROOM}`], ["POST", `/api/classes/${UNKNOWN_CLASS}/live/answers?room=${ROOM}`], ["PUT", `/api/classes/${UNKNOWN_CLASS}/live/state?room=${ROOM}`],
  ["GET", "/api/classes/live"], ["GET", `/api/lessons/${id()}`]]) {
  await probe("unauthenticated refused", "none", m, u, m === "GET" ? undefined : {}, 401);
}
await probe("expired session refused", "expired", "GET", "/api/lessons", undefined, 401);
await probe("tampered signature refused", "tampered", "GET", "/api/lessons", undefined, 401);

// ── Pages derrière le filtre ──
await probe("page /teacher unauth → login", "none", "GET", "/teacher", undefined, [302, 307, 308]);
await probe("page /student unauth → login", "none", "GET", "/student", undefined, [302, 307, 308]);
await probe("page /arabic unauth → login (changed expectation: was public 200)", "none", "GET", "/arabic", undefined, [302, 307, 308]);
await probe("page /arabic/vocabulary unauth → login", "none", "GET", "/arabic/vocabulary", undefined, [302, 307, 308]);
await probe("page /teacher as student → redirected", "A", "GET", "/teacher", undefined, [302, 307, 308]);
await probe("page /teacher/letters as teacher → redirected", "T", "GET", "/teacher/letters", undefined, [302, 307, 308]);
await probe("page /login stays public", "none", "GET", "/login", undefined, 200);
await probe("page /mot-de-passe-oublie stays public", "none", "GET", "/mot-de-passe-oublie", undefined, 200);
await probe("page /demande-inscription stays public", "none", "GET", "/demande-inscription", undefined, 200);

// ── Identités signées mais sans compte : la relecture du profil refuse (401) ──
// Toute route protégée répond 401 ; aucune n'accepte un cookie orphelin.
await probe("A (no account) events", "A", "GET", "/api/events", undefined, 401);
await probe("A reads B events", "A", "GET", `/api/events?userId=${B.id}`, undefined, 401, [B.id]);
await probe("A reads B progress", "A", "GET", `/api/progress?userId=${B.id}`, undefined, 401, [B.id]);
await probe("A lists lessons", "A", "GET", "/api/lessons", undefined, 401);
await probe("student creates lesson", "A", "POST", "/api/lessons", { title: "x", class_id: UNKNOWN_CLASS, exercises: {} }, 401);
await probe("student starts live", "A", "POST", `/api/classes/${UNKNOWN_CLASS}/live`, {}, 401);
await probe("student live state with room", "A", "GET", `/api/classes/${UNKNOWN_CLASS}/live/state?room=${ROOM}`, undefined, 401, ["slide", "state\":{"]);
await probe("student live token", "A", "GET", `/api/classes/${UNKNOWN_CLASS}/live/token?room=${ROOM}`, undefined, 401, ["eyJ"]);
await probe("student admin staff", "A", "POST", "/api/admin/staff", { id: id(), isAdmin: true }, 401);
await probe("teacher patches unknown class", "T", "PATCH", `/api/classes/${UNKNOWN_CLASS}`, { name: "x" }, 401);
await probe("teacher deletes unknown class", "T", "DELETE", `/api/classes/${UNKNOWN_CLASS}`, undefined, 401);
await probe("teacher PUT letter sound", "T", "PUT", "/api/letter-sounds", { letterId: 1, url: "https://x" }, 401);
await probe("admin (no account) staff list", "ADMIN", "GET", "/api/admin/staff", undefined, 401);

// ── Routes publiques : présentes, validées, sans détail interne ──
await probe("health public", "none", "GET", "/api/health", undefined, 200);
// `db: "ok"` est attendu par keepalive.yml ; seul le texte d'une erreur serait une fuite.
await probe("health deep: no DB error text", "none", "GET", "/api/health?deep=1", undefined, [200, 503], ["relation", "does not exist", "password", "permission denied", "ECONN", "message"]);
await probe("signup rejects empty body", "none", "POST", "/api/signup", {}, [400, 422]);
await probe("enrollment rejects empty body", "none", "POST", "/api/enrollment", {}, [400, 422]);
await probe("password reset rejects empty body", "none", "POST", "/api/auth/password", {}, [400, 422]);
await probe("login rejects empty body", "none", "POST", "/api/auth", {}, [400, 401]);
await probe("auth GET without cookie", "none", "GET", "/api/auth", undefined, 200);

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} expectations met; ${fails.length} unexpected`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), results }, null, 1));
process.exitCode = fails.length ? 1 : 0;
