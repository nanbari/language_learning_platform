# Security & reliability backlog (after remediation batch 1, 2026-10-28)

Items deliberately **not** mixed into batch 1. Each one is independent of the confirmed fixes already
shipped in the working tree; none blocks them. Product decisions marked ⚑ need an owner answer first.

## Batch 2 — abuse protection and transport hardening

| # | Item | Why it waits | Plan |
|---|---|---|---|
| B2-1 | **Distributed rate limiting** on `POST /api/auth` (login), `/api/signup`, `/api/enrollment`, `/api/auth/password` | Netlify functions are stateless: an in-memory limiter would be per-instance and useless. Needs a shared store (Upstash/Redis, Supabase table with TTL) or Netlify edge rate limiting — an infrastructure choice for the owner. | Key by IP + e-mail, sliding window (e.g. 10/min login, 5/h signup per e-mail), 429 with `Retry-After`; honeypot field on public forms; keep Supabase Auth's own limits. Test: 11th attempt → 429, legitimate login after window still works. |
| B2-2 | **Production CSP without `'unsafe-eval'` / `'unsafe-inline'` for scripts** | Must be verified against Next 16's inline runtime scripts, framer-motion, Radix, the WebRTC/Realtime code and the lesson preview iframe. A wrong CSP breaks the live class silently. | Nonce-based CSP via `proxy.ts` (`x-nonce` request header → `<Script nonce>`), keep the dev exception, verify each page + the live class in a browser with the console open; `report-uri` for a week before enforcing. |

## Batch 3 — data integrity

| # | Item | Why it waits | Plan |
|---|---|---|---|
| B3-1 | **Atomic optimistic concurrency for lesson saves** (`PATCH /api/lessons`) | Current code merges `exercises` with a read-then-write; a version check implemented the same way would still race. Needs a schema change (`lessons.version int` or reliance on `updated_at`) → migration approval. | `update … set exercises = …, version = version + 1 where id = ? and version = ?` in one statement (PostgREST: `.eq("version", v)` on the update, check affected rows); 409 when 0 rows. Client keeps the unsaved draft in memory and offers « Recharger » / « Écraser ». Test DATA-04: two editors, second save → 409, first save intact. |
| B3-2 | **Offline exercise events: retry + idempotency** | First establish what is lost: `exercise_events` feed the student's "à revoir" list, the teacher insights and the practice generator — they are **learning records, not telemetry**. A lost batch silently removes a child's mistakes from the review loop. | Client: persist unsent batches in `localStorage` with a client-generated `event_id` (uuid); flush on load/online. Server: `exercise_events.event_id unique` (migration), insert with `on conflict do nothing` so a retried batch never duplicates an attempt (DATA-02) while a genuinely new attempt (new id) is kept (DATA-03). |
| B3-3 | **Apply `supabase/migrations/2026-10-27_vocab_sounds.sql`** | Operator action on the production project. Until then `/api/vocab-sounds` returns `{}` and teacher recordings cannot be published. | Run in the SQL editor, then re-test `PUT /api/vocab-sounds` as a teacher and the student vocabulary page. |

## Product decisions required ⚑ (not changed by code)

1. **Teacher cross-class visibility** — today any teacher can read any student's `events`, `progress`, `practice` and list all lessons of all authors. Keep (small team) or restrict to own classes? Restriction is a one-line filter in those routes once decided; the matrix test `AUTH-11` is ready to flip.
2. **Six-children limit per class** — not enforced. If wanted, enforce at `PATCH /api/classes/:id` (refuse the 7th member with 409), never by truncating rosters.
3. **Account lifecycle** — `users.disabled_at` now exists and is enforced, but there is no admin UI to set it, no deletion flow and no retention rule for `exercise_events`. Decide retention (e.g. school year) before any purge job is written.
4. **Lesson sharing between teachers** — read-all/edit-own is the current rule; copying a lesson is not possible. Decide before touching `PATCH /api/lessons` for B3-1.
5. **Realtime residual window** (≤ 15 min for an already-connected participant after removal from a class) — accept, or shorten the token TTL (cost: more token refreshes), or add a server-side "kick" (`pokeLive("kick:<userId>")`, cooperative only).

## Point du 6 novembre 2026 (voir `2026-11-06-production-audit.md`)

Lot 2 et lot 3 : **B2-1** (limitation de débit en base, `rate_limit_hit`), **B3-1** (`lessons.version`), **B3-2**
(`exercise_events.event_id`) et **B3-3** (`vocab_sounds`) sont implémentés et les migrations sont appliquées en
production. **B2-2** (CSP à nonce) reste ouvert : `'unsafe-eval'` a disparu en production, `'unsafe-inline'` demeure.

Nouveaux éléments, par priorité :

| # | Élément | Statut |
|---|---|---|
| A1 | Mise à jour de `next` 16.2.6 → 16.4.5 et restriction de `remotePatterns` | **fait le 6 nov.** (à déployer ; vérifier `R2_PUBLIC_BASE_URL` sur Netlify) |
| A2 | Écritures de leçons (`/api/lessons` POST/PATCH/DELETE, `/api/live-deck`, page `/teacher/create`) réservées aux admins | **fait le 6 nov.** |
| A3 | Suppression d'objets R2 « par URL » : `DELETE /api/lessons` est désormais admin seulement ; reste `vocab-sounds` PUT/DELETE ouvert à tout enseignant | à corriger (suivi des téléversements à décider) |
| A4–A5 | Liste blanche sur `PATCH /api/lessons` ; `POST /api/events` rapproché des classes de l'élève | petites corrections |
| A6–A7 | Jeton Realtime de repli = session GoTrue ; rôle lu dans `user_metadata` à la création du profil | `SUPABASE_JWT_SECRET` sur Netlify, puis correction |
| A8, A13 | Énumération d'e-mails sur `/api/signup` ; dernier admin rétrogradable | décisions ⚑ |
| Ops | Sauvegardes Supabase (plan gratuit = aucune), `NEXT_PUBLIC_SITE_URL`, liste des URL de redirection, matrice en CI | opérateur |

Les décisions ⚑ 1 à 5 ci-dessus restent ouvertes.

## Point du 7 novembre 2026 — données des familles (RGPD)

| # | Élément | Statut |
|---|---|---|
| R1 | Mention d'information (art. 13) sur `/demande-inscription` : responsable, finalités, base, destinataires, durées, droits, recours APD | **fait le 7 nov.** |
| R2 | Adresse de contact centralisée (`src/lib/contact.ts`) : `contact@monteetsouris.com` (Zoho Mail ; MX et SPF posés chez Netlify le 7 nov., DKIM à faire) | **fait le 7 nov.** |
| R3 | Décisions « inscrit » / « sans suite » / « fin d'inscription » dans la boîte de réception ; purge pg_cron : sans suite +6 mois, inscription terminée +1 an | **code fait le 7 nov.** ; migration `2026-11-07_enrollment_requests_retention` **à exécuter** |
| R4 | Opérateur : `NEXT_PUBLIC_SITE_URL` et `SUPABASE_JWT_SECRET` sur Netlify (liste vérifiée le 7 nov. : absents) | reporté par l'association |
