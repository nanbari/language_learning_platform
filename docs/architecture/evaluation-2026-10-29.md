# Monte & Souris — état du projet au 2026-10-29 (itération 2)

Suite de `evaluation-2026-10-28.md`. Mesures prises sur l'arbre de travail, build de production, projet Supabase réel.

## Ce qui a changé depuis l'itération 1

- **Durabilité** : enregistrement de leçon atomique (`version`, 409 au conflit, brouillon conservé, écrasement volontaire) ; événements d'exercice avec identifiant, file hors ligne persistée et renvoi sans doublon ; limitation de débit en base (connexion, demandes, réinitialisation) ; nettoyage R2 (médias d'une leçon supprimée, enregistrements remplacés). Tout tolère l'absence des migrations (comportement d'avant + avertissement). **Trois migrations à exécuter** : `2026-10-29_lessons_version.sql`, `2026-10-29_exercise_events_event_id.sql`, `2026-10-29_rate_limits.sql`.
- **Structure** : les trois plus gros fichiers découpés (`LivePlayer`, `LiveRoom`, `useVoiceRecorder`), chargés à la demande pour le cours en direct.
- **Performance** : une seule graisse Noto Naskh Arabic ; lecteur et salle du cours en direct en import dynamique ; CSP de production sans `unsafe-eval`.
- **Tests** : 255 (+26) dont les premiers tests de composants (QCM, diapositives du direct), la durabilité (12), la file d'événements (4), R2 (2).
- **Docs** : index `docs/README.md`, runbook `docs/ops/runbook.md`.

## Itération 3 (même jour, après l'exécution des trois migrations)

- Migrations vérifiées sur le projet réel : `lessons.version` présent, `exercise_events.event_id` présent,
  `rate_limit_hit()` répond (true puis false au-delà de la limite ; ligne de sonde supprimée).
- Performance : encodeur MP3 (≈ 150 Ko) et choix des lettres (tracés de l'alphabet) chargés à la demande dans
  l'éditeur ; police Caveat retirée (cinq micro-libellés « ASBL » en italique) : **−48 Ko de police sur chaque page**.

## Notes par axe

| Axe | 28/10 | **29/10** | Preuves |
|---|---|---|---|
| Arborescence | 9 | **9,5** | `src/` par responsabilité, imports `@/`, plus aucun fichier > 710 lignes hors données ; `teacher/create/page.tsx` (701) reste le seul candidat à un découpage de plus. |
| Code mort / dépendances | 10 | **10** | knip 0/0/0 ; 3 dépendances de test ajoutées, utilisées ; `@breezystack/lamejs` désormais chargé à la demande. |
| Qualité statique | 9 | **9** | tsc 0 ; ESLint 0 erreur / 2 avertissements React (IIFE de l'éditeur, reset d'état du mot à ordonner) — à traiter avec un test navigateur. |
| Tests | 7 | **9** | 33 fichiers / 255 tests : règles, routes (63), composants (6), file hors ligne, R2 ; matrice HTTP 54/54 ; bout en bout Realtime 24/24 sur le vrai projet. Manque : tests navigateur (Playwright) des parcours. |
| Sécurité | 9 | **9,5** | + limitation de débit active en base, CSP prod sans eval, nettoyage R2, Data API fermée. Reste la décision objets R2 publics (URL imprévisible) et la fenêtre Realtime ≤ 1 h. |
| Durabilité des données | 6 | **9** | migrations exécutées et vérifiées ; 409 testé, renvoi sans doublon testé, file persistée testée. |
| Performance (coquilles, 4G lente + CPU ×4 mobile) | 7 | **9** | login 364 → **315 Ko** (LCP 2,5 s) ; élève 432 → **380 Ko** (3,2 s) ; vocabulaire 528 → **371 Ko** (1,4 s) ; cours en direct élève 588 → **341 Ko** (4,1 → 3,0 s) ; présentation 631 → **364 Ko** (3,6 → 2,2 s) ; éditeur 824 → **751 Ko** (2,4 s). CLS ≤ 0,04. Reste : LCP mobile ~3 s sur 4G lente (Nunito + Fredoka + Noto Naskh = 153 Ko). |
| Documentation / exploitation | 8 | **9** | index, runbook, migrations documentées avec rollback, scripts reproductibles, fiche marketing vérifiée. Manque un projet Supabase de test. |

**Global : 9,2/10.** Tous les axes sont à 9 ou plus.

## Pour aller vers 10

1. Tests navigateur Playwright des trois parcours (élève fait une leçon, enseignant publie, cours en direct) sur un projet Supabase de test.
2. Les deux avertissements React restants, avec vérification visuelle.
3. Dernier découpage de `teacher/create/page.tsx` ; sous-ensembles de polices plus serrés si le LCP mobile doit passer sous 2,5 s.
4. Décision objets R2 (bucket privé + URLs signées) et acceptation ou réduction de la fenêtre Realtime.

Mesures : `docs/architecture/perf-2026-10-29-shell.json`, `docs/audit/access-matrix-results.final.json`.
