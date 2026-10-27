# Monte & Souris — architecture completion plan

Date: 2026-10-28 · Inputs: `docs/architecture/codebase-cleanup-report.md`, `docs/audit/2026-10-28-remediation-batch-1.md`,
`docs/audit/backlog.md`. Scope: the remaining **verified** issues only; no new broad refactoring. Everything implemented in
this pass is isolated, backward compatible and verified locally (§6). Nothing was committed, deployed or applied to a
database.

Legend — **Approval**: *none* (done or doable without owner), *owner* (product/infra decision), *operator* (requires
access to Supabase/Netlify/Cloudflare).

## Priority 1 — Security readiness (deployed environment)

### 1.1 Production RLS state — UNVERIFIED
- **Current**: all tables have `enable row level security` in `supabase/schema.sql` / migrations, with policies written for
  `authenticated` (`auth.uid()`), which this app never uses: every server query runs with the service role; the browser
  only holds the anon key for Realtime. Files: `supabase/schema.sql`, `supabase/migrations/*`, `src/lib/supabase.ts`.
- **Risk**: if any table in the *live* project has RLS off or a permissive `anon` policy, the public anon key reads it
  through the Data API. Cannot be confirmed from the repository.
- **Smallest correction**: run `docs/audit/supabase-inventory.sql` (read-only) and paste the result under `docs/audit/`;
  for any table with `rls_enabled = false`, `alter table … enable row level security` (no policy needed: the app never
  relies on anon/authenticated access).
- **Compatibility**: none affected (service role bypasses RLS).
- **Tests**: `scripts/live-realtime-check.mjs` step 2 (non-member join denied) exercises anon-key access to
  `realtime.messages`; add one `curl` with the anon key against `/rest/v1/users?select=id` expecting an empty result or 401.
- **Approval**: operator (dashboard access). **Blocker for release.**

### 1.2 Realtime private channels — **applied on 2026-10-28 (owner ran both migrations); secret now optional**
- `2026-10-27_vocab_sounds.sql` and `2026-10-28_live_class_security.sql` were executed in the Supabase SQL editor
  ("Success. No rows returned"). Probe from this machine with the public anon key on a random private topic:
  `CHANNEL_ERROR "Unauthorized: You do not have permissions to read from this Channel topic"` → Realtime
  authorization is enforced on the live project.
- `src/server/liveToken.ts` now has a second path: when `SUPABASE_JWT_SECRET` is absent, the server obtains a **real
  Supabase Auth session for the participant** (`auth.admin.generateLink({type:"magiclink"})` exchanged at once with
  `verifyOtp`; the link is never sent or shown). Works whatever the project's signing-key mode (legacy HS256 or
  asymmetric keys). Residual window for an already-connected participant: ≤ 1 h (Supabase session lifetime) in this
  mode, ≤ 15 min with the HS256 secret.
- Consequence handled: a Supabase user JWT also reaches `/rest/v1`. The legacy `authenticated` policies
  ("Authenticated can read lessons", …) would then let a student read every lesson directly. New migration
  `supabase/migrations/2026-10-28_data_api_lockdown.sql` drops those unused policies (RLS stays on; the app only uses
  the service role). **To run by the owner.**
- Tests: `live.test.ts` covers HS256, Supabase-Auth fallback (token bound to the caller, 404 for non-members) and the
  503 when neither is available.
- **End-to-end verified on the live Supabase project (2026-10-28, owner-authorised)** with `scripts/live-e2e.mjs`
  against the local server: 4 synthetic accounts + 1 class created, real logins through `/api/auth`, full live flow,
  Realtime private channels (member joins, outsider with a valid Supabase session refused on control and video topics,
  student publish not delivered, server pokes received, removed member refused on rejoin), Data API lockdown
  (student token reads 0 lessons), end-of-class cleanup — **24/24**, all synthetic data deleted (0 leftovers). The
  deployed Netlify build still runs the previous code: deploy to make this live.

_Original item, kept for history:_
- **Current**: code done (`src/lib/liveToken.ts`, `useLiveLink`, `useLiveVideo`); policies in
  `supabase/migrations/2026-10-28_live_class_security.sql` **not applied**; secret not set. Without them: slides/answers
  work through the API, video is off (503 handled), old public channels are no longer used.
- **Risk**: until applied, no video call; once applied without the secret, same. No confidentiality regression either way.
- **Smallest correction**: apply the migration, set the secret (Netlify), run `scripts/live-realtime-check.mjs` against a
  *test* project (9 checks), then one real session with synthetic accounts (procedure in batch-1 report §7).
- **Compatibility**: rollout order migration → secret → deploy; rollback SQL in the migration file.
- **Tests**: Vitest `live.test.ts` (12, green); provider script (blocked locally).
- **Approval**: operator + owner acceptance of the ≤ 15 min residual window for an already-connected participant.

### 1.3 Privileged Supabase access
- **Current**: `SUPABASE_SERVICE_ROLE_KEY` only in server code (`supabaseAdmin()`, cached) and `.env.local`; never in
  client bundles (`NEXT_PUBLIC_*` prefix absent). The local `.env.local` also holds `GEMINI_API_KEY`, which **no code
  reads** (the practice generator uses `ANTHROPIC_API_KEY`).
- **Risk**: an unused key in a developer file is an exposure without benefit; the service key in local dev points at
  production (every local test touches the live database).
- **Smallest correction**: remove `GEMINI_API_KEY` from `.env.local`; create a Supabase *test* project for local dev and
  CI (also unblocks 1.2 verification and the CI access-matrix job, §3.3).
- **Approval**: operator (keys), owner (second project cost: free tier suffices).

### 1.4 Public R2 objects
- **Current**: uploads via 10-minute presigned PUT (`src/lib/r2.ts`, `POST /api/media`, staff only, MIME/size checked);
  reads via the bucket's **public** base URL with random keys (`publicUrl`). Lesson images/audio, teacher voice
  recordings and R2-hosted student-facing media are therefore readable by anyone holding a URL, forever.
- **Risk**: medium — no child data, but teachers' voices and lesson content are retrievable without a session; URLs leak
  through shared screens, browser history, DB exports.
- **Smallest correction** (two options, owner to choose): (a) keep public-read but add object lifecycle + delete objects
  when a lesson/recording is deleted (`DELETE /api/lessons`, `DELETE /api/*-sounds` → `DeleteObject`), documenting the
  bearer-URL exception; (b) private bucket + short-lived presigned GET issued by an authenticated route
  (`GET /api/media/:key`), which changes `next/image` remote patterns and the CSP `img-src`/`media-src` and costs one
  request per asset view. (a) is low-risk and local; (b) is a behaviour change to plan with the live class (video
  slides) in mind.
- **Tests**: MEDIA-01/03 from `ms-security-tests` once (b) exists; for (a) a unit test on the delete path.
- **Approval**: owner.

## Priority 2 — Durable learning data — **implemented in code on 2026-10-29 (migrations to run)**

Both items below are now in the working tree, tolerant of the missing columns until the owner runs
`supabase/migrations/2026-10-29_lessons_version.sql` and `2026-10-29_exercise_events_event_id.sql` (the API logs one
warning and behaves as before). Also added in the same batch: `2026-10-29_rate_limits.sql` + `src/server/rateLimit.ts`
(login 10 / 10 min per IP+e-mail, signup/enrolment/reset 5 / h; fail-open with a warning until the function exists) and R2
clean-up (`deleteObjects`: lesson media removed with the lesson, replaced recordings removed). Tests:
`src/test/routes/durability.test.ts` (12), `src/lib/eventQueue.test.ts` (4), `src/server/r2.test.ts` (2).

### 2.1 Atomic lesson updates
- **Current**: `PATCH /api/lessons` (`src/app/api/lessons/route.ts`) reads `exercises`, merges, then updates — a
  read-compare-write; no `version`/`updated_at` column exists on `lessons` (checked in `supabase/schema.sql`).
- **Risk**: two editors (or two tabs) silently overwrite each other's blocks.
- **Smallest correction**: proposed migration `docs/architecture/proposed-migrations/lessons_version.sql` (adds
  `version integer default 1`); route: single statement `update … set version = version + 1 where id = ? and version = ?`
  → 409 `{error:"La leçon a été modifiée ailleurs"}` when 0 rows; `ApiLesson.version` exposed; editor sends the version it
  loaded and, on 409, keeps the draft and offers « Recharger » / « Écraser ». Legacy clients that omit `version` keep
  today's behaviour (no check) during the transition.
- **Compatibility**: additive column; API field optional.
- **Tests**: DATA-04 — two saves with the same version → second 409, first content intact; save without version → 200.
- **Approval**: owner (migration). Code can be prepared behind the optional field now.

### 2.2 Offline event delivery and idempotency
- **Current**: `src/lib/eventsApi.ts` batches events in memory and posts with `keepalive`; a failed POST is dropped
  (`then(() => undefined, () => {})`); no client id, no server dedup. These rows feed the student's review list,
  teacher insights and the practice generator — **learning records, not telemetry**.
- **Risk**: a child's mistakes vanish from the review loop on a flaky tablet connection.
- **Smallest correction**: proposed migration `docs/architecture/proposed-migrations/exercise_events_idempotency.sql`
  (`event_id uuid` + partial unique index); client assigns `event_id = crypto.randomUUID()` per event, persists unsent
  batches in `localStorage` (`ms-events-queue`), flushes on load/`online`/`pagehide`; server inserts with
  `onConflict: "event_id", ignoreDuplicates: true`. Distinct attempts keep distinct ids (DATA-03 preserved).
- **Compatibility**: `parseExerciseEvent` accepts an optional `event_id`; legacy rows stay `null`.
- **Tests**: DATA-02 (retry same batch → 1 row), DATA-03 (two attempts → 2 rows), queue persistence unit test.
- **Approval**: owner (migration). Priority high.

## Priority 3 — API contracts

### 3.1 Role-dependent `/api/classes` response — **done (additive)**
- **Before**: `GET /api/classes` returned `TeacherClasses` for staff and `LiveClass[]` for students.
- **Now**: new `GET /api/classes/live` (students only; `src/app/api/classes/live/route.ts`); `fetchLiveClasses()` uses it.
  `GET /api/classes` keeps its student branch for compatibility (same payload, test-asserted equal).
- **Tests**: `src/test/routes/contracts.test.ts` (student list filtered by `isLive`, no cross-class leak, anon 401, staff 403).
- **Follow-up (owner)**: once no old client remains, drop the student branch of `/api/classes`.

### 3.2 Targeted lesson retrieval — **done (additive)**
- **Before**: `fetchLesson(id)` downloaded every visible lesson and filtered client-side.
- **Now**: `GET /api/lessons/:id` (`src/app/api/lessons/[id]/route.ts`): students only if the lesson is proposed to one
  of their classes (404 otherwise, like a missing lesson), staff any (today's rule); `live_stale` computed by the shared
  `withLiveStale` helper (`src/app/api/lessons/liveStale.ts`, also used by the list). The editor uses it.
- **Not switched**: the student lesson and practice pages still load the list — they need the ordered list for the
  accent colour (`accentAt(index)`) and navigation; switching them is a UI change, deferred.
- **Tests**: `contracts.test.ts` (anon, member, non-member, invalid id, missing, DB failure masked).

### 3.3 CI access tests — **prepared, disabled by default**
- **Now**: `ci.yml` gains an `access-matrix` job (build → `next start` → `scripts/access-matrix.mjs`, artifact uploaded)
  gated by the repository variable `ACCESS_MATRIX_ENABLED == 'true'`; it needs `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET` as secrets — **of a test project** (the
  script only reads and sends refused mutations, but production credentials do not belong in CI).
- **Approval**: operator/owner (secrets, test project). The Vitest route tests (45) already run in the `quality` job.

## Priority 4 — Remaining React warnings and obsolete files

### 4.0 Large pages split (2026-10-29)
`teacher/present/page.tsx` 731 → 398 lines (`components/present/LivePlayer.tsx`, loaded with `next/dynamic` when the
class starts), `student/live/page.tsx` 225 → 113 (`components/student/LiveRoom.tsx` dynamic, `BackToLessons.tsx`),
`teacher/create/page.tsx` 849 → 701 (`hooks/useVoiceRecorder.ts`). Pure moves, imports pruned, types/tests/build green.

### 4.1 `react-hooks` compiler warnings — 2 fixed, 2 documented
| File | Warning | Action | Status |
|---|---|---|---|
| `src/app/(platform)/teacher/page.tsx:140` | `setShowPublished(true)` in an effect reading `?published=1` | initial state derived lazily from the query (`useState(() => params.get("published") === "1")`); the effect only schedules the 3.5 s hide and cleans the URL, with a cleared timer | **fixed** (same behaviour: notice shown once after publishing) |
| `src/app/(platform)/teacher/create/page.tsx:254` | `Date.now()` flagged as impure during render (recording start) | timestamp taken in `recorder.onstart`, the recorder's own callback | **fixed** (duration still measured from the actual start) |
| `src/components/lesson/ExerciseRenderers.tsx:248` (`WordOrderRenderer`) | setState in effect to reset pool/chosen on `ex.sentence` | lazy initial state + `key={blockId}` on the renderer from `LessonPlayer` so a new sentence remounts | deferred — touches the student exercise flow, needs a browser pass |
| `src/app/(platform)/teacher/create/page.tsx:594` | ref read during render in the activity-panel IIFE | read the ref in a handler/effect or turn the IIFE into a component | deferred — large page, needs a browser pass |
- **Approval**: none; the two deferred ones need a manual browser check of the editor and the lesson player.

### 4.2 Obsolete or orphan project files — **done on the owner's instruction (2026-10-28: "supprime ce qui n'est pas utilisé et qui n'impacte rien")**
Nothing was destroyed irreversibly: untracked material was **moved** to
`C:\Users\chara\Desktop\MonteEtSouris-archive-2026-10-28\`, tracked files were removed with `git rm` (recoverable from
history until the commit is rewritten).

| Item | Evidence | Action taken |
|---|---|---|
| `brag-output*/` (4 dirs, 29 MB, untracked) | `/brag` renders; source of all former lint errors | moved to the Desktop archive |
| `.taste-skill/` (untracked) | design-skill working dir | moved to the Desktop archive |
| `animations/` (tracked sources + untracked `node_modules`/`out`) | Remotion source of `public/animations/fruits/*.mp4`; videos themselves stay in `public/` (referenced from lesson JSON in the DB) | `git rm`; untracked remainder moved to the archive; `tsconfig` exclude cleaned |
| `image/` (tracked, 1.9 MB) | 5 stills, unreferenced | `git rm` |
| `charte-graphique.{html,pdf}` | design charter | moved to `docs/charte/` |
| `Dockerfile`, `.dockerignore`, `k8s/`, `DEPLOYMENT.md`, `.github/workflows/deploy.yml` | legacy AWS EKS path (gated off); Netlify is the host; no reference from README, CI or Netlify config | `git rm` — `output: "standalone"` kept in `next.config.ts` (harmless for Netlify, untested without it) |
| `GEMINI_API_KEY` in `.env.local` | unused by code | commented out (value not shown anywhere) |
| `progress` table + `POST /api/progress` | written by no UI | **kept** — product decision (history), not a file |
| `scripts/migrate-audio-to-mp3.ts`, `scripts/letter-strokes/`, `supabase/schema.sql`, `public/animations/fruits/*`, `public/recaps/` | tooling, schema history, DB-referenced assets | **kept** |

## 5. Evidence — what was executed in this pass

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 28 files, **229 tests passed** (6 added in `contracts.test.ts`) |
| `npx eslint` | 0 errors / **2 warnings** (the two deferred in §4.1; 4 before this pass) |
| `npm run build` + `node scripts/access-matrix.mjs http://localhost:3001` | see §5.1 |

### 5.1 Build and HTTP matrix
- `npm run build`: **passed** (54 route lines; two earlier attempts failed only on Google Fonts downloads from
  `next/font` and were retried — a known fragility of building without network access, see §6).
- `node scripts/access-matrix.mjs http://localhost:3001 docs/audit/access-matrix-results.completion.json` on that build:
  **54/54** (52 previous expectations + the two new routes refused anonymously, no payload leakage).

## 6. Remaining blockers and release-readiness assessment

**Ready now (code level)**: authorisation at every API boundary with DB-backed sessions, server-authoritative live class,
masked errors, private `/arabic`, consistent API contracts, 229 automated tests, clean lint/types, production build.

**Blocked on the operator/owner (not code)**:
1. RLS state of the live Supabase project — unknown (§1.1). *Release blocker* until the inventory is read.
2. Migrations not applied: `2026-10-27_vocab_sounds.sql`, `2026-10-28_live_class_security.sql`; `SUPABASE_JWT_SECRET`
   not set (§1.2). Without them: vocabulary recordings cannot be published and the live-class video is off — degraded,
   not insecure.
3. `NEXT_PUBLIC_SITE_URL` on Netlify (password-reset links) — carried over from the first audit.
4. Decisions: R2 exposure model (§1.4), lesson versioning and event idempotency migrations (§2), teacher cross-class
   visibility, the ≤ 15 min Realtime window, obsolete directories (§4.2).

**Assessment**: the application can be released for the current cohort **once items 1–3 are done**, with 1.4 and
priority 2 scheduled as the next two batches. Shipping before item 1 is read would mean relying on application-level
authorisation alone while the anon key is public; the code does not depend on RLS, but the database must not be assumed
safe because the repository says so.
