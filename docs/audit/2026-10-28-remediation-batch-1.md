# Monte & Souris — security remediation, batch 1

Date: 2026-10-28 · Starting point: `docs/audit/2026-10-27-production-audit.md` · Skills used: `ms-access-control`
(invoked), `ms-security-tests` and `ms-architecture` (instructions and references read and applied). All three are local
instruction files, not executable controls.

**Nothing in this batch is deployed.** Everything below is in the working tree of commit `c2ab603` + the uncommitted
redesign work. No migration was applied anywhere: there is no isolated Supabase environment on this machine (no Supabase
CLI; local dev points at the production project), so database-affecting steps are written, tested against an in-memory
stand-in, and handed to the operator with exact steps (§7).

## 0. Verdict in two lines

- **Fixed in code and verified locally** (221 Vitest tests, 51 added; production build; HTTP matrix on the production build):
  authoritative per-request sessions (role/admin/disabled from the database, not the 7-day cookie), server-authoritative
  live class (room id grants nothing; teacher commands and student identity/correctness decided by the server; no student
  ever receives another student's answers), `/arabic/*` private, `/api/health` and all API routes free of raw database
  errors.
- **UNVERIFIED in the deployed environment**: the state of RLS on the production tables, the Realtime private-channel
  policies (migration not applied), the `SUPABASE_JWT_SECRET` setting, and therefore the video-call isolation. Until the
  operator runs §7 and `scripts/live-realtime-check.mjs` against a test project, the live-class **video** fix is *pending
  environment verification*, and the residual window for an already-connected participant is **≤ 15 minutes** (token
  lifetime), not "immediate".

## 1. Evidence re-read, false positive confirmed

- `access-matrix-results.json` (dev server, 62/65) vs `access-matrix-results.prod.json` (production build, 65/65): the three
  dev 500s were `Jest worker encountered 2 child process exceptions` from the dev compiler on `[id]` routes — the same
  error appears in the dev log for `/student/practice/[id]`. `ownedClass()` returns 404 for an unknown/foreign class, which
  the production build confirmed. No application behaviour was changed for this.
- Baseline expectations reviewed against policy. **Changed expectations** (documented, not preserved):
  - `GET /arabic` unauthenticated: was *expected 200* (public) → now *expected redirect to `/login`* (the platform is private).
  - Any synthetic (signed but account-less) identity on a protected route: was 200/403 depending on the cookie's claims →
    now **401 « Session expirée »** because the profile is re-read per request. The legitimate cases are proven by the
    Vitest route tests with an in-memory database instead.
  - `GET /api/health?deep=1` on failure: was `{status, db: <error text>}` → now `{status:"degraded", ref}`.

## 2. Supabase access model (traced from code)

| Path | Identity that reaches Supabase | Credential | Verified |
|---|---|---|---|
| Login (`POST /api/auth`) | the user's e-mail/password → `supabase.auth.signInWithPassword` **server-side**; the returned Supabase session is discarded; `public.users.id` = `auth.users.id` | anon key, server only | code |
| App session | **custom**: HMAC-SHA256 cookie `ms_session` (`src/lib/auth.ts`); no Supabase JWT ever reaches the browser | `AUTH_SECRET` | code + tests |
| Data API from the browser | **none**: no browser code queries tables; the anon client in `src/lib/supabase.ts` is used only for Realtime | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public) | code (grep) |
| Server-side database operations | service-role client (`supabaseAdmin()`), RLS bypassed, authorisation in route code, now preceded by `currentUser()` | `SUPABASE_SERVICE_ROLE_KEY` (server) | code + tests |
| Realtime (before this batch) | anonymous (anon key), public channels named from the room UUID | anon key | code |
| Realtime (after this batch) | per-user **server-minted JWT** (`sub` = `users.id`, `role: authenticated`, 15 min), **private** channels, RLS on `realtime.messages` | `SUPABASE_JWT_SECRET` (server, **not configured yet**) | code + unit tests; provider: UNVERIFIED |
| Storage | not used (media on Cloudflare R2, presigned PUT, public-read bucket) | R2 keys (server) | code |

`auth.uid()` in RLS policies equals the app user id **only** for the minted Realtime JWT (`sub` is set to `users.id`, which is
the Supabase Auth id by construction of the signup/invite flows). For every other path there is no Supabase user context
at all: table policies written for `authenticated` (`is_admin.sql`) are never exercised by this application; they matter
only as a defence if someone uses the anon key directly against the Data API — which is why the RLS state of each table
must be read from the project (§7, `docs/audit/supabase-inventory.sql`).

**Read-only inventory**: `docs/audit/supabase-inventory.sql` lists the queries (tables + RLS flag + policy count, policies,
grants to `anon`/`authenticated`, views, functions and their EXECUTE grants, exposed schemas, storage buckets,
`realtime.messages` RLS, post-migration columns) and the dashboard settings to note. Nothing was run against the project.
Deployed Supabase security stays **UNVERIFIED**.

## 3. Files changed and why

New:
| File | Purpose |
|---|---|
| `src/lib/serverSession.ts` | `currentUser(req)`: verifies the cookie, then **re-reads `public.users`** → role, admin flag, name and `disabled_at` come from the database on every protected request; 401 + cookie cleared if the profile is gone, 403 « Compte désactivé », **503 (fail closed) if the profile cannot be read**. `requireStaff`, `requireAdmin`. |
| `src/lib/apiErrors.ts` | `serverError()` / `unavailable()`: stable French message + short `ref`; provider detail only in server logs (no tokens, no bodies). |
| `src/lib/liveToken.ts` | HS256 JWT for Realtime private channels (`sub`, `role: authenticated`, `ms_room`, `ms_role`, 15 min), `verifyLiveToken` for tests, topic names. |
| `src/lib/livePoke.ts` | server-side REST broadcast (`httpSend`, service role) of empty "something changed" signals on `live:<room>:control`. |
| `src/lib/liveApi.ts` | client calls for the live routes. |
| `src/app/api/classes/[id]/live/access.ts` | `liveAccess(user, classId, room)`: teacher-of-class (or admin) vs current member, room must equal the class's current `live_room`, class must be live for students; 404 otherwise. |
| `src/app/api/classes/[id]/live/state/route.ts` | `PUT` (teacher) stores the current slide in `classes.live_state`; `GET` (members/teacher) returns it; a member with a stale room gets `{status:"ended"}`; student reads double as presence heartbeats. |
| `src/app/api/classes/[id]/live/answers/route.ts` | `POST` (members): identity from session, **correctness computed server-side** from the stored slide (`isCorrectChoice`), 409 if not the current slide; `GET` (teacher only): all answers with names + present students. |
| `src/app/api/classes/[id]/live/token/route.ts` | issues the Realtime token to members/teacher; 503 without `SUPABASE_JWT_SECRET`. |
| `src/app/api/classes/[id]/live/mute/route.ts` | teacher-only "mute all", broadcast by the server on the control topic. |
| `supabase/migrations/2026-10-28_live_class_security.sql` | `classes.live_state/live_state_at`, `users.disabled_at`, `live_answers`, `live_participants` (RLS on, no policies → server only), `ms_live_role()` + `realtime.messages` policies (SELECT for members/teacher of the live class on both topics; INSERT only on the `:video` topic). **Not applied.** |
| `src/test/fakeSupabase.ts`, `src/test/http.ts` | in-memory PostgREST-like database and synthetic cookie/request helpers for route tests. |
| `src/test/routes/{session,access,live,proxy}.test.ts`, `src/lib/{liveToken,apiErrors,liveSessionRules}.test.ts` | 51 new tests (§5). |
| `scripts/access-matrix.mjs` | the HTTP matrix runner, moved into the repo and extended (live routes, `/arabic`, health leakage, public pages). |
| `scripts/live-realtime-check.mjs` | provider-level check for private channels, **to run by the operator against a test project** (refuses URLs that look like production). |
| `docs/audit/supabase-inventory.sql`, `docs/audit/backlog.md` | read-only inventory queries; follow-up backlog (§9). |

Modified:
| File | Change |
|---|---|
| 18 route files under `src/app/api/**` | cookie-only `verifySession` → `currentUser(req)` (authoritative); 28 `error.message` 500s → `serverError(context, error)`; `classes/access.ts` typed and masked too. |
| `src/app/api/auth/route.ts` | shares `profileToSession`; a disabled profile cannot log in; `GET /api/auth` closes the session (cookie cleared) when the profile is gone or disabled. |
| `src/app/api/health/route.ts` | `?deep=1` → `{status:"ok"}` / `{status:"degraded", ref}` (503); error text logged server-side only. Kept because the keepalive cron needs the DB probe. |
| `src/proxy.ts` | matcher + rule for `/arabic/:path*` (same as `/student`: students and admins; teachers → `/teacher`). |
| `src/lib/liveSession.ts` | `isCorrectChoice`, `isLiveState`, `buildTally`, view types; `channelName` removed. |
| `src/lib/useLiveSession.ts` | rewritten: `useLiveLink` (token + private control channel), `useLiveHost` (PUT state, poll answers 2.5 s + poke), `useLiveGuest` (poll state 3 s + poke, `denied` status). |
| `src/lib/useLiveVideo.ts` | private `:video` topic with the token; `muteAll` via the server; no `muteAll` listener on the video channel. |
| `src/app/(platform)/teacher/present/page.tsx`, `src/app/(platform)/student/live/page.tsx` | wiring (`classId`), « Ce cours ne t'est pas ouvert. » state. |
| `src/app/api/classes/[id]/live/route.ts` | start/end clear `live_state`, answers and presence; end pokes `end`. |

Unchanged on purpose: visual design, lessons/practice workflows, teacher cross-class visibility (⚑ decision), CSP, rate
limiting, lesson concurrency (backlog).

## 4. Findings addressed → policy, enforcement point, tests

| Finding (audit id) | Policy | Enforcement | Tests |
|---|---|---|---|
| **D1** live channels trusted the room id; students could publish teacher commands; forged `studentId`; all answers broadcast to all | Room id grants nothing. State: teacher → server → members. Answers: member → server (identity + correctness) → teacher only. Control topic: server publishes, nobody else. Video topic: members only (RLS). | `liveAccess()` on every live route; `realtime.messages` policies (migration); `pokeLive` with service role | `live.test.ts` LIVE-01/02/03/04/05, AUTH-05/07, DATA-01 (12 tests); `liveSessionRules.test.ts`; `liveToken.test.ts`; provider check script (blocked) |
| **D2** cookie claims authoritative for up to 7 days | Identity from the cookie; authority from the database, per request | `currentUser()` in all 22 private routes; `GET /api/auth` closes dead sessions | `session.test.ts` (8), `access.test.ts` AUTH-13 (2), `live.test.ts` LIVE-04 |
| **D3** raw Supabase errors in 500 bodies; `/api/health?deep=1` leaked DB error text | Stable public message + `ref`; detail in logs | `serverError`, `unavailable`, `health` | `apiErrors.test.ts`, `access.test.ts` AUTH-14 (2) |
| **D7** `/arabic/*` public | Private learning area, student rules | `proxy.ts` matcher; `/api/vocab-sounds` already required a session | `proxy.test.ts` (4), HTTP matrix |
| (new) account disablement had no mechanism | `users.disabled_at` blocks login and every protected request | `authenticate()`, `currentUser()` | `session.test.ts` |
| (new) teacher without link got 403 on live routes (existence leak) | 404 like `ownedClass` | `liveAccess` | `live.test.ts` |

Not addressed here (see backlog): D4 lesson last-write-wins, D5 route tests in CI (tests exist; CI job unchanged — `npm test`
already runs them), D6 CSP, D8 rate limiting, D9 offline events, D10 vocab_sounds migration.

## 5. Tests — what ran, what is mocked, what is blocked

Commands (Windows 11, Node 24.14, 2026-10-28):

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **27 files, 221 tests passed** (170 before, 51 added) |
| `npx eslint` (whole project) | 32 errors / 774 warnings — **all pre-existing** (identical count to the audit); touched files: 0 errors, 2 pre-existing warnings (`enrollment.ts`, `signup.ts`) |
| `npm run build` | see §5.1 |
| `node scripts/access-matrix.mjs http://localhost:3001` (production build) | see §5.1 |
| Server-side Realtime REST broadcast (`httpSend`, service role, random private topic, no subscriber, nothing persisted) | `{ success: true }` — the transport `pokeLive` relies on works against the real project |

**Mocked vs real.** Route tests call the real handlers with real signed cookies; the **database is an in-memory stand-in**
(`src/test/fakeSupabase.ts`), so they prove the application's authorisation code, not Supabase's policies. Each denial
asserts status **and** absence of private strings in the body **and** an unchanged database snapshot; each permission has
a positive control (teacher saves state, member reads it, admin lists staff…).

**Blocked / unverified (not counted as passing):**
- Provider-level Realtime checks (private channel join denied for non-members, member cannot publish on the control
  topic, removed member rejected on reconnect): `scripts/live-realtime-check.mjs` is written but **not run** — no isolated
  Supabase project with the migration applied. The script first proves the listener receives an allowed control event
  before asserting any denial.
- Direct Data API access under browser-equivalent credentials (anon key): not run against production by design; the
  inventory SQL tells the operator what to read.
- Realtime token-expiry behaviour (socket closed at `exp`): documented from provider behaviour, not measured.

### 5.1 Build and HTTP matrix

- `npm run build`: **succeeded** (Next 16.2.6, 50 routes incl. the four new `/api/classes/[id]/live/*` handlers).
- `node scripts/access-matrix.mjs http://localhost:3001 docs/audit/access-matrix-results.batch1.json` against that
  build (`next start`, then stopped; database = the production project through `.env.local`, **reads and refused mutations
  only**, synthetic UUID identities): **52/52 expectations met**. Highlights: all 21 private routes 401 unauthenticated
  (including the new live routes, with no `slide`/`state` or token material in the bodies); expired and tampered cookies
  401; `/arabic`, `/arabic/vocabulary`, `/student`, `/teacher` redirect to `/login` unauthenticated while `/login`,
  `/mot-de-passe-oublie`, `/demande-inscription` stay public; every signed-but-account-less identity gets 401 on data
  routes (profile re-read); `/api/health?deep=1` returns no database text; public forms still validate (400).
- The new live routes could not be exercised end-to-end against a real database here (the migration is not applied to
  any database I may write to); their behaviour is covered by the 12 handler tests with the in-memory database.

## 6. Live-class design (what changed, and the residual windows)

Transports inspected: `useLiveSession.ts` (state/answer/end broadcast + presence), `useLiveVideo.ts` (WebRTC signalling:
offer/answer/media/muteAll + presence), the two React pages, `classesApi.ts`. No other realtime user exists (grep of
`@/lib/supabase` in client code).

| Responsibility | Before | After |
|---|---|---|
| Teacher classroom state | browser broadcast on public channel (anyone with the room could publish) | `PUT …/live/state` (teacher of the class only) → `classes.live_state`; server pokes `state`; members `GET` it (3 s poll + poke) |
| Student submissions | broadcast `{studentId, name, correct}` to **everyone** | `POST …/live/answers` (member only), `student_id` from session, `correct` computed from the stored slide; stored in `live_answers`; server pokes `answers` |
| Teacher-only feedback | tally built from broadcasts | `GET …/live/answers` (teacher only) → tally + present students |
| Student-specific feedback | local only | unchanged: the student's own screen shows right/wrong; the API returns only *their* result |
| End / mute all | broadcast by whoever | server-only pokes `end` / `muteAll` on the control topic (no INSERT policy for browsers) |
| Video signalling | public channel | private `:video` topic, members only (RLS at join), identity-bearing fields in presence are display-only (documented) |

Residual risks, stated plainly:
- **Already-connected Realtime participant after removal**: policies are evaluated at channel join and token refresh;
  the API stops issuing tokens immediately, but an open socket keeps the `:video`/`:control` subscription until the token
  expires — **≤ 15 min**. State and answers are cut immediately (API). This window needs explicit acceptance (⚑ backlog 5).
- Video presence `name`/`role` are self-declared (cosmetic: a student could appear as "teacher" tile to classmates). The
  teacher's roster comes from the server, not from presence.
- If `SUPABASE_JWT_SECRET` is absent, video is unavailable (message shown) and slides/answers continue through the API —
  fail closed for the private transport, degraded for the rest.
- Pokes are optional: lost or forged pokes only trigger an extra authenticated fetch.

## 7. Operator actions (not performed) — exact steps

**Prerequisites**: Supabase dashboard access to the production project; Netlify environment access; a maintenance
window of ~10 minutes (the live class is unavailable between migration and deploy if a class is running — do it outside
class hours).

1. **Read-only inventory first** — run `docs/audit/supabase-inventory.sql` in the SQL editor; save the output (no keys) to
   `docs/audit/supabase-inventory-<date>.md`. Confirm: every `public.*` table has `rls_enabled = true`; no `anon` grants
   beyond what RLS denies; `realtime.messages` RLS enabled; Realtime authorization (private channels) enabled in
   *Realtime → Settings*.
2. **Secret**: in Netlify → Site → Environment variables add `SUPABASE_JWT_SECRET` = the project's *JWT Secret*
   (Settings → API; legacy HS256). Do not paste it anywhere else. If the project has moved to asymmetric *JWT Signing
   Keys* with the legacy secret revoked, stop and report: the token route will return 503 and video stays off.
3. **Migration**: run `supabase/migrations/2026-10-28_live_class_security.sql` (and the pending
   `2026-10-27_vocab_sounds.sql`) in the SQL editor. Verify with the last two queries of the inventory file (columns and
   tables present) and `select count(*) from pg_policies where tablename = 'messages'` ≥ 2.
4. **Provider verification** (recommended before deploy): on a *test* Supabase project with the same migration, set the
   four env vars and run `node scripts/live-realtime-check.mjs`; expect 9/9. Record the output under `docs/audit/`.
5. **Deploy** the code (commit + Netlify build). Rollout order matters: migration → secret → deploy.
6. **Verify in production** (synthetic accounts only, created by an admin for the purpose):
   `node scripts/access-matrix.mjs https://monteetsouris.com` (reads and refused mutations only) → all PASS; then a real
   live class with one teacher and two test students: slides follow, answers reach the teacher with names, a third test
   student outside the class gets « Ce cours ne t'est pas ouvert. », video connects; remove one student from the class
   mid-session → their slides stop within 3 s; their video drops within 15 min or on refresh.
7. **Containment / rollback**: redeploy the previous build (Netlify "Publish deploy" on the prior one) — the old code
   ignores the new columns and tables. The `realtime.messages` policies only affect private channels (the old code uses
   public ones), so they can stay; the full rollback SQL is commented at the end of the migration file. If only video
   misbehaves, remove `SUPABASE_JWT_SECRET`: video turns off cleanly, the rest keeps working.

## 8. Status of each correction

| Correction | Implemented in code | Verified locally | Verified on isolated provider env | Applied & verified in deployed env |
|---|---|---|---|---|
| Authoritative sessions / disabled accounts | ✔ | ✔ tests + prod build | n/a (app logic) | ✗ not deployed |
| Live class: state/answers/mute/end through the server | ✔ | ✔ tests (in-memory DB) + build | ✗ no env | ✗ |
| Live class: private Realtime channels + RLS | ✔ code + migration | ✔ token unit tests; REST broadcast smoke OK | ✗ **blocked** (script ready) | ✗ |
| `/arabic/*` private | ✔ | ✔ tests + HTTP matrix | n/a | ✗ |
| Error masking + health | ✔ | ✔ tests + HTTP matrix | n/a | ✗ |
| Production RLS state | — | — | — | **UNKNOWN** (inventory SQL provided) |

## 9. Remaining findings and decisions

See `docs/audit/backlog.md`: rate limiting (needs shared store), CSP hardening (needs browser verification of the live
class), atomic lesson versioning (needs migration approval; draft preserved on 409), offline event retry with idempotency
(events are learning records, not telemetry — priority high), vocab_sounds migration; decisions ⚑ on teacher visibility,
the six-children limit (never by truncation), account lifecycle/retention, lesson sharing, and acceptance of the ≤ 15 min
Realtime window.

Stopping here for review, as instructed, before the broader reliability work.
