# Parcours et cohérence produit — rapport (27 octobre 2026)

Workflow : `/redesign-existing-projects` (audit → implémentation → rendu → critique → correction).
Captures : `docs/redesign/parcours/` (1440×900 et 390×844 ; états fictifs, aucune écriture en base).
Rien n'est commité ni déployé.

## Diagnostic (vérifié dans le code et les captures)

| Constat | Où | Conséquence | Changement | Nature |
|---|---|---|---|---|
| La page Classes mettait en avant Renommer / Supprimer / Choisir les élèves ; aucune trace des leçons de la classe ni du cours | `classes-1440x900.png`, `teacher/classes` | L'enseignant reconstitue de tête le lien classe → leçons → direct → résultats | Page refaite en **espace de travail par classe** : élèves, leçons de la classe (avec l'état du diaporama), « Préparer une leçon », « Ouvrir le cours en direct », « Voir la progression » ; la maintenance passe dans « Options » | présentation + liens (données existantes) |
| Accueil élève : catalogue indifférencié, « Commencer » partout, section « À réviser » séparée | `accueil-1440x900-page.png` | L'enfant ne distingue pas commencer, rejouer, réviser, rejoindre | État réel par leçon d'après ses propres événements : **Commencer** / **Rejouer · déjà jouée** / **Réviser (n)** ; cours ouvert = action dominante ; en-tête plus bas quand il n'a rien à dire | présentation (lecture de `/api/events`, déjà autorisée pour l'élève) |
| « Enregistrer » dans l'éditeur ne disait pas que la classe voit la leçon aussitôt ; le diaporama du direct semblait lié à l'enregistrement | `editeur-1440x900-3-informations.png` | Risque de montrer une leçon inachevée, ou de projeter un diaporama périmé | Copie honnête (pas de brouillon : visible dès l'enregistrement), **état du diaporama calculé par le serveur** (`liveStale`) : « à jour » / « à mettre à jour : la leçon a changé » / « pas de diaporama » ; même état sur l'écran de lancement du direct et sur la page Classes | API additive (`live_stale` dans GET `/api/lessons`), pas de changement de schéma |
| Salle d'attente élève sans contexte | `eleve-direct-1440x900-attente.png` | « Rien ne se passe » | Le groupe et l'enseignant (données réelles du cours rejoint) restent affichés ; aucun horaire inventé | présentation |
| Fin de leçon : un seul message pour tout | `revision-390x844.png`, lecteur de leçon | Pas de différence entre réussite, exercices à revoir et résultats indisponibles | Cinq états : résultats en attente / **Tu as tout réussi.** / **n exercice(s) à revoir** + « Réviser maintenant » / résultats indisponibles / aperçu ; « Rejouer » et « Choisir une autre leçon » | présentation |
| Progression : la difficulté n'ouvrait pas le contenu | tableau de bord | L'enseignant ne retrouve pas la leçon derrière une erreur | Dans la fiche élève : « Voir comme un élève » et « Modifier la leçon » par leçon ; filtre de classe pré-rempli par `?classe=` depuis la page Classes | liens |

Hypothèses non retenues : « Continuer » (reprise au milieu d'une leçon) n'est **pas** proposé, aucune position de
reprise n'est enregistrée ; aucun « prochain cours » ni calendrier n'existe.

## Les trois parcours, tels qu'ils fonctionnent maintenant

**A — préparer et enseigner.** Mes classes → classe (élèves, leçons, état des diaporamas) → « Préparer une leçon »
(éditeur, classe présélectionnée par `?class=`) → enregistrement = visible par la classe, panneau diaporama à jour /
à mettre à jour → « Ouvrir le cours en direct » (`?class=`, leçons de la classe en tête, diaporama périmé signalé avec
lien vers l'éditeur) → séance (en-tête : classe + leçon). Retour : « Leçons » dans l'éditeur, nom de la classe partout.

**B — arriver et apprendre.** Accueil : cours ouvert → « Rejoindre le cours » domine ; sinon une ligne, puis les leçons
avec leur état réel → leçon → exercice → fin (résultat réel) → « Réviser maintenant » / « Rejouer » / « Choisir une
autre leçon ». Première visite : tout en « Commencer », rien d'inventé.

**C — relire et continuer.** Classe → « Voir la progression » (filtre pré-rempli) → élève → leçon → « Voir comme un
élève » / « Modifier la leçon » → retour à l'éditeur ou à la classe.

## Fichiers modifiés

`src/lib/lessonDeck.ts` (export `isDeckStale`), `src/app/api/lessons/route.ts` (`live_stale`), `src/lib/lessonsApi.ts`
(`liveStale`), `src/app/(platform)/teacher/classes/page.tsx` (réécrit), `src/components/teacher/DeckStatusPill.tsx`
(nouveau), `src/app/(platform)/teacher/page.tsx`, `src/components/teacher/ProgressWorkspace.tsx`,
`src/components/teacher/TeacherShell.tsx` (ordre du menu), `src/app/(platform)/teacher/create/page.tsx`,
`src/app/(platform)/teacher/present/page.tsx`, `src/app/(platform)/student/page.tsx` (réécrit),
`src/app/(platform)/student/live/page.tsx`, `src/components/lesson/LessonPlayer.tsx`.

## Contrôles

- `npx tsc --noEmit` : 0 erreur · `npm test` : 170/170 · `npm run build` : réussi (45 pages).
- `npx eslint` sur tous les fichiers touchés : 0 erreur, 5 avertissements, tous préexistants.
- Rendus Playwright (données fictives, `/api` non-GET interceptés) : aucun débordement, aucune cible élève < 64 px ni
  enseignant < 44 px sur les écrans capturés.
- Parcours vérifiés en navigateur émulé : accueil (première visite, retour, cours ouvert), leçon → quiz → fin (3 états),
  salle d'attente avec contexte, classes (vide de leçons : les classes fictives ne correspondent à aucune leçon réelle),
  éditeur Informations, lancement du direct.
- Non vérifié : enregistrement puis réouverture d'une vraie leçon (nécessite une écriture en base — à faire sur un
  compte de test), remplacement d'un enregistrement audio, synchronisation en séance réelle, appareils physiques.

## Limites réelles, à décider (pas déguisées)

1. **Enregistrements de vocabulaire** (`/teacher/arabic`) : stockés dans le navigateur de l'enseignant (`localStorage`),
   comme l'écran le dit. Ils **n'atteignent jamais l'appareil d'un élève** ; seuls les sons des lettres passent par le
   serveur. Rendre ces enregistrements utiles aux élèves demande le même stockage serveur que les lettres : extension
   produit, à approuver.
2. **Couvertures de leçons** : règle actuelle = première image de leçon illustrée, sinon image de la bonne réponse du
   premier quiz, sinon première lettre. Pas de couverture choisie par l'enseignant (il faudrait un champ) : extension.
3. **« Continuer »** : impossible sans mémoriser la position dans la leçon ; non proposé.
4. **Limite de six enfants par groupe** : absente du code (50 par classe) ; à confirmer.
5. Le compte d'activités enseignant (blocs) diffère toujours du compte élève (activités jouables).
