# Runbook — exploitation de Monte & Souris

Hébergement : Netlify (site `monte-et-souris`, domaine monteetsouris.com) · base, auth et Realtime : Supabase · médias : Cloudflare R2.

## 1. Déployer

1. Vérifications locales : `npm run lint && npm run typecheck && npm test && npm run build`.
2. Migrations : exécuter dans l'éditeur SQL Supabase tout fichier de `supabase/migrations/` plus récent que le dernier déployé (ordre des dates). Le code tolère leur absence (il se comporte comme avant et le signale dans les journaux), mais la fonctionnalité correspondante n'est active qu'une fois la migration passée.
3. Variables d'environnement Netlify : celles de `.env.example` (noms). Obligatoires : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `R2_*`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL`. Facultative : `SUPABASE_JWT_SECRET` (jetons Realtime courts ; sans elle, sessions Supabase Auth).
4. `git push` sur `main` → Netlify construit et publie.
5. Après publication : `node scripts/access-matrix.mjs https://monteetsouris.com` (lectures et refus seulement) → toutes les lignes PASS ; ouvrir `/login` ; lancer un cours en direct avec deux comptes de test.

## 2. Retour arrière

- Code : Netlify → Deploys → « Publish deploy » sur la version précédente (immédiat).
- Base : chaque migration documente son rollback en commentaire ; ne jamais supprimer une colonne qui contient des données sans sauvegarde (Supabase → Database → Backups).

## 3. Incidents fréquents

| Symptôme | Cause probable | Action |
|---|---|---|
| `/api/*` répond 503 « Service indisponible » | base injoignable ou profil illisible (`server/session.ts` refuse plutôt que deviner) | état Supabase, journaux Netlify (`[api <ref>]`) |
| 500 « Erreur serveur » avec `ref` | erreur base/service masquée | chercher `ref` dans les journaux Netlify : le détail y est |
| « La vidéo du cours n'est pas disponible » | jeton Realtime impossible (voir journaux `[live]`) ; les diapositives continuent | vérifier Supabase Auth (liens magiques) ou `SUPABASE_JWT_SECRET` |
| Élève retiré d'une classe encore en vidéo | fenêtre résiduelle ≤ 1 h (session Supabase) / 15 min (HS256) | documenté ; raccourcir avec `SUPABASE_JWT_SECRET` |
| Connexions refusées 429 | limitation de débit (`rate_limits`) | `delete from rate_limits where key like 'login:%'` pour lever un blocage légitime |
| `keepalive.yml` en échec | `/api/health?deep=1` ne renvoie plus `"db":"ok"` | base en pause ou injoignable |
| Leçon : « modifiée ailleurs » | deux éditeurs sur la même leçon (409) | recharger, ou enregistrer à nouveau pour écraser |

## 4. Comptes

- Création d'enseignant : espace admin → Équipe (invitation Supabase). Désactivation : `update users set disabled_at = now() where id = …` (prend effet à la requête suivante).
- Suppression : supprimer l'utilisateur dans Supabase Auth puis dans `users` (les événements d'exercice suivent en cascade).

## 5. Secrets

- Jamais dans le dépôt ni dans le chat. Rotation : Netlify → variable → nouvelle valeur → redéploiement. `AUTH_SECRET` changé = toutes les sessions fermées (voulu en cas de fuite).
- La clé service-role ne sort pas du serveur ; la clé anonyme est publique par conception et ne donne rien (RLS sans politique sur les tables, canaux Realtime privés).

## 6. Vérifications périodiques

- Mensuel : `docs/audit/supabase-inventory.sql` (RLS, politiques, grants) ; `npm audit`.
- Après chaque changement de route : `npm test` (tests de routes) et la matrice d'accès.
