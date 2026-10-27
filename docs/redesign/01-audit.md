# Refonte premium — audit (26 octobre 2026)

Workflow : `/redesign-existing-projects` (skill installée, déjà appliquée aux phases 0–4).
Référence : `docs/monte-souris-redesign.md`. Captures de départ : `C:\Users\chara\Desktop\MonteEtSouris-phase3-4\`
(copiées dans `docs/redesign/before/`). Serveur local Next 16.2.6 / Tailwind 4 / React 19.

## Inventaire des routes (plateforme uniquement)

| Route | Composants | État |
|---|---|---|
| `/login`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` | `AuthShell`, layouts DM Sans | Refait phase 4 |
| `/teacher` | `TeacherShell`, `RequestInbox`, `ProgressWorkspace` | Refait phase 1 |
| `/teacher/create[?edit=]` + `/teacher/create/apercu` | `builder/*`, `LessonPlayer` (aperçu iframe même origine) | Refait phase 3 |
| `/teacher/present` | lancement + présentateur, `Slides`, `VideoCall` | Refait phase 4 |
| `/teacher/classes`, `/teacher/letters`, `/teacher/arabic`, `/teacher/equipe` | `audio/*` | Refait phase 4 / 1 |
| `/student` | `StudentShell`, `LessonTile`, `LiveState` | Refait phase 2 |
| `/student/lesson/[id]` | `LessonPlayer`, `ExerciseRenderers`, `FindLetterStage` | Phase 2–4 |
| `/student/practice/[id]` | générateur de révision + mêmes rendus | Phase 4 |
| `/student/live` | `LiveRoom`, `Slides`, `VideoCall` | Phase 4 |
| `/arabic`, `/arabic/reading`, `/arabic/vocabulary` | `StudentShell`, `themeIcons` | Phase 4 |

## Diagnostic priorisé (observé sur les captures, composant en cause)

1. **Aperçu de l'éditeur en « téléphone »** (`editeur-1440x900-1-activite.png`, `StudentPreview.tsx`) : bordure de 6 px sombre et ombre de dialogue ; l'outil ressemble à une publicité d'appareil. → surface calme, filet fin.
2. **Mobile éditeur : commandes avant la tâche** (`editeur-390x844-1-activite.png`, `teacher/create/page.tsx`) : flèches, Dupliquer, Supprimer occupent ~190 px avant la question. → menu « Options », en-tête compact, question + audio dans le premier écran.
3. **Cadre lourd autour de l'image du cours** (`direct-*-seance-activite.png`, `Slides.tsx` FlashcardSlide/VideoSlide) : bordure 6 px + ombre, image à ~45 % de la carte. → filet fin, image à 60–75 % de la scène.
4. **Mobile présentateur : trois zones en concurrence** (`direct-390x844-3-seance-activite.png`, `present/page.tsx`) : colonne participants haute pour une vignette, barre de 7 commandes sur 4 rangées. → participants repliés, deux rangées de commandes, menu « Plus ».
5. **Thèmes de vocabulaire = sélecteur administratif** (`arabe-vocabulaire-1440x900.png`, `vocabulary/page.tsx`, `themeIcons.ts`) : pictogrammes 32 px dans des carrés. → illustrations de 7–9 rem, grammaire visuelle commune.
6. **Lettres trop petites dans l'alphabet** (`arabe-lecture-1440x900.png`, `reading/page.tsx`) : lettre 2,25 rem, translittération presque aussi visible. → lettre 3 rem+, translittération discrète.
7. **Fin de révision = écran vide** (`revision-390x844.png`, `practice/[id]/page.tsx`) : coche, titre, un bouton sur fond uni. → composition calme (lavis pastel, résultat réel, deux actions).
8. **Accueil élève** : en-tête sobre mais sans point focal ; marches décoratives à droite. → lavis pastel statique, composition équilibrée (référence Aura, limites du brief).
9. Hypothèses non vérifiées sur capture : tableau de bord enseignant (phase 1, déjà conforme au brief), densité des tableaux de progression sur mobile. À recontrôler en fin de parcours.

Observations ≠ hypothèses : les vignettes vidéo vertes sont la fausse caméra de Playwright (`--use-fake-device-for-media-stream`), pas un choix de marque.

## Système consolidé

Les jetons du brief § 5 existent déjà dans `src/app/platform-tokens.css` (mêmes valeurs). Ajouts de cette passe : `.ms-welcome-wash` (lavis statique, un par écran au plus), `.ms-stage-card` (surface de scène sans cadre lourd). Pas de quatrième police ; Fredoka reste dans le logo seulement.
