# Voix de l'enseignante et atelier de l'élève (27 octobre 2026)

Suite du rapport 04. Rien n'est commité ni déployé. Captures : `docs/redesign/voix/`.

## Où sont stockés les enregistrements

| Enregistrement | Fichier | Adresse | Qui l'entend |
|---|---|---|---|
| Sons des lettres, questions des exercices de lettres (admins) | bucket R2 (public) | tables Supabase `letter_sounds`, `question_sounds` | tous les élèves |
| Audios d'une leçon (question de quiz, voix d'une diapo, énoncé) | R2 | dans la leçon (`lessons.exercises`, Supabase) | les élèves de la classe |
| **Vocabulaire** (page « Enregistrements audio ») — **avant** | `localStorage` du navigateur de l'enseignante | — | **personne d'autre** |
| **Vocabulaire** — **maintenant** | R2 (mp3) | **nouvelle table `vocab_sounds`** (`word_id`, `url`) | tous les élèves, sur tous les appareils |

## Point 2 — la voix arrive chez les élèves

- **Migration** `supabase/migrations/2026-10-27_vocab_sounds.sql` : une table, même forme que `question_sounds`.
  **À exécuter dans l'éditeur SQL Supabase avant le déploiement** ; tant qu'elle n'existe pas, l'API répond vide et
  l'exercice reste muet, sans erreur visible.
- **API** `src/app/api/vocab-sounds/route.ts` : GET pour tout compte connecté (`{ id du mot: URL }`) ; PUT / DELETE
  pour les enseignants et admins ; l'URL doit venir de notre bucket R2 (comme pour les lettres) ; les ids sont
  vérifiés contre `src/data/arabicVocabulary.ts` ; `_instruction` = la consigne.
- **Lib** `src/lib/vocabSound.ts` : chargement mis en cache, enregistrement, suppression, lecture par le lecteur audio
  partagé (celui qui est débloqué au premier toucher sur tablette).
- **Page enseignante** (`/teacher/arabic`) : l'enregistrement part vers R2 en mp3 (conversion existante, lisible sur
  iPhone/iPad) puis est associé au mot ; « Enregistré » n'apparaît qu'après l'accord du serveur ; en cas d'échec,
  l'ancien enregistrement reste. Nouvelle ligne en tête : **la consigne** « Écoute, puis choisis l'image. ».
  Les anciens enregistrements encore dans le navigateur sont détectés et un bouton **« Envoyer aux élèves »** les
  téléverse un par un (chacun n'est retiré du navigateur qu'une fois enregistré sur la plateforme).
- **Exercice élève** (`/arabic/vocabulary`) : sons lus depuis la plateforme ; « Écoute, puis choisis l'image. » et le
  bouton « Écouter » n'apparaissent que si le mot a une voix ; la consigne enregistrée est lue une fois à l'entrée
  dans un thème (le toucher sur le thème autorise le son) ; « Le son n'a pas pu démarrer. » + Réessayer sinon.

Non fait, volontairement : une consigne parlée pour « retrouver la lettre ». Le son de la lettre est lui-même la
consigne (choix pédagogique du code existant) ; à discuter avec l'enseignante avant d'ajouter une voix par-dessus.

## Point 3 — « Ton atelier » sur l'accueil élève

À partir des événements d'exercice de l'enfant (déjà lus pour « Rejouer ») : **leçons jouées**, **exercices
réussis**, et **les lettres dont il a réussi un jeu** (l'identifiant d'un jeu de lettres contient le numéro de la
lettre). Affiché seulement quand il y a quelque chose ; une première visite ne montre rien. Aucun niveau, aucune
maîtrise, aucun classement n'est déduit.

## Contrôles

- `npx tsc --noEmit` : 0 erreur · `npm test` : 170/170 · `npm run build` : réussi.
- `npx eslint` sur les fichiers touchés : 0 erreur, 0 avertissement nouveau.
- Rendus (1440 et 390, données fictives) : page enseignante avec consigne et ancien enregistrement à envoyer,
  exercice élève, accueil avec atelier.
- Non testé : un vrai enregistrement de bout en bout (micro → R2 → table → lecture sur un autre appareil). À faire
  après la migration, sur un compte de test.
