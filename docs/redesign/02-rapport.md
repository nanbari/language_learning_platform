# Refonte premium — rapport (26 octobre 2026)

Workflow suivi : `/redesign-existing-projects` (audit → implémentation → rendu → critique → correction, trois tours)
et, en gate mesurée complémentaire, `design-taste-frontend` (`inspect.mjs --app`, installé ce jour sur demande).
Direction : « L'atelier Montessori — précision éditoriale, lumière douce, objets qui ont du sens ».
Rien n'est commité ni déployé.

## Fichiers modifiés dans cette passe

| Fichier | Changement |
|---|---|
| `src/app/platform-tokens.css` | `.ms-welcome-wash` (lavis statique, un par écran), `.ms-stage-card` (scène : filet fin, pas de cadre) |
| `src/components/teacher/builder/StudentPreview.tsx` | cadre « téléphone » remplacé par une surface calme et un filet |
| `src/app/(platform)/teacher/create/page.tsx` | colonnes 14 rem / souple / 20 rem ; en-tête d'activité compact ; menu « Options » (monter, descendre, dupliquer, supprimer) sous 768 px ; libellés « Enregistrer la leçon / les modifications » |
| `src/components/teacher/builder/BlockEditors.tsx` | champs arabes : `lang`, `dir`, Naskh 1,5 rem / 2,5 rem dès la première lettre arabe (question, réponses, paires, éléments, phrase, texte de diapo) |
| `src/components/teacher/builder/AudioField.tsx` | actions secondaires compactes (une ligne à 390 px) |
| `src/components/present/Slides.tsx` | carte image : `ms-stage-card`, image à 60 vmin (≈ 60–75 % de la scène), bordure 6 px et ombres lourdes retirées ; tuiles de jeu : ombre du système |
| `src/app/(platform)/teacher/present/page.tsx` | participants repliés sous 1024 px (ligne « Participants · N · réponses »), scène prioritaire (`grid-rows`), deux rangées de commandes (Précédent · Suivant · Terminer / Micro · Caméra · Plus), menu « Plus » (micros des élèves, plein écran) |
| `src/app/(platform)/student/live/page.tsx` | la scène prend la hauteur ; la bande vidéo garde la sienne |
| `src/components/student/ThemeArt.tsx` (nouveau) | huit illustrations de thème, dessinées en code, même grammaire visuelle |
| `src/app/(platform)/arabic/vocabulary/page.tsx` | tuiles de thème illustrées (zone 7–9 rem), consigne « Écoute, puis choisis l'image. », mot en `clamp(3rem,7vw,4.5rem)`, images de réponse standardisées |
| `src/app/(platform)/arabic/reading/page.tsx` | lettre à 3,25 rem, translittération secondaire ; fiche : lettre `clamp(6rem,12vw,8rem)` |
| `src/app/(platform)/student/practice/[id]/page.tsx` | fins « Tu as terminé » / « Rien à revoir » : lavis, nombre réel d'exercices rejoués, « Encore une fois » / « Choisir une autre leçon » |
| `src/app/(platform)/student/page.tsx` | en-tête d'accueil sur lavis pastel (une seule zone), encadré « cours ouvert » sur surface pleine |
| `src/components/layout/AuthShell.tsx` | liste des trois promesses sans vignettes teintées ; logo cliquable ≥ 44 px |
| `next.config.ts` | `/teacher/create/apercu` peut être encadré par notre propre site (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`) ; `frame-src 'self'` — déjà fait en phase 3, rappelé ici car il conditionne l'aperçu |

Aucun contrat de données, route, API, permission, règle de jeu ou enregistrement d'essai n'a changé.

## Écrans traités

Trio prioritaire : éditeur de leçons, présentateur du cours en direct, thèmes de vocabulaire.
Propagation : accueil élève, alphabet, exercice de vocabulaire, fin de révision, salle élève en direct, connexion.
Déjà conformes au brief (phases 1–4, revus sur capture, non retouchés) : tableau de bord et progression, classes, bibliothèques de sons, équipe.

## Avant / après (mêmes fenêtres)

`docs/redesign/before/` ← `docs/redesign/after/` (copie sur `C:\Users\chara\Desktop\MonteEtSouris-premium\`, dossier `avant\`).

| Écran | Avant | Après |
|---|---|---|
| Éditeur, 1440 | `editeur-1440x900-1-activite.png` : aperçu dans un cadre sombre de 6 px | même nom : surface calme, filet fin ; champ arabe en Naskh |
| Éditeur, 390 | commandes sur 190 px avant la question | question + audio dans le premier écran, « Options » à droite, début des réponses visible |
| Présentateur, 1440 | photo à ~45 % d'une carte bordée | photo à ~75 % de la carte, carte à 74 vmin, pas de cadre |
| Présentateur, 390 / 768 | colonne participants haute, 4 rangées de commandes | scène dominante, participants repliés, 2 rangées |
| Thèmes, 1440 / 390 | pictogrammes 32 px dans des carrés | illustrations 7–9 rem, titre, arabe, « N mots » |
| Alphabet, 1440 | lettre 2,25 rem ≈ translittération | lettre 3,25 rem, translittération discrète |
| Révision, 390 | coche + titre + un bouton | lavis, résultat réel, deux actions |
| Accueil, 1440 / 390 | en-tête plat | lavis pastel, marches du logo, cours en direct à sa place |

Captures : 71 fichiers, 1440×900, 1180×820, 768×1024, 390×844 (premier écran, et page entière pour les listes).

## Critique (format `references/critique.md`, adapté aux écrans d'application)

```
ROUND 1
Seen in one second: éditeur = la question et ses trois photos ; présentateur = la photo ; thèmes = huit objets.
Top three problems:
1. Présentateur 390/768 : bande blanche sous « Participants » (grille étirée) ; trois rangées de commandes. → grid-rows, ordre des blocs, « Terminer » en rangée 1.
2. Éditeur 390 : titre sur deux lignes, ligne audio repliée sur trois. → libellé court, actions compactes.
3. Scène : filet coloré qui dépassait des coins arrondis. → retiré.
ROUND 2
1. Présentateur 768 : « Terminer » seul en troisième rangée. → règle « deux rangées » étendue jusqu'à 1024 px.
2. Éditeur 390 : corbeille encore seule. → paddings réduits (une ligne vérifiée).
3. Connexion : trois icônes en carrés teintés (FAIL icon-chips de l'inspecteur). → icônes nues en encre.
ROUND 3
Aucun problème qu'un inconnu nommerait sur les captures relues (éditeur, présentateur, salle élève, connexion, thèmes).
Scores (juré, non arrondis) : design 7,5 · usability 8 · creativity 7 · content 8 → 7,6.
Caps : aucun FAIL ; le lavis est volontaire et borné (brief § 4), il n'est pas compté comme « gradient décoratif ».
```

Inspecteur `design-taste-frontend` sur `/login` (seul écran atteignable sans session) : **0 FAIL, 1 WARN** avec
`--allow emoji,palette-cream,font-count` (l'étoile, la crème et Fredoka/Caveat sont le logo et la charte, imposés
par le brief). Le WARN restant (`unused-canvas`, 245 px à droite de la carte de connexion) est la colonne centrée
de 28 rem dans la moitié droite : défendable, la carte reste à la largeur d'un formulaire.

## Vérifications exécutées (résultats réels)

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm test` (vitest) | 20 fichiers, 170 tests, tous réussis |
| `npm run build` | réussi, 45 pages |
| `npx eslint` (tout le dépôt) | 805 problèmes : 32 erreurs, toutes préexistantes (identiques à la base) ; +1 avertissement sur la base, corrigé ensuite (import inutilisé) |
| `npx eslint` sur les fichiers de cette passe | 0 erreur, 0 avertissement après correction (les 2 avertissements de `create/page.tsx` datent de la phase 3 : `react-hooks/purity`, `react-hooks/refs`) |
| Captures Playwright (`shoot5.mjs`) | aucun débordement horizontal ; aucune cible enseignant < 44 px ni élève < 64 px (hors étoile du logo, qui n'est pas un contrôle) |
| Inspecteur taste-skill `/login` | 0 FAIL, 1 WARN (voir plus haut) |

Non vérifié / hors de portée de cette session :
- Aucun test sur appareil réel ni fournisseur vidéo réel : les vignettes vertes sont la fausse caméra de Playwright ; micro, caméra, reconnexion et synchronisation à sept participants restent à tester en séance.
- Aucune lecture d'écran ni zoom 200 % mesuré ; reflow à 320 px vérifié uniquement en phase 2 sur l'accueil et l'exercice de lettres.
- Les écrans de l'éditeur et du présentateur ont été rendus avec des classes et élèves fictifs ; toutes les écritures `/api` étaient interceptées (aucune donnée en base).
- Contraste du lavis : le point le plus coloré (pétale à 30 % sur `#FFFDF8`) donne ≈ `#F0E8E6` ; encre `#2A2B27` 13,4:1, texte secondaire `#65675E` 5,1:1 — calcul, non mesuré sur rendu.

## Images et licences

- `src/components/student/ThemeArt.tsx` : huit dessins originaux écrits en SVG pour ce projet (aucune source externe, aucune licence à créditer). Le brief préfère de vraies photographies : le dépôt n'en a pas pour ces thèmes, aucune n'a été téléchargée ni générée. Remplaçables un par un si l'ASBL fournit des photos cohérentes.
- Photos des leçons : celles de l'enseignant, déjà en base (R2).
- Références externes (`auragradients`, `openhero`) : consultées comme références de composition uniquement ; aucun code ni actif repris.

## Points restants

1. Pictogrammes des mots (🐰…) dans les tuiles de réponse du vocabulaire : gardés comme imagerie pédagogique pour pré-lecteurs, dans un cadre uniforme ; à remplacer par des photos si l'ASBL en valide une série.
2. `/arabic`, `/arabic/reading`, `/arabic/vocabulary` ne sont pas protégées par le proxy (déjà le cas avant) : à décider.
3. La limite de six enfants par groupe n'existe pas dans le code (seul `MAX_MEMBERS = 50`) : à confirmer où elle s'applique.
4. Le compte d'activités diffère entre tableau de bord enseignant (blocs) et accueil élève (activités jouables).
5. Les deux avertissements lint de `create/page.tsx` (lecture de ref pendant le rendu, `Date.now()` dans un gestionnaire) sont hérités de la phase 3 et sans effet visible ; à nettoyer à l'occasion.
