# Monte & Souris — état du projet au 2026-10-29 (itération 2)

Suite de `evaluation-2026-10-28.md`. Mesures prises sur l'arbre de travail, build de production, projet Supabase réel.

## Ce qui a changé depuis l'itération 1

- **Durabilité** : enregistrement de leçon atomique (`version`, 409 au conflit, brouillon conservé, écrasement volontaire) ; événements d'exercice avec identifiant, file hors ligne persistée et renvoi sans doublon ; limitation de débit en base (connexion, demandes, réinitialisation) ; nettoyage R2 (médias d'une leçon supprimée, enregistrements remplacés). Tout tolère l'absence des migrations (comportement d'avant + avertissement). **Trois migrations à exécuter** : `2026-10-29_lessons_version.sql`, `2026-10-29_exercise_events_event_id.sql`, `2026-10-29_rate_limits.sql`.
- **Structure** : les trois plus gros fichiers découpés (`LivePlayer`, `LiveRoom`, `useVoiceRecorder`), chargés à la demande pour le cours en direct.
- **Performance** : une seule graisse Noto Naskh Arabic ; lecteur et salle du cours en direct en import dynamique ; CSP de production sans `unsafe-eval`.
- **Tests** : 255 (+26) dont les premiers tests de composants (QCM, diapositives du direct), la durabilité (12), la file d'événements (4), R2 (2).
- **Docs** : index `docs/README.md`, runbook `docs/ops/runbook.md`.

## Notes par axe

| Axe | 28/10 | **29/10** | Preuves |
|---|---|---|---|
| Arborescence | 9 | **9,5** | `src/` par responsabilité, imports `@/`, plus aucun fichier > 710 lignes hors données ; `teacher/create/page.tsx` (701) reste le seul candidat à un découpage de plus. |
| Code mort / dépendances | 10 | **10** | knip 0/0/0 ; 3 dépendances de test ajoutées, utilisées. |
| Qualité statique | 9 | **9** | tsc 0 ; ESLint 0 erreur / 2 avertissements React (IIFE de l'éditeur, reset d'état du mot à ordonner) — à traiter avec un test navigateur. |
| Tests | 7 | **9** | 33 fichiers / 255 tests : règles, routes (63), composants (6), file hors ligne, R2 ; matrice HTTP 54/54 ; bout en bout Realtime 24/24 sur le vrai projet. Manque : tests navigateur (Playwright) des parcours. |
| Sécurité | 9 | **9,5** | + limitation de débit, CSP prod sans eval, nettoyage R2. Reste la décision objets R2 publics (URL imprévisible) et la fenêtre Realtime ≤ 1 h. |
| Durabilité des données | 6 | **9 une fois les 3 migrations passées** (8 tant qu'elles ne le sont pas : le code est prêt et testé, la base n'a pas encore les colonnes) | 409 testé, renvoi sans doublon testé, file persistée testée. |
| Performance (coquilles, 4G lente + CPU ×4 mobile) | 7 | **8,5** | cours en direct élève 588 → **390 Ko**, LCP 4,1 → **3,2 s** ; présentation enseignant 631 → **411 Ko**, 3,6 → **2,2 s** ; vocabulaire 528 → **420 Ko** ; login 2,6 s ; élève 3,3 s. Reste : l'éditeur (822 Ko, page bureau) et le LCP mobile ~3 s sur 4G lente (polices 142–201 Ko). |
| Documentation / exploitation | 8 | **9** | index, runbook, migrations documentées avec rollback, scripts reproductibles. Manque un projet Supabase de test. |

**Global : 9/10** dès que les trois migrations sont exécutées (8,7 avant).

## Prochaine itération (pour viser 9,5–10)

1. Exécuter les trois migrations ; relancer `node scripts/live-e2e.mjs` et deux tests de durabilité en conditions réelles.
2. Performance mobile : différer `framer-motion` (Confetti, transitions) hors du cours en direct ; éditeur : panneaux et aperçu en import dynamique ; envisager Caveat/Fredoka en sous-ensembles plus petits.
3. Tests navigateur Playwright des trois parcours (élève fait une leçon, enseignant publie, cours en direct) sur un projet Supabase de test.
4. Les deux avertissements React restants.

Mesures : `docs/architecture/perf-2026-10-29-shell.json`, `docs/audit/access-matrix-results.final.json`.
