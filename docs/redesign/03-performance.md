# Performance — mesures et corrections (26 octobre 2026)

Méthode : build de production (`next build` + `next start -p 3001`), Playwright + CDP, réseau émulé 4G lente
(1,6 Mb/s, 150 ms), CPU ×4 sur les pages élève (390×844, DPR 2), ×1 sur les pages enseignant (1440×900).
Une mesure par page et par série, pas de moyenne : les écarts de ±0,3 s entre deux runs sont du bruit.
Données brutes : `docs/redesign/perf-avant.json`, `docs/redesign/perf-apres.json`.

## Ce qui a été trouvé

1. **Polices** : une feuille Google Fonts bloquante dans le layout racine chargeait Fredoka One, Caveat (3 graisses),
   Cairo (5 graisses) et Noto Naskh Arabic (4 graisses) sur toutes les routes, en plus des polices next/font.
   309 à 420 Ko et 8 à 11 fichiers par page.
2. **Images** : les photos des leçons sont stockées en pleine taille sur R2 (3,3 Mo, 2,9 Mo…) et servies telles
   quelles dans des vignettes de 112 px ; aucun `cache-control` côté bucket. Les réponses des quiz et l'image du
   cours en direct chargeaient le même original.
3. **CLS** : 0,24 sur la leçon élève (l'en-tête arrivait après le squelette), 0,197 sur le tableau de bord
   (le tableau de progression bien plus haut que son squelette).
4. **JS** : la leçon élève embarquait la scène du cours en direct (framer-motion, tracés, sons) même sans bloc
   « Lettres ».

## Ce qui a été fait

| Fichier | Changement |
|---|---|
| `src/app/layout.tsx` | plus de `<link>` Google Fonts ni de preconnect ; Caveat par next/font (400, latin, sans préchargement) ; Fredoka réduite à la graisse 700 |
| `src/components/ui/BrandMark.tsx`, shells, pages du site, `globals.css` | « Fredoka One » (retirée de Google Fonts, devenue Fredoka 700) et « Caveat » en dur → variables next/font ; repli « Cairo » retiré |
| `src/app/(platform)/{student,teacher}/layout.tsx` | Noto Naskh Arabic : graisse 400 seulement (500 n'était utilisée nulle part) |
| `src/components/auth/authFonts.ts` | les pages de compte ne chargent plus Noto Naskh (aucun texte arabe) |
| `next.config.ts` | `images.remotePatterns` : `*.r2.dev` et `R2_PUBLIC_BASE_URL` ; AVIF/WebP ; cache 30 jours ; qualités 70/75 |
| `src/components/platform/LessonImage.tsx` (nouveau) | `next/image` avec `sizes`, lazy par défaut, `priority` pour le premier écran, `unoptimized` pour les data/blob URLs de l'éditeur |
| `src/app/(platform)/student/page.tsx` | couvertures via `LessonImage` (7 rem / 45 vw / 20 rem), les trois premières préchargées |
| `src/components/lesson/ExerciseRenderers.tsx` | images de réponse du quiz via `LessonImage` (30 vw / 12 rem) |
| `src/components/lesson/LessonPlayer.tsx` | diapo via `LessonImage` ; `LetterExercise` chargé à la demande (`next/dynamic`) |
| `src/app/(platform)/student/practice/[id]/page.tsx` | idem pour la révision |
| `src/lib/letterExercises.ts`, `LetterExercise.tsx` | la constante de délai vit dans `lib` (sinon l'import annulait le découpage) |
| `src/components/present/Slides.tsx` | image d'un mot via `LessonImage` (≈ 70 vmin) |
| `src/lib/mediaUpload.ts` | `shrinkImage` : les photos > 400 Ko sont réduites à 1 600 px, WebP 82 % (PNG conservé), avant l'envoi vers R2 ; l'original part tel quel si la réduction échoue |
| `src/app/(platform)/student/lesson/[id]/page.tsx` | squelette avec le même en-tête que la leçon (CLS) |
| `src/components/teacher/ProgressWorkspace.tsx` | squelette de 8 lignes, hauteur minimale 26 rem (CLS) |

Vérification de l'optimiseur sur une vraie photo de leçon (3 296 Ko) : `/_next/image?w=384` → 20 Ko (1,5 s la
première fois, le temps de récupérer l'original ; 18 ms ensuite, `max-age` 30 jours) ; `w=828` → 71 Ko.

## Avant / après

| Page | Polices | Octets totaux | LCP | CLS | JS |
|---|---|---|---|---|---|
| `/login` (390, ×4) | 309 Ko · 9 fichiers → **142 Ko · 6** | 534 → **364 Ko** | 3,9 → 3,7 s | 0 → 0 | 178 → 178 Ko |
| `/student` | 309 Ko · 8 → **201 Ko · 8** | 742 → **644 Ko** | 4,9 → **4,4 s** | 0 → 0 | 386 → 397 Ko |
| `/student/lesson/[id]` | 200 → **146 Ko** | 574 → **409 Ko** | 5,3 → **3,3 s** | **0,24 → 0** | 333 → **225 Ko** |
| `/arabic/vocabulary` | 420 Ko · 10 → **319 Ko · 9** | 675 → **579 Ko** | 2,1 → **1,5 s** | 0 → 0 | 206 → 212 Ko |
| `/teacher` (1440, ×1) | 309 → **201 Ko** | 758 → 921 Ko* | 2,7 → **2,3 s** | **0,197 → 0** | 338 → 604 Ko* |
| `/teacher/create?edit=` | 400 → **292 Ko** | 909 → 956 Ko* | 4,4 → 3,9 s | 0 → 0 | 418 → 509 Ko* |
| `/teacher/present` | 309 → **201 Ko** | 1 052 → 965 Ko | 1,1 → 1,0 s | 0,006 → 0,006 | 637 → 661 Ko |

\* Les octets JS comptent aussi les routes préchargées par `next/link` (tableau de bord → éditeur, classes, cours),
et la seconde série attendait 7 s au lieu de 4 s avant de compter : ces colonnes ne sont pas comparables sur le
tableau de bord et l'éditeur. Les images des couvertures n'apparaissent pas dans les octets de `/student` sur
4G émulée : leur première génération côté serveur dépasse la fenêtre de mesure (voir la vérification directe ci-dessus).

Ce que le LCP mesure ici : ces pages se rendent côté client après un appel `/api` ; le plus grand élément est un
paragraphe qui attend l'hydratation puis les données. Sur CPU ×4, c'est le temps d'exécution du JS qui domine, pas
les octets. Le gain réel sur une vraie 4G viendra surtout des images (3 Mo → 20–70 Ko par photo) et des polices.

## Contrôles

- `npx tsc --noEmit` : 0 erreur · `npm test` : 170/170 · `npm run build` : réussi (45 pages).
- `npx eslint` sur les fichiers touchés : 0 erreur, 1 avertissement préexistant (`ExerciseRenderers.tsx:248`, setState dans un effet).
- Captures de contrôle après la passe (accueil, présentateur, connexion) dans `docs/redesign/after/`.

## À vérifier au déploiement

- **Netlify Image CDN** : le runtime Next v5 de Netlify sert `next/image` par son CDN et reprend `remotePatterns`.
  Après déploiement, ouvrir une couverture de leçon et vérifier que l'URL `/_next/image?url=…` répond en 200 et en
  WebP/AVIF. Si le domaine R2 n'était pas accepté, ajouter `[images] remote_images = ["https://<domaine-r2>/.*"]` dans `netlify.toml`.
- `R2_PUBLIC_BASE_URL` doit être présent dans les variables de build Netlify (il l'est déjà pour l'API).
- Les anciennes photos restent en pleine taille dans le bucket (l'optimiseur les redimensionne à la volée) ; les
  nouvelles partent réduites depuis le navigateur. Un `cache-control` sur le bucket R2 (ex. `public, max-age=31536000, immutable`)
  éviterait à l'optimiseur de re-télécharger les originaux.

## Non fait, et pourquoi

- **Rendu serveur des données** (accueil élève, tableau de bord) : c'est ce qui ferait tomber le LCP sous 2,5 s sur
  CPU lent, mais cela change l'architecture des pages (client → serveur) ; hors de cette passe.
- **Découpage du présentateur** (661 Ko JS) : l'écran de lancement et la séance sont dans le même fichier ; un
  `next/dynamic` demande d'extraire la séance dans son composant. À faire dans une passe dédiée.
- **Suivi des Web Vitals en production** : aucun point de collecte n'existe (ni analytics, ni table). À brancher
  si l'ASBL le souhaite (`web-vitals` + une route `/api/vitals`).
- **Service worker** : inutile pour une plateforme authentifiée dont les données changent à chaque cours ; Netlify
  sert déjà les assets `/_next/static` en immutable, compressés (brotli).
- `react-dnd` et `react-dnd-html5-backend` ne sont importés nulle part : à retirer de `package.json` quand vous voudrez
  (sans effet sur le bundle, qui ne les inclut pas).
