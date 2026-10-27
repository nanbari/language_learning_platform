# Monte & Souris — état du projet au 2026-10-28 (évaluation)

Mesures prises sur l'arbre de travail courant (non commité), build de production, projet Supabase réel.

## Notes par axe

| Axe | Note | Preuves |
|---|---|---|
| Arborescence | **9/10** | racine : 12 entrées (config + `src/ public/ supabase/ scripts/ docs/`) ; `src/` découpé par responsabilité (`app` · `components` · `hooks` · `lib` + `lib/api` · `server` · `data` · `store` · `test` · `types`) ; tous les imports internes en alias `@/` ; aucun module serveur importé par le navigateur (hors types) ; `.env.example` et README réels. Reste : `src/app/(platform)/teacher/create/page.tsx` (849 lignes) et `present/page.tsx` (731) à découper. |
| Code mort / dépendances | **10/10** | `knip` : 0 fichier, 0 export, 0 dépendance inutilisés ; 14 dépendances runtime, 11 dev ; 0 `any`, 8 `eslint-disable` ciblés (tous `exhaustive-deps` dans des effets volontaires), 4 `console.*` hors tests (journaux serveur). 70 fichiers retirés de git, 4 dossiers de rendus et 25 Mo de captures sortis du dépôt. |
| Qualité statique | **9/10** | `tsc --strict` 0 erreur ; ESLint 0 erreur / 2 avertissements React Compiler (`ExerciseRenderers.tsx:248`, `teacher/create/page.tsx:594`), corrigeables mais à valider en navigateur. |
| Tests | **7/10** | 28 fichiers, **230 tests** : règles pédagogiques, validation, session, et 51 tests de routes API (anonyme, isolation A/B, usurpation, retrait, pannes masquées). Matrice HTTP 54/54 sur le build. **Aucun test de composant ni de page** (31 composants, 50 modules client) ; pas de test navigateur. |
| Sécurité | **9/10** | identité par cookie signé, autorité relue en base à chaque requête ; cours en direct piloté par le serveur ; canaux Realtime privés **vérifiés sur le projet réel** (24/24, comptes synthétiques supprimés) ; API REST fermée aux comptes utilisateurs ; erreurs masquées. Reste : objets R2 publics (URL imprévisible, pas d'expiration), pas de limitation de débit, CSP avec `unsafe-inline/eval`, fenêtre ≤ 1 h après retrait d'un participant déjà connecté. |
| Durabilité des données | **6/10** | sauvegarde de leçon « dernier qui écrit gagne » ; événements d'exercice perdus hors ligne (enregistrements pédagogiques). Migrations proposées, non appliquées (`docs/architecture/proposed-migrations/`). |
| Performances (coquilles, 4G lente + CPU ×4 sur mobile) | **7/10** | `/login` LCP 2,8 s · 364 Ko ; `/student` 3,6 s · 432 Ko ; `/arabic/vocabulary` 1,4 s · 528 Ko (319 Ko de polices) ; `/student/live` 4,1 s · 588 Ko (358 Ko JS) ; `/teacher` 2,3 s · 417 Ko ; `/teacher/create` 2,8 s · 824 Ko ; `/teacher/present` 3,6 s · 631 Ko. CLS ≤ 0,04 partout. JS client total 3,1 Mo brut (avant gzip, toutes pages). Points lourds : polices (Noto Naskh Arabic 2 graisses sur la page vocabulaire), `framer-motion` + WebRTC sur la page direct, éditeur de leçon. |
| Documentation / exploitation | **8/10** | audit, remédiation, nettoyage, plan d'achèvement, inventaire SQL, scripts reproductibles (`access-matrix`, `live-e2e`, `live-realtime-check`), CI (lint, types, tests, build ; matrice d'accès prête mais désactivée). Reste : pas de projet Supabase de test (le dev local pointe sur la production). |

**Global : 8/10** — base saine, sécurisée et vérifiée ; les points faibles sont la durabilité des données (deux migrations à approuver), la couverture de tests côté interface et le poids JS/polices des pages mobiles.

## Ce qui ferait gagner le plus, dans l'ordre

1. **Déployer** l'état actuel (Netlify tourne encore l'ancien code) après commit.
2. Migrations `lessons.version` (409 au conflit, brouillon conservé) et `exercise_events.event_id` + file hors ligne — durabilité.
3. Poids mobile : une seule graisse de Noto Naskh Arabic sur `/arabic/vocabulary` (−~100 Ko), chargement différé de `framer-motion` hors des pages qui animent, découpage de `useLiveVideo` (WebRTC) en import dynamique à l'entrée du cours.
4. Tests de composants (Vitest + Testing Library) sur `LessonPlayer`, `ExerciseRenderers`, `Slides` — là où vit la pédagogie.
5. Découper `teacher/create/page.tsx` et `teacher/present/page.tsx` (≥ 700 lignes) en sections ; corriger les 2 avertissements React.
6. R2 : suppression des objets orphelins à la suppression d'une leçon, puis décision bucket privé / URLs signées.
7. Projet Supabase de test pour le développement et la CI (la matrice d'accès et `live-e2e` s'y brancheraient).

Mesures brutes : `docs/architecture/perf-2026-10-28-shell.json`, `docs/audit/access-matrix-results.final.json`.
