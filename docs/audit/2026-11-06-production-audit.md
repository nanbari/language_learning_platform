# Monte & Souris — audit de production (suivi), 6 novembre 2026

Mode : **audit** (§1 à §8), puis **implémentation autorisée** le même jour pour A1 et A2 (§10). Point de départ :
`docs/audit/2026-10-27-production-audit.md` et `docs/audit/2026-10-28-remediation-batch-1.md`. Dépôt au commit
`5d0fe3f` (branche `main`, arbre propre). Skills lus et appliqués : `ms-production-audit`, `ms-access-control`,
`ms-security-tests`, `ms-architecture` (instructions locales, pas des contrôles exécutables).

Pile constatée : Next.js 16.2.6 (App Router, `src/proxy.ts`), React 19.2.4, `@supabase/supabase-js` 2.103.3, Supabase
Postgres + Auth (projet unique, aussi utilisé par le développement local), Cloudflare R2 (bucket public, PUT présigné),
Netlify (`monteetsouris.com`), API Anthropic pour les séries d'exercices. Node 24.14 en local, Node 20 sur Netlify et en CI.

## 1. Ce qui a été fait, et comment

Lectures seules, sans aucune écriture applicative :

| Action | Détail | Résultat |
|---|---|---|
| Inventaire des points d'entrée | 28 `route.ts` sous `src/app/api`, 24 pages, `src/proxy.ts`, `src/server/*` | §2 |
| Relecture route par route | acteur requis, relation vérifiée, validation, limitation de débit, masquage d'erreurs, journaux | §3 et §4 |
| `npx tsc --noEmit`, `npm run lint`, `npx vitest run` | 0 erreur de type ; lint 0 erreur / 2 avertissements préexistants ; **33 fichiers, 261 tests passés** | — |
| `npm run build` | build de production réussi | — |
| `node scripts/access-matrix.mjs http://localhost:3001` | `next start` sur le build, identités synthétiques (UUID absents de toute table), lectures et mutations refusées uniquement | **54/54** — `access-matrix-results.2026-11-06.json` |
| Sondes REST en lecture seule sur le projet Supabase (`limit=0`, aucune ligne lue) | présence des colonnes/tables/fonction de chaque migration ; lecture de 11 tables avec la **clé anon** (celle du navigateur) | §5 |
| `npm audit` | métadonnées de dépendances envoyées au registre npm (pas de code source) | §6 |

Non fait, et donc **non vérifié** : réglages du tableau de bord Supabase (politiques `realtime.messages`, liste des URL
de redirection, plan et sauvegardes), variables d'environnement Netlify, configuration du bucket R2, comportement de
l'optimisation d'images sur Netlify. Aucune requête n'a été envoyée au site déployé.

## 2. Architecture et frontières de confiance (inchangées depuis le lot 1, confirmées)

- **Identité** : cookie `ms_session` signé HMAC (`src/server/auth.ts`), httpOnly, `SameSite=Lax`, `secure` en
  production. **Autorité** : `currentUser()` (`src/server/session.ts`) relit `public.users` à chaque requête privée ;
  rôle, droit admin et `disabled_at` viennent de la base ; 503 (refus) si le profil est illisible.
- **Pages** : `src/proxy.ts` ne lit que le cookie et ne protège que des coquilles (`/teacher`, `/student`, `/arabic`).
  Toute donnée passe par `/api`.
- **Base** : client service-role côté serveur uniquement ; la RLS est contournée, l'autorisation est dans le code des
  routes (`ownedClass`, `studentClassIds`, `studentCanSeeLesson`, `liveAccess`). Le navigateur n'interroge jamais
  PostgREST : la clé anon ne sert qu'au Realtime.
- **Cours en direct** : état, réponses, « couper les micros » et fin passent par le serveur ; canaux Realtime privés
  avec jeton signé par le serveur (`SUPABASE_JWT_SECRET`) ou, à défaut, session GoTrue réelle (voir F7).
- **Médias** : PUT présigné 10 min vers un bucket R2 public, clé `media/<année>/<uuid>-<nom>` ; lecture par URL.
- **Surface publique voulue** : `/login`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/inscription`
  (demande de compte élève, approuvée par un admin), `/demande-inscription` (familles), pages `(site)` statiques,
  `POST /api/auth`, `/api/signup`, `/api/enrollment`, `/api/auth/password`, `/api/health`.

### Matrice d'accès (politique voulue = politique implémentée, sauf lignes marquées ⚑)

| Ressource / action | Anonyme | Élève | Enseignant | Admin |
|---|---|---|---|---|
| Pages `/teacher`, `/student`, `/arabic` | 307 → login ✔ | son espace ✔ | son espace ✔ | tout |
| `GET /api/lessons`, `/api/lessons/:id` | 401 ✔ | leçons de ses classes ✔ | **toutes les leçons** ⚑ (F3) | toutes |
| `POST/PATCH/DELETE /api/lessons` | 401 ✔ | 403 ✔ | ses leçons (`author_id`) ✔ | toutes |
| `POST /api/live-deck` | 401 ✔ | 403 ✔ | **n'importe quelle leçon** ✘ (F1) | toutes |
| `GET /api/classes` | 401 ✔ | ses classes ✔ | ses classes + **liste de tous les élèves** ⚑ (F13) | tout |
| `PATCH/DELETE /api/classes/:id`, `…/live` | 401 ✔ | 403 ✔ | classe possédée, sinon 404 ✔ | tout |
| `…/live/state`, `…/live/answers`, `…/live/token`, `…/live/mute` | 401 ✔ | membre de la classe, salon courant, cours ouvert ✔ ; ne reçoit que son propre résultat ✔ | enseignant de la classe ✔ | tout |
| `GET /api/events`, `/progress`, `/practice`, `/practice/summary` | 401 ✔ | soi seulement ✔ | **tout élève** ⚑ (F4) | tout |
| `POST /api/events` | 401 ✔ | soi ; `lesson_id` **non rapproché de ses classes** (F6) | 403 ✔ | 403 |
| `POST /api/progress`, `POST /api/practice` | 401 ✔ | soi, leçon de ses classes ✔ | 403 ✔ | 403 |
| `POST /api/media` | 401 ✔ | 403 ✔ | ✔ (type, taille) | ✔ |
| `PUT/DELETE /api/vocab-sounds` | 401 ✔ | 403 ✔ | ✔ mais **supprime tout objet R2 par URL** ✘ (F2) | ✔ |
| `PUT/DELETE /api/letter-sounds` | 401 ✔ | 403 ✔ | 403 ✔ | ✔ |
| `/api/admin/*` | 401 ✔ | 403 ✔ | 403 ✔ | ✔ (pas d'auto-rétrogradation) |
| `/api/teacher/insights` | 401 ✔ | 403 ✔ | ses leçons ✔ | tout |
| Cookie expiré / falsifié / compte désactivé | 401 / 401 / 403 ✔ sur toutes les routes privées | | | |

✔ = vérifié par la matrice HTTP du jour ou par les tests de routes (`src/test/routes`, base simulée) ; ✘ = défaut ;
⚑ = règle à trancher par l'association (inchangée depuis le lot 1).

## 3. Constats classés

Priorité = impact × facilité d'accès. « Confirmé » = chemin tracé dans le code jusqu'au point d'entrée.

| # | Priorité | Statut | Constat | Preuve | Impact | Correction minimale |
|---|---|---|---|---|---|---|
| **A1** | **Haute** → **corrigé dans le code (§10)** | confirmé (versions) | **Next.js 16.2.6 porte 20 avis de sécurité, dont 5 critiques** : exécution de code à distance non authentifiée dans l'API d'optimisation d'images (AVIF `GHSA-2xp9-vwfh-vxw4`, SVG `GHSA-2464-fhr4-w9xw`), dans `use cache` (`GHSA-673q-mjm6-r5xr`), sur serveurs Windows (`GHSA-p293-qw3h-jr36`), dans `next/og` (`GHSA-vcvr-r3jv-pc5j`) ; contournement du proxy avec Turbopack (`GHSA-6gpp-xcg3-4w24`) ; SSRF et empoisonnement de cache. Correctifs dans 16.2.11 / 16.3.3 / 16.3.6 / 16.3.8 / 16.4.1 ; **16.4.5 disponible**. | `npm audit` ; `next.config.ts` autorise `https://*.r2.dev/**` dans `remotePatterns`, c'est-à-dire **n'importe quel bucket R2 public de n'importe qui** : un attaquant peut héberger l'image piégée lui-même. | Compromission du serveur sans compte. Atténuation probable mais **non vérifiée** : sur Netlify, `@netlify/plugin-nextjs` 5 sert `/_next/image` via le CDN d'images Netlify (`dist/build/image-cdn.js`), pas via `sharp` ; `next/og` et `use cache` ne sont pas utilisés ; pas de Server Action (`grep "use server"` vide). | Mettre à jour `next` (16.4.5) et `eslint-config-next` ; restreindre `remotePatterns` au seul domaine `R2_PUBLIC_BASE_URL` ; relancer tests, build et matrice. |
| **A2** | Moyenne → **corrigé dans le code (§10)** : règle de l'association « seuls les admins créent des leçons » désormais appliquée par les routes et le proxy | confirmé | **Tout enseignant peut écraser le diaporama de n'importe quelle leçon** (F1). `POST /api/live-deck` vérifie seulement `isStaff`, puis `saveLessonDeck(lessonId)` lit et écrit la leçon **par id, sans condition `author_id`**, et retire au passage les blocs `recap`. L'erreur brute (`Error.message`, dont le message Postgres) est renvoyée en 422. | `src/app/api/live-deck/route.ts:14-23`, `src/server/lessonDeck.ts:45-64` ; à comparer avec `PATCH /api/lessons` (`author_id` dans le WHERE). | Perte ou altération silencieuse du contenu d'un collègue. | Dans `saveLessonDeck`, exiger `author_id = session.id` sauf admin (404 sinon, comme `ownedClass`), masquer l'erreur ; test de route négatif + positif. |
| **A3** | Haute → **réduite (§10)** : le chemin `DELETE /api/lessons` est désormais admin seulement ; le chemin `vocab-sounds` PUT/DELETE reste ouvert à tout enseignant | confirmé | **Tout enseignant peut supprimer n'importe quel objet du bucket R2** (médias des autres leçons, sons des lettres enregistrés par l'admin) (F2). Deux chemins : (a) `PUT /api/vocab-sounds` accepte toute URL du bucket, puis **supprime l'URL précédente** quand elle diffère ; (b) `DELETE /api/lessons` supprime toutes les URL R2 trouvées dans `exercises`, et `PATCH /api/lessons` accepte un `exercises` arbitraire. Les URL victimes sont lisibles par tout enseignant (`GET /api/lessons`, `/api/letter-sounds`, `/api/vocab-sounds`). | `src/app/api/vocab-sounds/route.ts:38-49,59-61`, `src/app/api/lessons/route.ts:144-148`, `src/server/r2.ts:106-144` (suppression « par URL », aucune notion de propriétaire). | Destruction irréversible de contenu pédagogique (pas de corbeille, bucket sans versionnage connu). | Ne supprimer que les objets **créés par l'appelant** ou référencés par une leçon qu'il possède : garder la trace des téléversements (table `media_objects` : clé, auteur, leçon) ou, sans migration, limiter `deleteObjects` aux URL dont le préfixe `media/<année>/` contient un uuid émis pour cet auteur (nécessite de l'enregistrer). Au minimum : ne plus supprimer l'ancien son dans `vocab-sounds` PUT quand l'URL précédente n'est pas la sienne. |
| A4 | Moyenne | confirmé (faible) | **Affectation de masse sur `PATCH /api/lessons`** : `...updates` part tel quel vers `.update()` (seuls `id`, `author_id`, `version` sont retirés) ; `exercises` est un JSON illimité fusionné sur la valeur courante (F5). | `src/app/api/lessons/route.ts:86,96-107`. | Colonnes non prévues modifiables par l'auteur ; taille non bornée. | Liste blanche des champs (`title`, `subject`, `age_group`, `class_id`, `exercises`) avec types et taille maximale. |
| A5 | Moyenne | confirmé (faible) | **`POST /api/events` n'exige pas que `lesson_id` soit une leçon des classes de l'élève** (F6), contrairement à `/api/progress` et `/api/practice`. | `src/app/api/events/route.ts:63-67` vs `progress/route.ts:45`. | Événements rattachés à une leçon étrangère, visibles dans les analyses de son auteur ; pas de confidentialité en jeu. | Vérifier `studentCanSeeLesson` pour chaque `lesson_id` du lot (une requête par lot). |
| A6 | Moyenne | plausible | **Jeton Realtime de repli = session GoTrue réelle** quand `SUPABASE_JWT_SECRET` est absent (F7) : le navigateur reçoit un `access_token` d'environ une heure qui permet aussi les appels GoTrue (`updateUser` : e-mail, mot de passe, `user_metadata`). L'accès PostgREST est fermé si `2026-10-28_data_api_lockdown.sql` est appliquée (**vérifié aujourd'hui : la clé anon ne lit aucune ligne ; la vérification avec un jeton `authenticated` n'a pas été faite**). | `src/server/liveToken.ts:102-116` ; `.env.local` ne définit pas `SUPABASE_JWT_SECRET` (Netlify : inconnu). | Élargissement de capacité hors des flux de l'application. | Définir `SUPABASE_JWT_SECRET` en production ; sinon, refuser (503) plutôt que de replier sur une session GoTrue. |
| A7 | Moyenne | plausible | **`authenticate()` crée un profil avec le rôle tiré de `user_metadata.role`** si un utilisateur Auth n'a pas de ligne `public.users` (F8). `user_metadata` est modifiable par l'utilisateur avec n'importe quel jeton GoTrue (lien de réinitialisation, A6). Préalable rare : un compte Auth sans profil. `is_admin` n'est pas inséré, donc les routes admin restent fermées ; seul `proxy.ts` (cookie) admettrait aux coquilles `/teacher/letters`. | `src/app/api/auth/route.ts:33-46`. | Escalade enseignant depuis un compte sans profil. | Lire le rôle dans `app_metadata` (serveur seulement) ou créer le profil `student` par défaut. |
| A8 | Moyenne | confirmé / règle | **Énumération d'e-mails sur `POST /api/signup`** : 409 « un compte existe déjà » / « demande déjà en attente » (F9), 5 appels/h par IP. Connexion et réinitialisation sont, elles, indiscernables. | `src/app/api/signup/route.ts:38-40,49-62`. | Un inconnu apprend quels parents/élèves ont un compte. | Répondre « demande enregistrée » dans tous les cas et prévenir par e-mail ; ou accepter en connaissance de cause. |
| A9 | Basse | plausible | **`redirectTo` dérivé de l'en-tête Host** quand `NEXT_PUBLIC_SITE_URL` est absente (réinitialisation, invitation) (F10). Supabase n'honore que les URL de sa liste blanche : exploitable seulement si cette liste est large. | `src/app/api/auth/password/route.ts:30`, `src/app/api/admin/teachers/route.ts:44` ; `.env.local` sans `NEXT_PUBLIC_SITE_URL`. | Lien de réinitialisation vers un hôte attaquant. | Définir `NEXT_PUBLIC_SITE_URL` sur Netlify et vérifier la liste des URL de redirection Supabase. |
| A10 | Basse | confirmé | **Texte d'erreur brut du fournisseur** dans 4 réponses : `admin/signups:87`, `admin/teachers:70,85,90` (admin seulement), `live-deck:22` (tout enseignant), `practice:171` (texte de refus du modèle, pas la base). Tout le reste passe par `serverError()`. (F11) | fichiers cités | Fuite de noms de tables/contraintes vers un enseignant (live-deck). | `serverError()` partout. |
| A11 | Basse | confirmé | **CSP de production** : `script-src 'self' 'unsafe-inline'` (`'unsafe-eval'` retiré hors développement depuis le lot 1). | `next.config.ts:10-13`. | Atténuation XSS affaiblie. | CSP à nonce via `proxy.ts` (backlog B2-2), à valider sur le cours en direct. |
| A12 | Basse | confirmé | `GET /api/health?deep=1` public, sans limite, une requête SQL par appel (F15) ; `POST …/live/answers` sans limite ni dédoublonnage (F16) ; `/api/media` accepte `image/svg+xml` (servi depuis l'origine R2, pas celle du site) et n'a ni quota ni route de suppression (F14). | fichiers cités | Bruit / coût, pas de confidentialité. | Limite de débit sur `health?deep` (clé IP, 10/min) ; dédoublonner les réponses par (élève, diapo) ; quota par enseignant. |
| A13 | Basse | règle ⚑ | Pas d'invariant « au moins un admin » : deux admins peuvent se rétrograder mutuellement (F12). | `src/lib/staff.ts:69-74`. | Perte d'administration. | Refuser la rétrogradation du dernier admin. |

**Décisions de politique toujours ouvertes (⚑, inchangées depuis le 27 octobre)** : visibilité des enseignants sur toutes
les leçons (F3), sur tous les élèves et toutes leurs données (F4), et sur la liste complète des élèves (F13). Le code est
cohérent avec « petite équipe, tout le monde voit tout », sauf `teacher/insights` (limité à ses leçons). Tant que ce n'est
pas tranché, A2 et A3 doivent être corrigés **indépendamment** : écrire et supprimer ne sont jamais couverts par « voir ».

## 4. Ce qui va bien (vérifié)

- Les 23 fichiers de routes privées commencent par `currentUser` / `requireStaff` / `requireAdmin` ; refus 503 si la base
  ne répond pas ; comptes désactivés refusés à la connexion et à chaque requête.
- `ownedClass` et `liveAccess` renvoient 404 sans révéler l'existence d'une classe étrangère ; un élève retiré d'une
  classe est refusé à la requête suivante ; aucun élève ne reçoit la réponse d'un autre.
- Formulaires publics : validation stricte côté serveur (`src/lib/enrollment.ts`, `src/lib/signup.ts`,
  `src/lib/passwordReset.ts`), champ piège, limitation de débit en base (`rate_limit_hit`, fonction présente en
  production), mots de passe des demandes hachés en bcrypt et jamais renvoyés à l'admin.
- Journaux : aucun e-mail, nom, réponse d'élève ni jeton dans les `console.*` des routes ; `errors.ts` ne journalise que
  le message du fournisseur, pas `details`.
- Cookies httpOnly + Lax + secure ; la seule requête GET à effet de bord (présence) est bénigne (CSRF).
- Secrets : `.env*` ignoré par Git, aucun fichier d'environnement suivi ; `AUTH_SECRET` obligatoire en production ;
  seules `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` sont publiques.
- Données : enregistrement atomique des leçons (`lessons.version`), événements idempotents (`event_id`), R2 nettoyé à la
  suppression d'une leçon (mécanisme à corriger, voir A3).
- CI (`.github/workflows/ci.yml`) : lint, types, tests et build à chaque push ; la matrice HTTP y est prête mais désactivée.

## 5. État du projet Supabase (sondes en lecture seule, 6 novembre)

| Migration | Présente |
|---|---|
| `2026-10-27_vocab_sounds` | ✔ |
| `2026-10-28_live_class_security` (`classes.live_state`, `users.disabled_at`, `live_answers`, `live_participants`) | ✔ |
| `2026-10-29_exercise_events_event_id`, `2026-10-29_lessons_version`, `2026-10-29_rate_limits` (`rate_limit_hit`) | ✔ |
| `2026-11-06_enrollment_level_details`, `2026-11-06_enrollment_letter_forms` | ✔ |
| `users.is_admin` | ✔ |

Avec la **clé anon** (celle que reçoit tout navigateur), `select * limit 1` sur `users`, `lessons`, `exercise_events`,
`progress`, `practice_sets`, `enrollment_requests`, `signup_requests`, `classes`, `class_members`, `vocab_sounds`,
`letter_sounds` renvoie **200 et 0 ligne** : la RLS est active et aucune politique ne s'applique à `anon`. Cela confirme
l'effet de `2026-10-28_data_api_lockdown.sql` pour `anon` ; **le rôle `authenticated` n'a pas été testé** (il faudrait un
jeton utilisateur ; voir A6). Politiques `realtime.messages` : non vérifiables par REST, **toujours non vérifiées**.

## 6. Dépendances (`npm audit`, 6 novembre)

22 avis : 1 critique, 9 élevés, 11 modérés, 1 faible. Exposition réelle :

| Paquet | Installé | Correctif | Exposé à l'exécution ? |
|---|---|---|---|
| `next` | 16.2.6 | 16.4.5 | **Oui** (A1) |
| `zod` | 4.5.x | 4.6.7 | Oui en théorie (`GHSA-mrhx-c7xc-m3w5`, épuisement mémoire sur collections contraintes) ; vérifier où `zod` valide des entrées réseau avant de conclure |
| `sharp`, `postcss`, `ws`, `brace-expansion`, `js-yaml`, `browserslist`, `source-map-js`, `minimatch`, `@babel/core`, `typescript-eslint`, `vite`, `vitest` | — | via `npm audit fix` / mise à jour de `next` | Outils de build et de test, non exposés en production (`sharp` : voir note A1 sur Netlify) |
| `eslint-config-next` | 16.2.4 | la seule version « corrigée » listée est 15.5.29 (majeure inférieure) | Outil ; à aligner sur la version de `next` plutôt qu'à rétrograder |

## 7. Durabilité et exploitation (non vérifiables depuis le dépôt)

- **Sauvegardes** : le projet est décrit comme en **plan gratuit** (`keepalive.yml`, `health/route.ts`). Sur ce plan,
  Supabase ne fait **aucune sauvegarde automatique** ; `docs/ops/runbook.md:16` renvoie vers « Database → Backups » qui
  serait vide. À confirmer dans le tableau de bord ; sinon, planifier un `pg_dump` périodique (CI avec secret) ou passer
  au plan Pro avant la rentrée du 6 janvier 2027.
- **R2** : pas de versionnage ni de corbeille connus → A3 est irréversible aujourd'hui.
- **Keepalive** : cohérent avec la réponse de `/api/health?deep=1` (`"db":"ok"`), pas de régression.
- **Supervision** : aucune alerte sur les 5xx ni sur les `ref` d'erreur ; Netlify/Supabase à configurer.

## 8. Verdict borné

Sur le build de production du commit `5d0fe3f`, avec des identités synthétiques : l'accès anonyme en lecture et en
écriture est refusé sur les 21 routes privées, les cookies expirés ou falsifiés sont refusés, un élève ne peut lire ni
écrire les données d'un autre élève, les routes admin sont fermées aux enseignants, et aucune réponse d'erreur de ces
routes ne contient de texte de base de données. **Entre enseignants**, en revanche, l'isolation n'est pas assurée pour
deux opérations destructrices (A2, A3), et la version de Next.js en production porte des vulnérabilités critiques
exploitables sans compte (A1), avec une atténuation Netlify probable mais non vérifiée. Les politiques Realtime, les
variables Netlify et les sauvegardes restent non vérifiées.

## 9. Prochaines actions (après §10)

1. **A3 (reste)** — `PUT/DELETE /api/vocab-sounds` : ne plus supprimer un objet R2 qui n'est pas le sien ; décision sur
   le suivi des téléversements (migration `media_objects`) ou suspension de la suppression automatique.
2. A4, A5, A10 — petites corrections sans migration.
3. Opérateur : déployer (§10), puis `SUPABASE_JWT_SECRET` et `NEXT_PUBLIC_SITE_URL` sur Netlify, liste des URL de
   redirection Supabase, état des sauvegardes, matrice en CI (`ACCESS_MATRIX_ENABLED`) sur un projet Supabase de test.
4. Décisions ⚑ (F3, F4, F13, A8, A13).

## 10. Implémentation du 6 novembre (autorisée par l'association)

Règle confirmée par l'association : **seuls les administrateurs créent des leçons**. Le code la reflète maintenant.

| Fichier | Changement |
|---|---|
| `package.json`, `package-lock.json` | `next` 16.2.6 → **16.4.5**, `eslint-config-next` 16.2.4 → 16.4.5 (A1). `npm audit` : 0 critique (19 avis restants, tous dans l'outillage de build/test et `zod`). |
| `next.config.ts` | `remotePatterns` : le joker `https://*.r2.dev/**` n'est gardé **qu'en l'absence** de `R2_PUBLIC_BASE_URL` ; sinon seul le domaine du bucket du projet (A1). **À vérifier sur Netlify** : la variable doit être définie, sinon le joker reste actif. |
| `src/app/api/lessons/route.ts` | `POST`, `PATCH`, `DELETE` : `session.isAdmin` requis (403 « Réservé aux administrateurs ») ; `GET` inchangé (enseignants et élèves). La condition `author_id` est conservée. |
| `src/app/api/live-deck/route.ts`, `src/server/lessonDeck.ts` | `requireAdmin` ; `lessonId` doit être un UUID (404 sinon) ; `DeckError` pour les refus explicables (404 / 422), `serverError()` pour les pannes : plus de texte Postgres dans la réponse (A2, A10). |
| `src/proxy.ts` | `/teacher/create` réservé aux admins, comme `/teacher/letters`. |
| `src/app/(platform)/teacher/page.tsx`, `src/components/teacher/ProgressWorkspace.tsx` | Boutons « Créer », « Modifier », « Supprimer » affichés aux seuls admins (présentation ; l'autorisation est dans les routes). |
| `src/test/routes/{access,durability,proxy}.test.ts` | AUTH-15 : enseignant non admin refusé sur POST/PATCH/DELETE `/api/lessons` et `/api/live-deck`, base inchangée ; admin : 404 sans détail pour une leçon inconnue ou un id invalide, 422 pour une leçon sans contenu ; proxy : `/teacher/create` → `/teacher` pour un enseignant, servi à un admin. Le test « leçon d'un autre enseignant : 404 » devient « enseignant non admin : 403, version intacte ». |

Vérification (6 novembre, Node 24.14, Windows) :

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx vitest run` | **33 fichiers, 265 tests passés** (4 ajoutés) |
| `npm run lint` | 0 erreur, 2 avertissements préexistants |
| `npm run build` (Next 16.4.5) | réussi |
| `node scripts/access-matrix.mjs http://localhost:3001` sur ce build | **54/54** (`access-matrix-results.2026-11-06.json` remplacé par cette exécution) |

Non vérifié : comportement en production (déploiement non effectué), variable `R2_PUBLIC_BASE_URL` sur Netlify,
compatibilité de Next 16.4.5 avec `@netlify/plugin-nextjs` 5.15 (le build local passe ; à surveiller au premier déploiement).
Retour arrière : `git revert` du commit ; aucune migration n'est impliquée.
