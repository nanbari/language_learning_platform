# Monte & Souris — production readiness audit

Date: 2026-10-27 · Scope: read-only audit of the working tree at commit `c2ab603` plus the 84 uncommitted
files of the current session (redesign, journeys, vocabulary voice storage, dead-code pass). No application
code, configuration, data or dependency was changed by this audit. No request touched production data:
every probe used synthetic identities (random UUIDs that exist in no table) and only sent mutations that
the server must refuse before any write.

Stack under audit: Next.js 16.2.6 (App Router, `src/proxy.ts`), React 19.2.4, `@supabase/supabase-js`
2.103, Supabase Postgres + Auth (prod project also used by local dev), Cloudflare R2 for media,
Netlify hosting (`monteetsouris.com`), Anthropic API for practice-set generation.

---

## 1. Architecture and access surface

**Trust boundaries**

| Layer | Mechanism | Notes |
|---|---|---|
| Browser → Next.js | HMAC-SHA256 signed cookie `ms_session` (`src/lib/auth.ts`): `{id,email,name,role,isAdmin,exp}` + signature with `AUTH_SECRET`. httpOnly, `secure` in prod, `SameSite=Lax`. TTL 8 h, or 7 d with "stay signed in". | Claims are **self-contained**: role/admin are not re-read from the DB until the cookie expires or `GET /api/auth` is called. |
| Page protection | `src/proxy.ts`, matcher `["/teacher/:path*", "/student/:path*"]` → 307 to `/login` without a valid cookie; role mismatch redirects. | `/arabic`, `/arabic/reading`, `/arabic/vocabulary` are **outside the matcher** (public, 200 unauthenticated). They are not linked from any navigation. |
| API routes (22) | Every private route calls `verifySession()` then checks role/ownership itself. | DB access through the **service-role** client (`supabaseAdmin`) → RLS is bypassed; authorisation lives entirely in route code (`src/app/api/classes/access.ts` documents this). |
| Realtime (live class) | Browser Supabase client with the **public anon key**; broadcast + presence channels named from the class's `live_room` UUID (`src/lib/useLiveVideo.ts`, `src/lib/presentation.ts`). | Channel membership is only gated by knowing the room UUID (handed to the class's students by `GET /api/classes`). Anon RLS policies: none needed for broadcast/presence, but nothing stops a holder of the UUID from publishing. |
| Media | `POST /api/media` (staff) → 10-minute presigned PUT to a **public R2 bucket**, random object key; MIME type and size validated server-side. Browser uploads directly. | Public bucket: anyone with a URL can read; URLs are unguessable but permanent. |
| Password reset / login | Supabase Auth (`signInWithPassword`, `resetPasswordForEmail`); password hashes never stored by the app. Same response for unknown e-mail vs bad password. | Supabase applies its own auth rate limits; the app adds none. |
| Public write endpoints | `POST /api/signup`, `POST /api/enrollment` (requests queued for admin approval), `POST /api/auth/password`. | Server-side validation present; no rate limit, no CAPTCHA. |
| AI | `src/lib/practiceGenerator.ts` sends the lesson content and the student's wrong answers to Anthropic. | No name/e-mail observed in the prompt; still student-performance data leaving the EU. |

**Routes** (all under `/api`): `admin/enrollments`, `admin/signups`, `admin/staff`, `admin/teachers`, `auth`,
`auth/password`, `classes`, `classes/[id]`, `classes/[id]/live`, `enrollment`, `events`, `health`, `lessons`,
`letter-sounds`, `live-deck`, `media`, `practice`, `practice/summary`, `progress`, `signup`,
`teacher/insights`, `vocab-sounds`.

**Data model touched by server code**: `users`, `lessons` (JSON `exercises` with `blocks` + `live` deck),
`classes` (`teacher_id`, `live_room`, `live_started_at`), `class_members`, `exercise_events`, `practice_sets`,
`progress`, `signup_requests`, `enrollment_requests`, `letter_sounds`, `question_sounds`, `vocab_sounds`
(migration written this session, **not yet applied**).

---

## 2. Permission matrix (as implemented, verified by probe where marked ✔)

| Resource / action | Anonymous | Student | Teacher | Admin (teacher + `isAdmin`) |
|---|---|---|---|---|
| `/teacher/*`, `/student/*` pages | 307 → login ✔ | own area only ✔ | own area only ✔ | teacher area |
| `/arabic/*` pages | **200 ✔** | 200 | 200 | 200 |
| `GET /api/lessons` | 401 ✔ | lessons of own classes ✔ | **all lessons** (any author; `?authorId=` other → 403 ✔) | all |
| `POST/PATCH/DELETE /api/lessons` | 401 ✔ | 403 ✔ | own lessons; class must be owned ✔ | any |
| `GET /api/classes` | 401 ✔ | own classes' live rooms ✔ | own classes | all |
| `POST /api/classes` | 401 ✔ | 403 ✔ | ✔ | ✔ |
| `PATCH/DELETE /api/classes/:id`, `POST/DELETE …/live` | 401 ✔ | 403 ✔ | owned class only; unknown/foreign → 404 ✔ (prod build) | any |
| `GET /api/events`, `/progress`, `/practice`, `/practice/summary` | 401 ✔ | self only; other `userId` → 403 ✔ | **any student** ✔ | any |
| `POST /api/events` | 401 ✔ | self (`user_id` stamped from session) ✔ | 403 ✔ | 403 |
| `POST /api/media`, `POST /api/live-deck` | 401 ✔ | 403 ✔ | ✔ (type/size validated ✔) | ✔ |
| `GET /api/letter-sounds`, `/vocab-sounds` | 401 ✔ | 200 | 200 | 200 |
| `PUT/DELETE /api/letter-sounds` | 401 ✔ | 403 ✔ | **403 ✔ (admin only)** | ✔ |
| `PUT/DELETE /api/vocab-sounds` | 401 ✔ | 403 ✔ | ✔ (URL must be on R2 ✔) | ✔ |
| `/api/admin/*` | 401 ✔ | 403 ✔ | 403 ✔ | ✔ (cannot remove own admin right) |
| `/api/teacher/insights` | 401 ✔ | 403 ✔ | ✔ | ✔ |
| `/api/signup`, `/api/enrollment`, `/api/auth/password`, `/api/health` | public, validated ✔ | — | — | — |
| Expired / tampered cookie | 401 ✔ on every private route | | | |

---

## 3. Confirmed defects (evidence in hand)

| # | Severity | Defect | Evidence | Impact |
|---|---|---|---|---|
| D1 | High | **Live-class channels trust the room UUID alone.** Broadcast/presence use the anon key; any party holding the UUID (a student who shares it, a former student still in the class list, a device that cached it) can publish `state`/`answer`/`end` events as if they were the teacher, and every student receives every other student's answers. | `src/lib/useLiveVideo.ts:178-259`, `src/lib/presentation.ts`; no server-side check of sender identity. | Disruption of a live lesson with minors; answers of one child visible to the others' devices (even if the UI hides them). |
| D2 | Medium | **Role/admin claims live in the cookie for up to 7 days.** Removing a teacher's admin right or deactivating an account does not take effect until the cookie expires or the client calls `GET /api/auth`; routes never re-read `users`. | `src/lib/auth.ts:39-41,119`; no DB lookup in `verifySession`. | Revocation delay; a dismissed staff member keeps API access for the cookie's remaining life. |
| D3 | Medium | **Raw database error text returned to clients** in 28 `status: 500` sites across API routes, plus `/api/health?deep=1` (`db: error.message`, public). | `grep "error.message" src/app/api -r`; `src/app/api/health/route.ts:22`. | Schema/table names and constraint names leak to any caller; health endpoint leaks DB state unauthenticated. |
| D4 | Medium | **Lesson saves are last-write-wins.** `PATCH /api/lessons` merges the stored `exercises` with the request body with no version/`updated_at` check; two tabs or two admins editing the same lesson silently overwrite each other's blocks. | `src/app/api/lessons/route.ts:112-116`. | Silent loss of teaching content. |
| D5 | Medium | **No automated tests on any API route** (20 vitest files, all on `src/lib`; 0 under `src/app/api`). The access rules in §2 are enforced only by hand-written route code and were verified in this audit by an external probe script. | `find src -name "*.test.ts*"`. | Regressions in authorisation would ship unnoticed. |
| D6 | Low | **CSP allows `'unsafe-inline' 'unsafe-eval'` in production** (comment says it is for Next dev). | `next.config.ts:10`. | Weakens XSS mitigation; Next can run with a nonce-based CSP. |
| D7 | Low | **`/arabic/*` is public and unauthenticated** (outside the proxy matcher, no session check in the pages), and now serves teacher-recorded vocabulary audio to anyone. | Probe: `GET /arabic` → 200 without cookie; `src/proxy.ts:46`. | Exposure of recorded voice of staff; ambiguous whether intended (see §5). |
| D8 | Low | **Public write endpoints have no app-level rate limiting**: `/api/signup`, `/api/enrollment`, `/api/auth` (login). Login relies on Supabase Auth's limits; signup/enrollment rely on nothing. | Route sources; no middleware. | Queue flooding of `signup_requests`/`enrollment_requests`; credential stuffing throttled only by Supabase defaults. |
| D9 | Low | **Student event batches are dropped silently** when the client flush fails (no retry queue), and `POST /api/events` has no idempotency key or check that the student can see the lesson. | `src/lib/exerciseEvents.ts`, `src/app/api/events/route.ts:55-73`. | Lost progress on flaky mobile networks; events can be attached to arbitrary `lesson_id`. |
| D10 | Low | **`vocab_sounds` migration not applied** — the new recording storage degrades to "no sounds" (`GET` returns `{}` if the table is missing) until `supabase/migrations/2026-10-27_vocab_sounds.sql` is run. | Route code handles the missing table. | Feature inert in prod until the owner runs the SQL. |

**Investigated and cleared.** The first access-matrix run against the dev server reported three 500s
(`PATCH/DELETE /api/classes/<unknown uuid>`, `POST …/live` as a non-admin teacher). The response body was the
Next dev overlay with `Error: Jest worker encountered 2 child process exceptions` — the dev compiler's worker
crashing on dynamic `[id]` segments (the dev log shows the same crash for `/student/practice/[id]`), not the
route. The same matrix against the production build (`next start`, port 3001, build newer than the last
source change) passed **65/65**; `ownedClass()` returns 404 for unknown or foreign classes as designed.
Results: `docs/audit/access-matrix-results.json` (dev, 62/65) and `docs/audit/access-matrix-results.prod.json`
(prod build, 65/65).

---

## 4. Unverified risks (need owner input or access I did not use)

- **RLS on the Supabase project.** Seven of ten migrations enable RLS on their tables (three are `ALTER`s on
  existing tables). Whether `users`, `lessons`, `progress`, `exercise_events`, `practice_sets` have RLS
  enabled *in the live project* cannot be confirmed from the repo. With the anon key shipped to every
  browser, any table without RLS is readable from the Supabase REST endpoint. **This is the single most
  important check to run in the Supabase dashboard** (Table editor → RLS status per table).
- **Supabase Auth settings**: e-mail confirmation, password policy, rate limits, redirect URL allow-list for
  the reset link (`NEXT_PUBLIC_SITE_URL` is reportedly not set on Netlify yet — the reset e-mail may point
  to the wrong host).
- **R2 bucket policy**: assumed public-read; CORS and lifecycle rules not inspected. Deleted lessons do not
  delete their media (orphans accumulate; no cleanup job).
- **Netlify runtime**: environment variables, Node version, function timeout for the Anthropic call in
  `/api/practice` (generation can exceed 10 s).
- **Data-protection posture**: children's performance data and staff voice recordings are processed by
  Supabase (region unknown from repo), Cloudflare R2 and Anthropic (US). No privacy notice or retention
  rule exists in the codebase; parents' consent flow covers enrollment only.
- **`progress` table** is writable through `/api/progress` but no UI reads it; its purpose is unclear.
- **Backups / point-in-time recovery** on the Supabase plan: unknown.

---

## 5. Ambiguous business rules (decide before fixing)

1. **Teacher visibility across classes.** Any teacher can read any student's events/practice (`?userId=`) and
   list all lessons of all authors. Intended for a small team, or should a teacher see only the students of
   their own classes?
2. **`/arabic/*` exercises**: public demo, or part of the student area (then protect and link it)?
3. **Class size.** The brief mentions a limit of six children per class; nothing enforces it.
4. **Lesson ownership vs. sharing**: can another teacher reuse (copy) a lesson, or edit it? Today: read all,
   edit own only, admin edits all.
5. **Account lifecycle**: there is no "deactivate student" action; removing a child from a class keeps the
   account and its data indefinitely. Retention period for `exercise_events`?
6. **Who may record vocabulary audio**: today any teacher (letter sounds: admin only). Align the two?

---

## 6. Prioritised remediation plan (no change made yet)

**Batch 1 — before the next deploy (≈ 1 day)**
- Apply `2026-10-27_vocab_sounds.sql`; verify RLS status of every table in the dashboard (§4) and enable it
  where missing (the app never relies on anon reads, so a blanket "deny anon" is safe).
- D3: wrap Supabase errors — log server-side, return a generic `{ error: "Erreur serveur" }`; make
  `/api/health?deep=1` return only `degraded` without the message.
- D6: prod CSP without `'unsafe-eval'`; move `'unsafe-inline'` to a nonce (Next supports `nonce` via
  `headers()`), keep the dev exception.
- Set `NEXT_PUBLIC_SITE_URL` on Netlify (password-reset links).

**Batch 2 — live class integrity (≈ 2 days)**
- D1: sign the teacher's broadcasts. Minimal version: the presenter sends a per-session random token with
  each `state`/`end` message and students accept only the token they received from `GET /api/classes`
  (served only to members). Stronger version: Supabase Realtime **private channels** with RLS on
  `realtime.messages`, authorised by a short-lived Supabase JWT minted by the server from `ms_session`.
  Stop broadcasting answers to all students: send them only to the presenter's channel.
- D9: queue failed event batches in `localStorage` with an idempotency key and retry on next load; reject
  events whose `lesson_id` the student cannot see.

**Batch 3 — accounts and content safety (≈ 2 days)**
- D2: re-validate the session against `users` on staff mutations and admin routes (one indexed read), or
  add a `token_version` column and embed it in the cookie.
- D4: add `updated_at` optimistic locking to `PATCH /api/lessons` (409 on mismatch, client shows "la
  leçon a été modifiée ailleurs").
- D8: simple IP + e-mail rate limit on signup/enrollment/login (Netlify edge or an in-memory LRU for the
  Node runtime, plus a honeypot field).
- Decide §5-1/2/3 and implement the chosen scope rules (teacher → own classes' students only is a
  one-line filter in `events`, `practice`, `practice/summary`).

**Batch 4 — hardening and hygiene**
- Media: delete R2 objects when a lesson/recording is deleted; object keys prefixed by lesson id.
- Privacy page and retention job for `exercise_events` older than N months; anonymise the Anthropic
  prompt further (block ids instead of free text).
- D5: route tests (see §7) in CI before deploy.

---

## 7. Regression tests to add (D5)

Run with vitest against route handlers (call the exported `GET/POST…` with a `NextRequest` and a minted
cookie; mock `supabaseAdmin`):

1. Every private route → 401 without cookie, 401 with expired cookie, 401 with tampered signature.
2. Student reading another `userId` on `events`, `progress`, `practice`, `practice/summary` → 403.
3. Student on every staff mutation (`lessons`, `classes`, `media`, `live-deck`, `letter-sounds`,
   `vocab-sounds`, `admin/*`) → 403.
4. Non-admin teacher: `PATCH/DELETE classes/:id` and `…/live` on a class with another `teacher_id` → 404;
   `admin/*` → 403; `PUT letter-sounds` → 403; `GET lessons?authorId=other` → 403.
5. `POST /api/events`: `user_id` in the body is ignored and replaced by the session id; batch > `MAX_BATCH`
   → 400.
6. `PUT /api/vocab-sounds` with a URL outside `R2_PUBLIC_BASE_URL` → 400; invalid `wordId` → 400.
7. `POST /api/media` with a disallowed MIME type or oversize file → 400.
8. `PATCH /api/lessons` merge keeps `exercises.live` when only `blocks` are sent (existing behaviour) and, once
   D4 is fixed, returns 409 on a stale `updated_at`.
9. `staffUpdateError`: an admin cannot remove their own admin right (unit test exists for the helper; add the
   route-level case).
10. The access-matrix script itself (`docs/audit/` + scratchpad `access-matrix.mjs`) as a smoke test against a
   `next start` instance in CI: expected 65/65.

---

## 8. Checks actually executed, and blockers

| Check | Result |
|---|---|
| Source review of `src/lib/auth.ts`, `src/proxy.ts`, all 22 API routes' auth lines, `classes/access.ts`, realtime hooks, R2 presign, migrations, error-leak grep, test inventory | done (read-only) |
| Access-matrix probe, 65 expectations, synthetic identities, dev server `:3000` | 62/65 — 3 dev-only compiler-worker 500s (see §3) |
| Same probe against the production build (`next start -p 3001`, then stopped) | **65/65** |
| `npx tsc --noEmit` / `npm test` / `npm run build` (end of the last implementation pass, same tree) | 0 errors / 170 passed / build OK (46 pages) |
| Supabase dashboard (RLS state, Auth settings), Netlify env, R2 policy | **not checked** — no credentials used, by design of this pass |
| Dependency vulnerability scan (`npm audit`) | not run (no installs allowed; can be run read-only on request) |
| Load/DoS testing, real accounts, production data | not performed, per the brief |

Nothing was committed, deployed or modified by this audit. Stopping here as instructed; remediation batches
in §6 start only on explicit go-ahead.
