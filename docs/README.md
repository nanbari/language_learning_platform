# Documentation — Monte & Souris

| Dossier | Contenu | À lire pour |
|---|---|---|
| `audit/` | audit de sécurité initial (2026-10-27), remédiation lot 1 (2026-10-28), backlog, résultats de la matrice d'accès, inventaire SQL en lecture seule | comprendre les règles d'accès, l'état des vérifications, ce qu'il reste à décider |
| `architecture/` | carte de l'architecture et des contrats API (`codebase-cleanup-report.md`), plan d'achèvement (`completion-plan.md`), évaluation datée, mesures de performance, migrations proposées | savoir où va le code, pourquoi, et ce qui est encore en suspens |
| `ops/` | runbook : déploiement, migrations, variables, incidents, retour arrière | mettre en production et réagir à un problème |
| `charte/` | charte graphique (HTML + PDF) | le design |
| `redesign/` | rapports du redesign de la plateforme (audit, parcours, performance, voix) et relecture des photos de vocabulaire | l'histoire des choix d'interface |

Règles de contribution courtes :
- toute route `/api` suit `session → droits → validation → données → JSON` avec les helpers de `src/server/` ;
- toute donnée privée passe par `/api` (jamais par la Data API Supabase depuis le navigateur) ;
- un changement de schéma = un fichier daté dans `supabase/migrations/`, tolérant tant qu'il n'est pas appliqué ;
- `npm run lint && npm run typecheck && npm test && npm run build` doivent passer avant tout commit ; la matrice d'accès (`scripts/access-matrix.mjs`) avant tout déploiement.
