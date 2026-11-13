/**
 * Base en mémoire qui imite le client supabase-js (query builder PostgREST)
 * pour les tests des routes API : les routes s'exécutent telles quelles,
 * avec leurs vérifications de session et de droits ; seule la base est
 * remplacée. Ce n'est pas une preuve des politiques RLS du projet Supabase
 * réel : celles-ci se vérifient dans l'environnement (voir docs/audit).
 *
 *   vi.mock("@/server/supabase", () => fakeSupabaseModule());
 *   const db = fakeDb(); db.seed("users", [...]);
 */

export type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type Op = "select" | "insert" | "update" | "delete" | "upsert";
type DbError = { message: string; code?: string; details?: string };

const PRIMARY_KEYS: Record<string, string[]> = {
  exercise_events: ["event_id"],
  live_participants: ["class_id", "student_id"],
  vocab_sounds: ["word_id"],
  letter_sounds: ["letter_id"],
};

/** Nom au singulier pour la relation inverse : classes → class_id. */
function singular(table: string): string {
  return table.endsWith("es") && !table.endsWith("ses") ? table.slice(0, -2) : table.replace(/s$/, "");
}

interface Projection { column: string; alias?: string; table?: string; fk?: string; inner?: string }

function splitTopLevel(cols: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of cols) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseProjection(cols: string): Projection[] {
  return splitTopLevel(cols).map((part) => {
    const rel = part.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\(([^]*)\)$/);
    if (rel) return { alias: rel[1] ?? rel[2], table: rel[2], fk: rel[3], inner: rel[4], column: rel[1] ?? rel[2] };
    return { column: part.trim() };
  });
}

export class FakeDb {
  tables = new Map<string, Row[]>();
  pokes: { topic: string; event: string }[] = [];
  /** L'API Auth simulée délivre-t-elle des liens magiques ? (false = Supabase Auth indisponible) */
  authLinks = true;
  /** La fonction SQL rate_limit_hit existe-t-elle ? */
  rateLimitFunction = true;
  rateHits = new Map<string, number>();
  /** Comptes Supabase Auth créés par invitation (e-mail → id) ; les profils semés par seed() n'y figurent pas. */
  authUsers = new Map<string, string>();
  /** E-mails d'invitation « envoyés » par l'API Auth simulée. */
  invitations: { email: string; data: Row; redirectTo?: string }[] = [];
  /** L'envoi d'e-mails fonctionne-t-il ? (false = SMTP absent ou limite d'envoi atteinte) */
  smtp = true;
  /** Adresses invitées dont le compte n'est pas encore activé (mot de passe pas encore choisi). */
  invited = new Set<string>();
  /** Comptes Auth qui ont un mot de passe (e-mail → id et mot de passe), pour signInWithPassword. */
  passwords = new Map<string, { id: string; password: string }>();
  private failures: { table: string; op: Op; error: DbError }[] = [];
  private nextId = 1;

  reset() { this.tables.clear(); this.pokes = []; this.failures = []; this.nextId = 1; this.authLinks = true; this.rateLimitFunction = true; this.rateHits = new Map(); this.authUsers = new Map(); this.invitations = []; this.smtp = true; this.passwords = new Map(); this.invited = new Set(); }
  createAuthUser(email: string): string {
    const id = `00000000-0000-4000-9000-${String(this.authUsers.size + 1).padStart(12, "0")}`;
    this.authUsers.set(email, id);
    return id;
  }
  seed(table: string, rows: Row[]) { this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows.map((r) => ({ ...r }))]); }
  rows(table: string): Row[] { return (this.tables.get(table) ?? []).map((r) => ({ ...r })); }
  /** Copie profonde de toute la base, pour prouver qu'une requête refusée n'a rien changé. */
  snapshot(): string { return JSON.stringify([...this.tables.entries()].sort()); }
  /** La prochaine opération `op` sur `table` échouera comme Supabase échouerait. */
  failNext(table: string, op: Op, error: DbError = { message: `relation "public.${table}" does not exist`, code: "42P01" }) {
    this.failures.push({ table, op, error });
  }
  takeFailure(table: string, op: Op): DbError | null {
    const i = this.failures.findIndex((f) => f.table === table && f.op === op);
    return i < 0 ? null : this.failures.splice(i, 1)[0].error;
  }
  allocId(): number { return this.nextId++; }

  project(table: string, row: Row, cols: string): Row {
    if (!cols || cols.trim() === "*") return { ...row };
    const out: Row = {};
    for (const p of parseProjection(cols)) {
      if (!p.table) { out[p.column] = row[p.column]; continue; }
      const relTable = p.table;
      // `users!live_answers_student_id_fkey` → colonne student_id de cette table.
      const fkColumn = p.fk
        ? p.fk.replace(new RegExp(`^${table}_`), "").replace(/_fkey$/, "")
        : p.alias && `${p.alias}_id` in row ? `${p.alias}_id` : null;
      if (fkColumn) {
        const target = (this.tables.get(relTable) ?? []).find((r) => r.id === row[fkColumn]);
        out[p.alias!] = target ? this.project(relTable, target, p.inner ?? "*") : null;
      } else {
        const back = `${singular(table)}_id`;
        out[p.alias!] = (this.tables.get(relTable) ?? []).filter((r) => r[back] === row.id).map((r) => this.project(relTable, r, p.inner ?? "*"));
      }
    }
    return out;
  }
}

class Builder implements PromiseLike<{ data: unknown; error: DbError | null; count?: number }> {
  private op: Op = "select";
  private cols = "*";
  private filters: Filter[] = [];
  private payload: Row[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private wantSelect = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private db: FakeDb, private table: string) {}

  select(cols = "*") { if (this.op === "select") this.cols = cols; else { this.wantSelect = true; this.cols = cols; } return this; }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  private ignoreDuplicates = false;
  upsert(rows: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = "upsert"; this.payload = Array.isArray(rows) ? rows : [rows]; this.ignoreDuplicates = opts?.ignoreDuplicates === true; return this; }
  update(values: Row) { this.op = "update"; this.payload = [values]; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] !== val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  gte(col: string, val: unknown) { this.filters.push((r) => String(r[col]) >= String(val)); return this; }
  lte(col: string, val: unknown) { this.filters.push((r) => String(r[col]) <= String(val)); return this; }
  is(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private matching(rows: Row[]) { return rows.filter((r) => this.filters.every((f) => f(r))); }

  private run(): { data: unknown; error: DbError | null } {
    const failure = this.db.takeFailure(this.table, this.op);
    if (failure) return { data: null, error: failure };
    const rows = this.db.tables.get(this.table) ?? [];
    this.db.tables.set(this.table, rows);
    let result: Row[] = [];

    if (this.op === "select") {
      result = this.matching(rows);
      for (const o of [...this.orders].reverse()) {
        result.sort((a, b) => (String(a[o.col]) < String(b[o.col]) ? -1 : String(a[o.col]) > String(b[o.col]) ? 1 : 0) * (o.asc ? 1 : -1));
      }
      if (this.max !== null) result = result.slice(0, this.max);
    } else if (this.op === "insert" || this.op === "upsert") {
      const pk = PRIMARY_KEYS[this.table] ?? ["id"];
      for (const p of this.payload) {
        const row: Row = { ...p };
        if (!("id" in row) && !PRIMARY_KEYS[this.table]) {
          row.id = Math.max(this.db.allocId(), ...rows.map((r) => (typeof r.id === "number" ? r.id + 1 : 0)));
        }
        if (!("created_at" in row)) row.created_at = new Date().toISOString();
        const keyed = pk.every((k) => row[k] !== undefined && row[k] !== null);
        const idx = keyed ? rows.findIndex((r) => pk.every((k) => r[k] === row[k])) : -1;
        if (idx >= 0) {
          if (this.op === "insert") return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
          if (this.ignoreDuplicates) continue;
          rows[idx] = { ...rows[idx], ...row };
          result.push(rows[idx]);
        } else {
          if (!("id" in row) && PRIMARY_KEYS[this.table] && !pk.includes("id")) row.id = this.db.allocId();
          rows.push(row); result.push(row);
        }
      }
    } else if (this.op === "update") {
      for (const r of this.matching(rows)) { Object.assign(r, this.payload[0]); result.push(r); }
    } else if (this.op === "delete") {
      const gone = this.matching(rows);
      this.db.tables.set(this.table, rows.filter((r) => !gone.includes(r)));
      result = gone;
    }

    if (this.op !== "select" && !this.wantSelect) return { data: null, error: null };
    const projected = result.map((r) => this.db.project(this.table, r, this.cols));
    if (this.mode === "single") {
      if (projected.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      return { data: projected[0], error: null };
    }
    if (this.mode === "maybe") return { data: projected[0] ?? null, error: null };
    return { data: projected, error: null };
  }

  then<R1 = unknown, R2 = never>(
    onfulfilled?: ((value: { data: unknown; error: DbError | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function fakeClient(db: FakeDb) {
  return {
    from: (table: string) => new Builder(db, table),
    /** Fonctions SQL simulées : rate_limit_hit (compteur en mémoire). */
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "rate_limit_hit") {
        if (!db.rateLimitFunction) return { data: null, error: { message: "function public.rate_limit_hit does not exist", code: "42883" } };
        const key = String(args.p_key); const n = (db.rateHits.get(key) ?? 0) + 1; db.rateHits.set(key, n);
        return { data: n <= Number(args.p_limit), error: null };
      }
      return { data: null, error: { message: `function ${name} does not exist`, code: "42883" } };
    },
    channel: (topic: string) => ({
      httpSend: async (event: string) => { db.pokes.push({ topic, event }); return "ok"; },
    }),
    auth: {
      /** Mots de passe simulés : db.passwords (e-mail → id du compte et mot de passe). */
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const known = db.passwords.get(email);
        if (!known || known.password !== password) return { data: { user: null }, error: { message: "Invalid login credentials" } };
        return { data: { user: { id: known.id, email, user_metadata: {} } }, error: null };
      },
      admin: {
        /** Lien magique simulé : le jeton porte l'e-mail, verifyOtp le reconnaît. */
        /** Invitation : crée le compte Auth et « envoie » l'e-mail (db.invitations), sauf si db.smtp est coupé. */
        inviteUserByEmail: async (email: string, options?: { data?: Row; redirectTo?: string }) => {
          // Comme Supabase : un compte invité mais pas encore activé n'est pas refusé,
          // son invitation est renvoyée et le MÊME compte est rendu.
          const pendingInvite = db.authUsers.has(email) && db.invited.has(email);
          if (db.authUsers.has(email) && !pendingInvite) return { data: { user: null }, error: { status: 422, message: "A user with this email address has already been registered" } };
          if (!db.smtp) return { data: { user: null }, error: { status: 500, message: "Error sending invite email" } };
          const id = pendingInvite ? db.authUsers.get(email)! : db.createAuthUser(email);
          db.invited.add(email);
          db.invitations.push({ email, data: options?.data ?? {}, redirectTo: options?.redirectTo });
          return { data: { user: { id, email } }, error: null };
        },
        /** Création directe (sans e-mail) : profil rattaché à un compte famille. */
        createUser: async ({ email }: { email: string; email_confirm?: boolean; user_metadata?: Row }) => {
          if (db.authUsers.has(email)) return { data: { user: null }, error: { status: 422, message: "A user with this email address has already been registered" } };
          return { data: { user: { id: db.createAuthUser(email), email } }, error: null };
        },
        deleteUser: async (id: string) => {
          for (const [email, uid] of db.authUsers) if (uid === id) { db.authUsers.delete(email); db.invited.delete(email); }
          // Comme la base réelle : le profil suit le compte Auth (users.id → auth.users on delete cascade).
          db.tables.set("users", (db.tables.get("users") ?? []).filter((u) => u.id !== id));
          return { data: {}, error: null };
        },
        generateLink: async ({ type, email }: { type?: string; email: string; options?: unknown }) => {
          // Liens d'invitation / de récupération (comptes créés par un admin) : compte Auth, sans e-mail envoyé.
          if (type === "invite" || type === "recovery") {
            const known = db.authUsers.get(email);
            if (type === "invite" && known) return { data: { user: null, properties: null }, error: { status: 422, message: "A user with this email address has already been registered" } };
            if (type === "recovery" && !known) return { data: { user: null, properties: null }, error: { status: 404, message: "User not found" } };
            const id = known ?? db.createAuthUser(email);
            return { data: { user: { id, email }, properties: { action_link: `https://auth.test.invalid/verify?type=${type}&email=${encodeURIComponent(email)}` } }, error: null };
          }
          const user = (db.tables.get("users") ?? []).find((u) => u.email === email);
          if (!db.authLinks || !user) return { data: { properties: null }, error: { message: "User not found" } };
          return { data: { properties: { hashed_token: `hash:${email}` } }, error: null };
        },
      },
      verifyOtp: async ({ token_hash }: { token_hash: string }) => {
        const email = token_hash.replace(/^hash:/, "");
        const user = (db.tables.get("users") ?? []).find((u) => u.email === email);
        if (!user) return { data: { session: null }, error: { message: "Token has expired or is invalid" } };
        const expires_at = Math.floor(Date.now() / 1000) + 3600;
        return { data: { session: { access_token: `supabase-session:${user.id}`, expires_at } }, error: null };
      },
    },
  };
}

let shared: FakeDb | null = null;
/** La base partagée par le module simulé et les tests (réinitialisée via reset()). */
export function fakeDb(): FakeDb { return (shared ??= new FakeDb()); }

/** Remplace "@/server/supabase" : même base pour le client anonyme et le client service-role. */
export function fakeSupabaseModule() {
  const db = fakeDb();
  const client = fakeClient(db);
  return { supabase: client, supabaseAdmin: () => client, supabaseAnonClient: () => client };
}
