# Monte & Souris

Plateforme d'apprentissage de l'arabe pour les enfants de 4 à 10 ans (ASBL, Bruxelles) : leçons créées par les
enseignants, exercices, révisions ciblées, cours en direct avec vidéo. Next.js 16 (App Router), React 19, Tailwind 4,
Supabase (Postgres, Auth, Realtime), Cloudflare R2, hébergé sur Netlify.

## Démarrer

```bash
npm ci
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run lint` · `npm run typecheck` · `npm test` | ESLint · TypeScript · Vitest (unitaires + routes API) |
| `node scripts/access-matrix.mjs http://localhost:3001` | matrice d'accès HTTP contre un `next start` (identités synthétiques, lectures et mutations refusées seulement) |
| `node scripts/live-realtime-check.mjs` | vérification des canaux Realtime privés, **sur un projet Supabase de test** |

## Arborescence

```
src/
  app/            pages (App Router) et routes /api — des gestionnaires fins : session → droits → validation → données
  components/     interface (auth, élève, enseignant, leçon, présentation)
  hooks/          hooks React (suivi des exercices, cours en direct, vidéo)
  lib/            modèle partagé client/serveur : validation, règles pédagogiques, types ; lib/api/ = appels /api
  server/         code serveur uniquement : session (cookie signé + relecture du profil), Supabase service-role,
                  accès aux classes et au cours en direct, R2, jetons Realtime, erreurs masquées
  data/           alphabet, vocabulaire, tracés des lettres
  store/          état client (utilisateur connecté)
  test/           base en mémoire et aides pour les tests de routes
  proxy.ts        garde des pages privées (/teacher, /student, /arabic)
public/           photos de vocabulaire (CC, voir vocab/credits.json), sons, vidéos des anciens diaporamas
supabase/         schema.sql (base) + migrations/ (à exécuter dans l'éditeur SQL, dans l'ordre des dates)
scripts/          outillage : matrice d'accès, vérification Realtime, migration audio, génération des tracés
docs/             audit de sécurité et remédiation (audit/), architecture (architecture/), charte, redesign
```

## Sécurité, en deux lignes

L'identité vient du cookie signé ; l'autorité (rôle, droit admin, compte désactivé) est relue en base à chaque
requête protégée (`src/server/session.ts`). Les routes `/api` décident tout ; les pages ne contiennent aucune donnée
privée. Détails et état des vérifications : `docs/audit/` et `docs/architecture/completion-plan.md`.

## Déploiement

Netlify construit `npm run build` à chaque push sur `main` (`netlify.toml`). Avant un déploiement qui touche la base,
exécuter les migrations de `supabase/migrations/` puis renseigner les variables d'environnement (`.env.example`).
