# Monte & Souris — codebase cleanup and API architecture report

Date: 2026-10-28 · Scope: working tree at commit `c2ab603` + uncommitted redesign and security batch 1 · Nothing committed,
deployed or applied to a database. Security controls from batch 1 (`docs/audit/2026-10-28-remediation-batch-1.md`) were
treated as invariants and re-verified at the end (§7).

Method: `knip` (unused files/exports/dependencies, scoped to `src/**` + `scripts/**`), ESLint JSON output grouped by
directory/rule, `tsc`, Vitest, the production build, the HTTP access matrix on `next start`, and manual tracing of
every candidate against Next.js conventions, `public/` string references, database-stored content, scripts, CI
workflows and external callers. **Dead-code claims are limited to what is listed in §3 with evidence; nothing was
classified "unused" on a text search alone.**

## 1. Current architecture map

```
Browser (React 19 client components, zustand store for the signed-in user)
  │  fetch /api/*  (cookie ms_session, JSON)            ── src/lib/*Api.ts → src/lib/apiClient.ts
  ▼
Next.js 16.2.6 App Router (Netlify)                      src/proxy.ts: page guard for /teacher /student /arabic
  ├─ 22 Route Handlers  src/app/api/**/route.ts         thin: session → authorisation → validation → data → JSON
  │    ├─ identity      src/lib/auth.ts (HMAC cookie) + src/lib/serverSession.ts (profile re-read per request)
  │    ├─ authorisation src/app/api/classes/access.ts (ownedClass, studentClassIds, studentCanSeeLesson)
  │    │                src/app/api/classes/[id]/live/access.ts (liveAccess)
  │    ├─ validation    src/lib/{signup,enrollment,classes,staff,exerciseEvents,liveSession,uuid}.ts (pure, tested)
  │    ├─ errors        src/lib/apiErrors.ts (serverError 500 / unavailable 503, ref in logs)
  │    └─ data          src/lib/supabase.ts → supabaseAdmin() (service role, cached), lib/r2.ts (presigned PUT),
  │                     lib/practiceGenerator.ts (Anthropic), lib/livePoke.ts (Realtime REST broadcast)
  ├─ Pages: shells only; no server-rendered private data (grep: no supabaseAdmin/from() under src/app/(platform))
  └─ No Server Actions ("use server" absent), no webhooks, no RPC.
External: Supabase (Auth for passwords; Postgres via service role; Realtime private channels), Cloudflare R2
(public-read bucket), Anthropic API (practice sets), GitHub Actions (ci.yml; keepalive.yml → /api/health?deep=1;
deploy.yml → AWS EKS, gated by DEPLOY_ENABLED and dormant), Netlify (actual hosting).
```

Domain objects (from `supabase/schema.sql` + migrations): `users` (role student/teacher, `is_admin`, `disabled_at`),
`classes` (teacher, `live_room`, `live_state`), `class_members`, `lessons` (`exercises` JSON = blocks + saved live deck,
`class_id`), `exercise_events` (learning records), `practice_sets`, `progress` (written by `/api/progress`, read by no UI
— see §8), `signup_requests`, `enrollment_requests`, `letter_sounds`, `question_sounds`, `vocab_sounds` (pending
migration), `live_answers`, `live_participants` (pending migration).

## 2. API inventory and contracts

Conventions (now uniform): JSON in/out; `401 {error:"Non authentifié"}` without a valid session (profile re-read);
`403 {error}` for a role refusal; `404 {error}` where existence must stay hidden (classes, live sessions, lessons for
students); `400 {error}` validation with a French message; `409` conflicts; `500 {error:"Erreur serveur", ref}`;
`503 {error, ref}` when authorisation cannot be established. Student identity is always the session's.

| Method · path | Purpose | Caller | Auth | Authorisation | Validation | Response | Side effects | Tests |
|---|---|---|---|---|---|---|---|---|
| POST `/api/auth` | login / logout (`action`) | login page, shells | public | Supabase `signInWithPassword`; disabled profile refused | email/password present | `{user}` + cookie | cookie set/cleared | matrix (empty body 401) |
| GET `/api/auth` | current session, refreshed from DB | `useTeacherSession`, login | cookie | — | — | `{user}` or `{user:null}` (cookie cleared if profile gone/disabled) | cookie re-issue | `session.test.ts` |
| POST `/api/auth/password` | reset e-mail | forgot-password page | public | — | email | `{ok}` always (no enumeration) | Supabase mail | matrix |
| POST `/api/signup` | student account request | `/inscription` | public | — | `parseSignupInput` | 201 `{ok}` / 409 | `signup_requests` insert (bcrypt hash) | matrix |
| POST `/api/enrollment` | parent enrolment request | `/demande-inscription` | public | honeypot `website` | `parseEnrollmentInput` | 201 `{ok}` | `enrollment_requests` insert | matrix |
| GET/POST `/api/admin/signups` | list / approve-reject requests | `RequestInbox` | cookie | **admin** (`requireAdmin`) | `parseSignupAction` | `{pending,reviewed}` / `{request}` | creates Supabase Auth user + `users` row | matrix (403 student/teacher) |
| GET/POST `/api/admin/enrollments` | list / mark handled | `RequestInbox` | cookie | admin | `parseEnrollmentHandled` | `{pending}` / `{request}` | update | matrix |
| GET/POST `/api/admin/staff` | list teachers / set admin flag | `/teacher/equipe` | cookie | admin; cannot drop own flag (409) | `parseStaffUpdate` | `StaffRow[]` / `{user}` | update `users` | `access.test.ts` AUTH-04/13 |
| POST `/api/admin/teachers` | create teacher (invite link) | `/teacher/equipe` | cookie | admin | `parseNewTeacher` | `CreatedTeacher` | Supabase invite + `users` insert; compensating delete | matrix |
| GET `/api/lessons` | lessons (student: own classes; teacher: all; `?authorId` self unless admin) | student home, teacher pages | cookie | role-scoped | — | `LessonRow[]` + `live_stale` | — | `access.test.ts` AUTH-06/10/13 |
| POST/PATCH/DELETE `/api/lessons` | create / update (merge `exercises`) / delete | lesson editor | cookie | staff; class owned; author or admin | title, class, blocks | row / `{ok}` | lessons write | AUTH-04 (student 403) |
| GET/POST `/api/classes` | teacher: classes + students; student: live classes | classes page, student live list | cookie | role-scoped (two response shapes, see §8) | `parseNewClass` | `TeacherClasses` \| `LiveClass[]` / 201 `{id}` | insert | AUTH-02/04 |
| PATCH/DELETE `/api/classes/:id` | rename / replace roster / delete | classes page | cookie | `ownedClass` (owner or admin; 404 otherwise) | `parseClassUpdate`, members must be students | `{ok}` | update / delete cascade | AUTH-11/16 |
| POST/DELETE `/api/classes/:id/live` | start / end live class | presenter | cookie | `ownedClass`; end requires current room | — | `{room}` / `{ok}` | resets `live_state`, answers, presence; poke `end` | `live.test.ts` |
| PUT/GET `/api/classes/:id/live/state?room` | teacher deposits slide / members read it | presenter, student live | cookie | `liveAccess` (teacher PUT; member GET; stale room → `{status:"ended"}`) | `isLiveState`, ≤256 KB | `{ok}` / `LiveRoomView` | state write; presence heartbeat; poke `state` | LIVE-01/02/05 |
| POST/GET `/api/classes/:id/live/answers?room` | member submits attempt / teacher reads tally | student live, presenter | cookie | member POST (identity from session, correctness server-side); teacher GET | slideIndex, choiceId; 409 if not current slide | `{correct}` / `LiveHostView` | `live_answers` insert; poke `answers` | AUTH-05/07, DATA-01 |
| GET `/api/classes/:id/live/token?room` | Realtime JWT (15 min) | `useLiveLink` | cookie | `liveAccess` | — | `{token,expiresAt,topics,teacherId,role}` (no-store) / 503 without secret | — | LIVE-01/05 |
| POST `/api/classes/:id/live/mute?room` | mute all students | presenter | cookie | teacher of class | — | `{ok}` | poke `muteAll` | LIVE-02/03 |
| GET/POST `/api/events` | read exercise events / append batch | lesson player, insights | cookie | student: self only; staff: any (⚑ §8); POST students only | `parseExerciseEvent`, ≤ MAX_BATCH | rows / 201 `{inserted}` | insert | AUTH-05/07/14/16 |
| GET/POST `/api/progress` | read / upsert best score | (POST unused by UI) | cookie | student self / staff any; POST student + visible lesson | `lesson_id`, score clamped | rows / row | upsert | AUTH-02/05 |
| GET/POST `/api/practice` | latest practice set / generate | practice page | cookie | student self; POST students | `lessonId` uuid | set / `GenerateResult` | Anthropic call, `practice_sets` insert | matrix |
| GET `/api/practice/summary` | lessons to review | student home, insights | cookie | student self / staff any | — | `LessonReviewSummary[]` | — | AUTH-05 |
| GET `/api/teacher/insights` | class progress + hardest exercises | teacher home | cookie | staff (admin: all authors) | — | `TeacherInsights` | — | matrix |
| POST `/api/media` | presigned R2 upload | editor, recorders | cookie | staff | MIME + size | `{uploadUrl, publicUrl}` | presign only | matrix (400 bad type) |
| POST `/api/live-deck` | build saved live deck | editor | cookie | staff | lesson id | deck | lessons write | matrix |
| GET/PUT/DELETE `/api/letter-sounds` | letter/question recordings | letters page, player | cookie | GET any; PUT/DELETE **admin** | letter id, R2 URL | map / `{url}` / 204 | upsert/delete | AUTH-04, matrix |
| GET/PUT/DELETE `/api/vocab-sounds` | vocabulary recordings | teacher arabic page, student vocab | cookie | GET any; PUT/DELETE **staff** | word id, URL on `R2_PUBLIC_BASE_URL` | map / `{ok}` / 204 | upsert/delete | AUTH-04, matrix |
| GET `/api/health` (+`?deep=1`) | liveness / DB probe | Netlify, **keepalive.yml** | public | — | — | `{status:"ok"}` / `{status:"ok", db:"ok"}` / 503 `{status:"degraded", ref}` | none | AUTH-14, matrix |

External consumers verified: `keepalive.yml` greps `"db":"ok"` on `/api/health?deep=1` — batch 1 had dropped that field
(the cron would have failed on its next run); **restored in this pass**, error text still masked. No webhook, no other
machine caller found (`.github/workflows`, `netlify.toml`, `k8s/`, `Dockerfile` inspected).

## 3. Dead-code and dependency inventory (with evidence and label)

| Item | Evidence | Label |
|---|---|---|
| `src/lib/utils.ts` (`cn`, `MONTESSORI_COLORS`, `getRandomColor`) + `utils.test.ts` | no import anywhere except its own test (`grep -rn "@/lib/utils\|getRandomColor\|MONTESSORI_COLORS\|cn(" src`) | **SAFE TO REMOVE** → removed |
| deps `clsx`, `tailwind-merge` | only imported by `utils.ts` | **SAFE TO REMOVE** → uninstalled |
| `public/{file,globe,next,vercel,window}.svg` | create-next-app templates; no reference in `src`, `docs`, `README` | **SAFE TO REMOVE** → removed |
| `src/types/index.ts` `Badge`, `User.avatar`, `User.badges` | never read; `badges: []` set at 2 login sites only | **REFACTOR** → fields removed, call sites simplified |
| 7× local `jsonOrThrow` in `src/lib/*Api.ts`, 2× inline copies (`eventsApi`, `teacherApi`), `LiveApiError` in `liveApi.ts` | identical bodies | **REFACTOR** → one `src/lib/apiClient.ts` (`jsonOrThrow`, `apiFetch`, `ApiError{status, ref}`) |
| 15× `let adminClient … const supabase = () => (adminClient ??= supabaseAdmin())` | identical lazy-cache blocks in routes + `classes/access.ts` | **REFACTOR** → cache moved into `supabaseAdmin()`; routes call it directly |
| 5× local `requireAdmin` / `requireStaff` in routes | duplicates of `src/lib/serverSession.ts` helpers added in batch 1 | **REFACTOR** → shared helpers |
| 4× `UUID_RE` (`classes.ts`, `staff.ts`, `exerciseEvents.ts`, `practice/route.ts`) | identical regex | **REFACTOR** → `src/lib/uuid.ts` (`isUuid`), re-exported from `classes.ts` for compatibility |
| `ENROLLMENT_STATUSES`, `SIGNUP_STATUSES` consts | used only as `typeof X[number]` (lint warning) | **REFACTOR** → plain union types |
| `brag-output/`, `brag-output-2026-10-01-021027/`, `brag-output-parents/`, `brag-output-parents-v2/` (untracked) | outputs of the `/brag` video skill; contain vendored `gsap.min.js` that produced **all 32 ESLint errors and 764/772 warnings** | **REQUIRES MANUAL VERIFICATION** (owner's renders) → excluded from ESLint instead of deleted |
| `.taste-skill/` (untracked) | design-skill working directory | **REQUIRES MANUAL VERIFICATION** → excluded from ESLint |
| `animations/` (tracked, own `node_modules`, `render.mjs`, `recap.mjs`, `stills.mjs`) | Remotion project that produced `public/animations/fruits/*.mp4` and `public/recaps/*.mp4`; abandoned per owner but is the *source* of shipped assets | **REQUIRES MANUAL VERIFICATION** (keep until the owner decides; not app code — excluded from tsconfig/knip already) |
| `image/` (tracked, 1.9 MB, 5 PNG stills "garçon…") | no reference in `src`/docs; look like stills from the animation project | **REQUIRES MANUAL VERIFICATION** |
| `public/animations/fruits/*.mp4` (6) | referenced from `lessons.exercises` stored in the database (`video` / `clipQuiz` slide kinds, "anciens diaporamas") — not greppable in source | **KEEP** (dynamic DB reference) |
| `public/recaps/` | gitignored local renders | **KEEP** (not in repo) |
| `public/vocab/**` + `credits.json`, `public/sounds/**` | referenced by `src/data/arabicVocabulary.ts` and letter sounds | **KEEP** |
| `src/app/page.tsx` (marketing home), `src/app/(site)/*`, `components/layout/{Header,Footer}`, `components/home/Reveal` | `next.config.ts` redirects `/` → `/login` *temporarily* ("le code reste en place pour le jour où l'on retire cette redirection"); pages reachable directly | **KEEP** (owner decision recorded in code) |
| `src/app/inscription` vs `src/app/demande-inscription` | different flows: student account request (`signup_requests`) vs parent enrolment (`enrollment_requests`); both linked (login page, home, `RequestInbox`) | **KEEP** |
| `Dockerfile`, `.dockerignore`, `k8s/`, `DEPLOYMENT.md`, `.github/workflows/deploy.yml`, `next.config.ts output: "standalone"` | legacy AWS EKS path, gated by `DEPLOY_ENABLED`; Netlify is the live host | **REQUIRES MANUAL VERIFICATION** (deployment scripts are never auto-deleted) |
| `scripts/migrate-audio-to-mp3.ts`, `scripts/letter-strokes/` (Python + font) | one-off data migration; generator of `src/data/letterStrokes.ts` | **KEEP** (documented tooling) |
| `supabase/schema.sql`, `supabase/migrations/*` | schema history; `vocab_sounds` and `live_class_security` **not yet applied** | **KEEP** |
| `charte-graphique.{html,pdf}` (untracked, root) | design charter; should live under `docs/` | **REQUIRES MANUAL VERIFICATION** (move, not delete) |
| `1551` (root) | appeared in one directory listing, absent afterwards — a transient file from a shell redirect; nothing references it | n/a (gone) |
| `progress` table + `POST /api/progress` | written by no current UI (grep `/api/progress` in client code: read only in tests) | **REQUIRES MANUAL VERIFICATION** (product: keep best-score history or drop the route) |
| `tsx` devDependency | used by `docs/redesign/vocab/render-wordart.tsx` and `scripts/*.ts` | **KEEP** (knip ignore kept) |
| `zod` | used by `src/lib/practice.ts` only | **KEEP** |

Remaining uncertainty: anything referenced only from database content (lesson JSON, R2 URLs) or from the owner's
external tools cannot be proven unused from the repository; those items are labelled accordingly above.

## 4. Files removed

| File | Justification |
|---|---|
| `src/lib/utils.ts`, `src/lib/utils.test.ts` | unused everywhere (test-only); removing them lets two dependencies go |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | create-next-app placeholders, no reference |
| `package.json`: `clsx`, `tailwind-merge` | sole importer removed; `npm uninstall` updated the lockfile |
| *(follow-up, on the owner's instruction — see `completion-plan.md` §4.2)* `animations/`, `image/`, `k8s/`, `Dockerfile`, `.dockerignore`, `DEPLOYMENT.md`, `.github/workflows/deploy.yml` | `git rm` (history keeps them); `brag-output*/` and `.taste-skill/` moved to a Desktop archive; charter moved to `docs/charte/` |

## 5. Files refactored

| File(s) | Change |
|---|---|
| `src/lib/supabase.ts` | `supabaseAdmin()` creates the service-role client once and reuses it (typed `SupabaseClient`); comment points to `lib/serverSession` for authorisation |
| 15 route files + `src/app/api/classes/access.ts` | lazy-cache blocks deleted; `supabase()` → `supabaseAdmin()`; `classes/access.ts` no longer exports a client — routes import it from `@/lib/supabase` |
| `admin/{enrollments,signups,staff}`, `letter-sounds`, `vocab-sounds` routes | use `requireAdmin` / `requireStaff` from `src/lib/serverSession.ts` (`auth.user`), same messages and status codes |
| `src/lib/apiClient.ts` (new) + `classesApi`, `enrollmentApi`, `signupApi`, `staffApi`, `practiceApi`, `lessonsApi`, `eventsApi`, `teacherApi`, `liveApi`, `useLiveSession` | one `jsonOrThrow`/`apiFetch`; errors are `ApiError` (still an `Error` with the same French message → UI unchanged; `status`/`ref` available) |
| `src/lib/uuid.ts` (new); `classes.ts`, `staff.ts`, `exerciseEvents.ts`, `api/practice/route.ts` | single `isUuid` |
| `src/lib/enrollment.ts`, `src/lib/signup.ts` | status unions instead of value constants used only as types |
| `src/types/index.ts`, `login/page.tsx`, `components/teacher/useTeacherSession.ts` | `User` reduced to what the API returns |
| `src/app/api/health/route.ts` | `db:"ok"` restored on success for `keepalive.yml`; error text still masked |
| `eslint.config.mjs` | ignores `brag-output*/**` and `.taste-skill/**` (generated artefacts, not source); no rule weakened |
| `knip.json` | obsolete ignore patterns removed (hinted by knip) |
| `scripts/access-matrix.mjs` | health leak check targets error text, not the `db` field |

Not changed on purpose: UI/visual code, lesson/practice/recording workflows, teacher visibility rules, the four
remaining `react-hooks` warnings (behavioural refactors of `teacher/create`, `teacher/page`, `ExerciseRenderers` — out of
scope for a cleanup pass and risky without UI verification).

## 6. Before / after

| Check | Before (start of this pass) | After |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | **0 errors** |
| `npx eslint` | 32 errors / 772 warnings (32 E + 764 W from `brag-output*/…/gsap.min.js`; app code: 0 E / 8 W) | **0 errors / 4 warnings** (pre-existing `react-hooks` warnings in app code; 2 `no-unused-vars` fixed) |
| `npx vitest run` | 27 files / 221 tests | **27 files / 223 tests passed** (`utils.test.ts` −3, `apiClient.test.ts` +4, +1 elsewhere counted by vitest) |
| `npm run build` | passed | **passed** (46 static pages, 50 routes); one earlier attempt failed only on a transient Google Fonts download and was re-run |
| `npx knip` | clean (with 2 stale ignores) | **clean** |

## 7. Security regression results (batch-1 invariants)

- `node scripts/access-matrix.mjs http://localhost:3001` on the fresh production build: **52/52** expectations met
  (`docs/audit/access-matrix-results.cleanup.json`): every private route 401 without/with expired/tampered cookie;
  `/arabic`, `/student`, `/teacher` redirect anonymous users, `/login`, `/mot-de-passe-oublie`, `/demande-inscription`
  stay public; account-less signed identities 401 on all data routes; live routes expose no state or token material;
  `/api/health?deep=1` returns no error text.
- Route tests (`src/test/routes/*`): 37 tests covering anonymous denial, A↔B isolation, forged identity fields,
  teacher-without-link 404, stale admin cookie, disabled/deleted accounts, live-session rules, DB failures without
  disclosure — all passing after the refactors (the shared `requireAdmin`/`requireStaff` and cached client are exercised
  by them).
- Still **unverified in the deployed environment** (unchanged from batch 1): RLS state of production tables, Realtime
  private-channel policies, `SUPABASE_JWT_SECRET`.

## 8. Remaining architectural debt

1. `GET /api/classes` returns two different shapes depending on the caller's role (`TeacherClasses` vs `LiveClass[]`);
   the client has two typed wrappers. Splitting into `/api/classes` (staff) and `/api/classes/live` (students) is a
   small, non-breaking addition — deferred to avoid touching consumers in a cleanup pass.
2. `fetchLesson(id)` loads all lessons and filters client-side (`lessonsApi.ts`); `GET /api/lessons` also re-reads all
   ids to compute `live_stale`. A `GET /api/lessons/:id` would be cleaner; needs the student visibility rule applied
   per lesson (`studentCanSeeLesson` exists).
3. Teacher cross-student visibility (`events`, `progress`, `practice/summary`, all lessons) is a product decision (⚑
   backlog); the code path is a one-line filter once decided.
4. `progress` table/route unused by the UI — keep or remove (product).
5. Lesson saves are last-write-wins (`PATCH /api/lessons` merges `exercises`); atomic version check planned in
   `docs/audit/backlog.md` B3-1 (needs a migration).
6. Offline exercise events are dropped silently (`eventsApi.flush`); they are learning records — backlog B3-2.
7. Legacy EKS deployment path (`Dockerfile`, `k8s/`, `deploy.yml`, `output: "standalone"`) coexists with Netlify;
   decide which one is canonical and remove or document the other.
8. Four `react-hooks` compiler warnings in `teacher/create/page.tsx`, `teacher/page.tsx`, `ExerciseRenderers.tsx`.
9. No CI job runs the HTTP access matrix (needs a started server); `ci.yml` runs lint/typecheck/vitest/build only.

## 9. Recommended future structure (only where justified)

Keep the current layout — it is proportional to a 22-route application — with two small conventions already
established by this pass and worth holding to:

- **Routes stay thin**: `currentUser`/`requireStaff`/`requireAdmin` → resource authorisation helper
  (`classes/access.ts`, `live/access.ts`) → `parse*` validator from `src/lib` → `supabaseAdmin()` → JSON; failures
  through `serverError`/`unavailable`. New routes should not reintroduce local copies of these helpers.
- **One browser client** (`src/lib/apiClient.ts`) and one typed wrapper module per resource (`*Api.ts`); UI never
  calls `fetch("/api/…")` directly.
- If the live-class and classes routes keep growing, group their server helpers under `src/server/live/` and
  `src/server/classes/` instead of `src/app/api/**/access.ts`; not needed yet.

No repository/factory/base-class layer, no new library: no concrete need was demonstrated.

The codebase is **not** claimed to be 100% clean: items in §3 marked "requires manual verification" (video renders,
animation sources, legacy deployment path, `progress` route, charter files) await the owner's decision, and database-
or R2-referenced assets can only be checked against the live data.

## 10. Layout change (2026-10-28, after this report) — path mapping

On the owner's instruction the tree was reorganised into a server / shared / browser split. Paths quoted above map as
follows; nothing else changed in those modules (pure moves, imports rewritten to the `@/` alias).

| Before | After |
|---|---|
| `src/lib/auth.ts`, `serverSession.ts`, `apiErrors.ts`, `supabase.ts` (admin + server anon), `r2.ts`, `livePoke.ts`, `liveToken.ts`, `practiceGenerator.ts`, `lessonDeck.ts` | `src/server/auth.ts`, `session.ts`, `errors.ts`, `supabase.ts`, `r2.ts`, `livePoke.ts`, `liveToken.ts`, `practiceGenerator.ts`, `lessonDeck.ts` |
| `src/app/api/classes/access.ts`, `src/app/api/classes/[id]/live/access.ts`, `src/app/api/lessons/liveStale.ts` | `src/server/classAccess.ts`, `liveAccess.ts`, `lessonLiveStale.ts` |
| `src/lib/apiClient.ts`, `*Api.ts` | `src/lib/api/client.ts`, `classes.ts`, `lessons.ts`, `live.ts`, `events.ts`, `practice.ts`, `signup.ts`, `enrollment.ts`, `staff.ts`, `teacher.ts` |
| `src/lib/use*.ts` | `src/hooks/` |
| browser Realtime client (was the shared `lib/supabase.ts`) | `src/lib/supabaseBrowser.ts` (anon key only) |
| `LIVE_TOKEN_*`, `liveTopics` (were in `liveToken.ts`) | `src/lib/liveSession.ts` (shared); minting/verification stay server-side |
| `supabase-schema.sql` | `supabase/schema.sql` |
| `charte-graphique.*` | `docs/charte/` |
| `docs/redesign/{before,after,parcours,voix}` (25 MB of screenshots, duplicates of the Desktop copies) | moved to `Desktop/MonteEtSouris-archive-2026-10-28/docs-redesign-captures/` |

Also added: `.env.example` (variable names only) and a real `README.md` (the create-next-app boilerplate was replaced).
