# Monte & Souris — platform redesign brief for Claude Code

## How to use this brief

Place this file at `docs/monte-souris-redesign.md` in the existing repository. Extract the supplied screenshots into `docs/reference-screenshots/`, retaining their original filenames and folders. The accompanying `monte-souris.tokens.css` defines proposed values; adapt its integration to the installed Tailwind version rather than replacing the project's configuration.

This is an implementation specification and set of responsive wireframe blueprints, not a claim that the application has already been redesigned or tested. No application source code was supplied for this audit. Repository discovery must therefore precede changes. Screenshot filenames are evidence references, not assumed application routes.

## 1. Mission and boundaries

Redesign the existing authenticated learning platform, not the public marketing website.

Monte & Souris is a Brussels non-profit offering live, small-group language classes for children aged 4 and above, with a maximum of six children per group. Its approach is Montessori-inspired; the teacher is Montessori-certified and trained in neurodiversity. The platform includes independent practice between classes.

Create one coherent brand with two levels of expression:
- Teacher: an efficient, composed professional workspace.
- Student: a warm, visually meaningful learning space for children aged 4–10, often using a tablet.

Preserve the existing name and original logo asset, including its bars and small mouse. Do not reconstruct the logo using text, icons or a new mascot. All interface copy is French. Preserve authored Arabic learning content.

Do not change database schemas, authentication, permissions, public routes, lesson identifiers, exercise scoring, attempt history, recording storage, class membership, or real-time/video integration simply to fit a mockup. Do not replace real data with demo metrics. Keep demo fixtures isolated from production.

Do not upgrade Next.js or Tailwind for this redesign. Inspect installed versions and use their existing conventions. Preserve working components and accessible primitives where possible.

## 2. What the screenshots actually show

The supplied archive contains 178 PNG captures: 24 teacher, 85 student, 63 live-class, and 6 authentication captures. They include variants and before/after exercise states.

### Teacher area

| Evidence | Observation | Redesign decision |
|---|---|---|
| `2-espace-enseignant/desktop/teacher.png` | Two large empty request panels and teacher-role administration appear before lessons and progress. Occasional administration dominates daily work. | Put teaching and follow-up first. Combine requests into a compact actionable inbox. Move role management into an admin-only team destination. |
| Same dashboard | Section after section uses a similar white rounded panel with comparable visual weight. This flattens hierarchy. | Use a persistent navigation shell, a concise action area, and one primary progress workspace. Do not replace the old stack with a new stack of identically styled cards. |
| `teacher_progression-ouverte.png` | Useful detail exists: lesson progress, current errors, earlier errors, wrong-answer thumbnails and last activity. Tiny, low-emphasis text makes this harder to scan. | Preserve every field. Use a student summary table plus a selected-student detail area. Separate latest attempt from earlier attempts explicitly. |
| Teacher mobile dashboard captures | The action cluster extends beyond the narrow content column; the table is cut off. The two dashboard PNGs are 1,020 raster pixels wide while most other mobile captures are 780. | Treat this as a responsive overflow investigation. The capture is consistent with overflow, but screenshot pixels alone do not establish device pixel ratio or CSS viewport size. Verify in the browser. Do not conceal defects with global `overflow-x: hidden`. |
| `teacher_create-edition-les-fruits.png` | The desktop fruit editor is 8,774 pixels tall. All repeated blocks are expanded in a narrow central column. | Replace the long form with an activity outline, one selected activity editor and a learner preview. Preserve all blocks and ordering. |
| `teacher_create.png` and edit variants | Save appears at the top, publish/save again at the bottom, and slideshow generation is a separate operation. The workflow is visually fragmented. | Give save, preview, publication and presentation-generation distinct labels and states in a stable toolbar. Do not conflate saving with publishing. |
| Builder block picker | Pastel orange, blue, purple and green outlines introduce a second visual language. Very pale controls are difficult to distinguish. | Use the moss/neutral system. Distinguish activity types through labels and icons, not a rainbow of outlines. |
| `teacher_letters.png`, `teacher_arabic.png` | Many repeated recording panels, small icon-only controls, and long help sections. | Use an audio-library workspace with tabs, search, recording-status filters and compact rows. Put recording controls in an expanded row or detail panel. |
| `teacher_present.png` | Presentation selection and class selection are followed by a long, visually prominent instruction manual. | Make the launch task primary. Move help into a “Guide de séance” disclosure. Keep useful contextual guidance near its relevant control. |
| `4-cours-en-direct/*enseignant.png` | The shared stage is calm, but progress uses many tiny dots, the toolbar is thin, and the sound-activation prompt can compete with the exercise heading. | Separate the stage, participant rail and teacher toolbar. Show “Activité 4 sur 12” rather than a long dot chain. Give controls comfortable targets and clear labels. |
| Live screenshots | Bright-green video tiles appear to be test/capture media. | Do not diagnose these as an intentional colour decision. Verify actual provider states; design camera-off, connecting and permission-denied placeholders. Never tint or replace real video to match the palette. |

### Student area

| Evidence | Observation | Redesign decision |
|---|---|---|
| `student_avec-lecons.png` | A large slate welcome banner is followed by near-identical horizontal lesson rows. It feels like a generic portal rather than a learning space. | Give the child a clear next action and recognisable lesson covers. Use a calm greeting rather than a marketing-style hero. |
| Same screen | Lesson emoji do not consistently represent the lesson subject; action buttons change colour without an evident meaning. | Use the actual lesson's photo, letter or approved illustration. Keep action colour consistent. |
| Same screen | Some letter lessons show “0 exercice”. | Inspect the counting logic. Letter blocks may be playable without being counted by the current summary. Do not hide valid lessons or invent counts; correct the displayed definition using existing lesson data. |
| `lecon-les-fruits-01.png` | The task occupies a small island in a large empty page. The audio button is visually tiny compared with its container. | Use an intentionally sized activity stage with a prominent listen action and answer tiles. Whitespace should frame the task, not push it far down the screen. |
| Letter exercises | Large Arabic glyphs and limited choices are a good foundation. Some phonetic distinctions are communicated only through subtle border colours or fading. | Preserve large glyphs. Add explicit selection/success feedback and accessible state labels. Do not reduce child controls to teacher sizing. |
| `arabic_reading.png`, `arabic_vocabulary.png` | Rainbow pastels and a gradient background diverge from the core natural palette. | Bring these screens into the shared warm-white, cream and moss language. Retain colour only when it has an intentional pedagogical role. |
| `student_live.png` | The waiting screen is a centred icon and paragraph with little reassurance or useful next action. | Show a stable waiting state, what happens next, and “Retour à mes leçons”. Never invent a start time or imply the teacher is preparing if that is unknown. |
| Revision/completion captures | “Tableau de bord” is an adult-facing label; celebratory imagery and feedback vary. | Use “Mes leçons”, “Tu as terminé” and “Tu peux revenir quand tu veux.” Keep success feedback quiet and consistent. |
| Across exercises | Photography, emoji and character illustrations coexist with different cropping and treatment. | Standardise framing and cover assets, but preserve valid instructional imagery and the meaning of gestures. Do not replace teaching content merely for decoration. |

### Shared observations and limits

Fredoka makes professional headings feel too playful. Heavy shadows and frequent rounded pills reduce differentiation between navigation, actions and statuses. Pale helper text deserves contrast checks. These are visual findings, not proof of keyboard or screen-reader failures: hover, focus, loading, error handling, persistence and live synchronisation cannot be verified from static captures.

Authentication should inherit the mature shared typography and accessible field styles. Keep role selection and existing account flows intact. Never enlarge the project into a new identity system.

## 3. Art direction options and recommendation

### A — L'atelier Montessori: recommended foundation

Moodboard: warm paper, quiet shelving, botanical specimens, carefully labelled learning materials, soft moss, restrained blush, generous margins. Not rustic decoration, not wood textures.

Reference qualities: Lovevery's deliberate presentation of learning materials; Linear's clear work organisation. These are quality references, not layouts to copy.

Teacher expression: light navigation, crisp type, compact data, fine rules.
Student expression: generous touch surfaces, recognisable objects, restrained illustration.
Risk to avoid: “premium” must not become excessively beige, faint or empty.

### B — Le carnet pédagogique

Moodboard: an educator's beautifully organised notebook, orderly sections, editorial typography, purposeful annotations and neat activity sequences.

Reference quality: Craft's structured block-based documents and progressive disclosure.
Strongest application: the lesson builder and lesson overview.
Risk to avoid: using a document metaphor everywhere or making the child experience text-heavy.

### C — Le petit atelier d'exploration

Moodboard: picture-book covers, tactile-looking answer tiles, a small mouse companion, clear object silhouettes, gentle paper-cut forms.

Reference quality: Lovevery's object-led visual communication.
Strongest application: student home, empty states and completion.
Risk to avoid: mascots on every screen, sticker clutter, reward economies or decorative movement during a task.

### Final recommendation

Use A as the overall direction, B for authoring structure, and C sparingly for the student experience. Shared palette, logo, icon language and spacing connect the areas. Typography, density, control size and a restrained illustration layer distinguish them.

The core design rule: professional precision for the adult; calm, concrete choices for the child.

## 4. Design system

### 4.1 Colour roles

Use semantic tokens rather than arbitrary palette choices.

| Token | Hex | Role |
|---|---|---|
| `canvas` | `#F5EEE8` | Main application background; retained cream |
| `surface` | `#FFFDF8` | Panels, fields and learning tiles |
| `surface-muted` | `#EDE5D8` | Neutral grouping, secondary surfaces |
| `ink` | `#2A2B27` | Primary text and learning glyphs |
| `text-muted` | `#65675E` | Secondary text; not faint placeholder grey |
| `line` | `#DAD3C7` | Decorative separators only |
| `control-border` | `#858878` | Essential field and unselected-control boundaries |
| `primary` | `#59634C` | One strong moss-derived action colour |
| `primary-hover` | `#4D5741` | Hover |
| `primary-pressed` | `#414B36` | Pressed |
| `primary-soft` | `#E9EDDF` | Selected navigation, success backgrounds |
| `brand-moss` | `#6B705C` | Retained supporting brand colour |
| `sage` | `#999B84` | Decorative or non-text support |
| `blush` | `#BB908E` | Illustration accent, not white-label action fill |
| `petal` | `#CCB9B5` | Illustration accent |
| `blush-soft` | `#F3E7E4` | Gentle illustration background |
| `slate` | `#8BA3B1` | Illustration and nonessential accent |
| `stone` | `#7B868E` | Nonessential brand support; validate any text use |
| `info` / `info-soft` | `#445B66` / `#EAF0F2` | Informational messages |
| `review` / `review-soft` | `#865337` / `#F5EADD` | “À revoir”, warm rather than alarming |
| `danger` / `danger-soft` | `#984F47` / `#F9EEEB` | Validation, failed requests, destructive actions |

Calculated solid-colour contrast ratios, using the WCAG sRGB formula:
- Ink on cream: 12.41:1.
- Muted text on cream: 5.00:1; on sand: 4.60:1.
- Warm white on primary: 6.23:1.
- Primary on primary-soft: 5.32:1.
- Review text on review-soft: 5.35:1.
- Danger text on danger-soft: 5.21:1.
- Info text on info-soft: 6.22:1.
- Control border against cream: 3.16:1; against warm white: 3.57:1.

For comparison, warm-white labels on the supplied slate, blush and sage colours calculate to approximately 2.59:1, 2.76:1 and 2.80:1. Do not use those pairs for ordinary button labels. These calculations are token checks, not certification of every existing screenshot.

Normal text must reach 4.5:1; qualifying large text 3:1. Essential control and state graphics must reach 3:1 against adjacent colours. A low-contrast decorative rule is acceptable only when it is not the sole means of identifying a control or state. Test actual combinations, opacity and overlays in the browser.

### 4.2 Typography

Teacher: **DM Sans**, weights 400, 500, 600, 700.
Student: **Nunito**, weights 400, 600, 700, 800; retain this existing family but give it a clear home.
Arabic learning content: **Noto Naskh Arabic**, normally 400 or 500. Validate glyphs and vocalisation with the teacher before rollout.

Remove Fredoka from application headings; leave the supplied logo untouched. Do not add a fourth editorial display family.

| Use | Size / line height | Weight |
|---|---|---|
| Teacher page title, desktop | `2rem / 2.5rem` | 600 |
| Teacher page title, narrow | `1.75rem / 2.25rem` | 600 |
| Teacher section heading | `1.25rem / 1.75rem` | 600 |
| Teacher standard body | `1rem / 1.5rem` | 400 |
| Teacher navigation and buttons | `0.9375rem / 1.375rem` | 600 |
| Teacher dense table text | `0.875rem / 1.25rem` | 400–500 |
| Teacher label/status | `0.875rem / 1.25rem` | 600 |
| Secondary metadata, sparingly | `0.8125rem / 1.125rem` | 400–500 |
| Student page heading | `2rem / 2.5rem` | 800 |
| Student lesson title | `1.5rem / 2rem` | 800 |
| Student instruction, desktop/tablet | `1.5rem / 2rem` | 700 |
| Student instruction, narrow | `1.25rem / 1.75rem` | 700 |
| Student body/button | `1.125rem / 1.75rem` | 600–700 |
| Arabic short instruction | `1.75rem / 1.75` | 400–500 |
| Arabic word | `clamp(3rem, 7vw, 6rem) / 1.75` | 400–500 |
| Arabic isolated learning letter | `clamp(4rem, 10vw, 9rem) / 1.5` | 400–500 |

Latin headings may use `letter-spacing: -0.02em`; body uses normal tracking.
Arabic uses normal/zero tracking, no uppercase transforms, no artificial character spacing and no clipping of vowel marks. Do not apply Latin typography utilities blindly to Arabic.

Use tabular numerals for teacher counts and time values. Keep instructional counts textually explicit.

Load fonts using the project's existing `next/font` conventions, scoped to the relevant route layouts where possible. Do not add runtime font-CDN requests. Verify the installed version's supported font options and subsets. Keep tracing assets independent of text-font replacement until their geometry is validated.

### 4.3 Spacing, sizing, radii and shadows

Spacing scale in rem:
`0`, `0.25`, `0.5`, `0.75`, `1`, `1.5`, `2`, `2.5`, `3`, `4`.
This corresponds to 0, 4, 8, 12, 16, 24, 32, 40, 48 and 64 pixels at the default 16-pixel root. Do not force a fixed root font size that defeats user preferences.

Desktop content padding: `2rem`. Tablet: `1.5rem`. Mobile: `1rem`.
Teacher sidebar: `15rem`; header: minimum `4.5rem`.
Teacher content maximum: `80rem`; student content maximum: `66rem`; exercise stage maximum: `52rem`.

Teacher targets: at least `2.75rem` (44px) in both dimensions; standard form/button height `3rem` (48px).
Student interactive targets: at least `4rem` (64px) in both dimensions, including back, audio and media controls.
Student answer tiles: at least `6.5rem` (104px) square where three choices share a 390px-wide screen. Let text-rich answers grow.
Use `min-height`, not rigid heights, for controls with wrapping labels.

Radii:
- Teacher controls: `0.75rem` (12px).
- Teacher panels: `1rem` (16px).
- Dialogs: `1.25rem` (20px).
- Student buttons: `1rem` (16px).
- Student answer tiles: `1.25rem` (20px).
- Student lesson panels: `1.5rem` (24px).
- Fully rounded shapes only for small status pills and intentional circular controls.

Shadows:
- Default teacher panels: none; use surface and a subtle decorative border.
- Raised control: `0 1px 2px rgba(42,43,39,0.06)`.
- Student lesson tile: `0 4px 16px rgba(42,43,39,0.05)`.
- Dialog: `0 16px 48px rgba(42,43,39,0.14)`.

Whitespace is generous between groups, tighter within groups. Avoid both giant dead zones and unnecessary 32px padding inside every table row.

### 4.4 Icons and illustrations

Use one existing outline icon family. If the project has no consistent set, use Lucide with a 1.75px stroke on a 24px grid. Teacher icons: 20–24px; student icons: 28–32px, inside 64px targets. Icons supplement labels; important actions must not rely on unfamiliar icons alone.

No emoji as the main visual identity of a lesson. Prefer existing approved lesson imagery over generic replacement art.

Student illustrations: simple, warm, lightly textured or flat shapes; consistent perspective and clear silhouettes; a restricted brand palette. The mouse appears in welcome, empty and completion states only, derived from the brand asset if rights/source allow. Avoid decorative characters watching or moving during exercises.

Instructional vocabulary imagery must remain unambiguous. Keep meaningful colours, object distinctions and human gestures. Standardise cropping and framing, not the vocabulary itself. Do not crop out a hand, tool, diacritic or other learning-critical detail.

### 4.5 Components

**Buttons.** One primary moss variant, one outlined secondary variant, one quiet text variant and a destructive variant used only for destructive actions. Student buttons use the same roles, larger dimensions and Nunito. Use clear action labels. Avoid several different filled colours for equivalent “Commencer” actions.

**Fields.** Visible label above; 8px label gap; minimum 48px high; 16px horizontal padding; warm-white fill; 1px control-border; 12px radius. Placeholder supplements rather than replaces the label. Helper text and errors are associated with `aria-describedby`. Required status is expressed accessibly, not just with a coloured asterisk. Preserve input after a failed save.

**Badges.** Noninteractive status pills may be compact; clickable filters still require the teacher/student target minimum. Every status has a text label and optional icon, never colour alone.

**Progress statuses.**
- “Réussi du premier coup”: check-circle + primary on primary-soft, only where the stored data supports that meaning.
- “Réussi après plusieurs essais”: check + ink/neutral background; not a failure state.
- “À revoir”: replay/refresh + review on review-soft.
- “En cours”: small progress icon + info on info-soft.
- “Pas commencé”: neutral outline and readable muted text.

Audit the existing calculation first. The screenshots show zero current errors alongside nonzero earlier errors. Do not silently turn “first try in the latest attempt” into “first try ever”. Prefer “Réussi sans erreur” with “Dernière tentative” scope where appropriate. Make “Historique : 6 erreurs précédentes” available in details rather than the ambiguous “+6 avant”.

**Tables.** Semantic table markup, labelled headers, readable 14px text, approximately 56–64px rows, 16px cell padding, sticky header where useful. Counts align consistently; dates have exact accessible values. No heavy zebra striping; use subtle hover/selection. Wrong-answer images need meaningful accessible labels without changing assessment content.

On mobile, show a compact student summary list and drill into a labelled activity-detail list. Do not shrink the entire desktop table or discard mistakes/history. Keep all information reachable.

**Dialogs and drawers.** Reuse tested focus management, Escape handling and focus return. Avoid opening a second modal over the first. On narrow screens, long editing workflows may use a full-height sheet with a reachable close control and safe-area padding.

**Audio recorder.** Explicit states: idle, permission requested, recording with elapsed time, stopped preview, uploading, saved, and error. “Enregistrer” starts capture; “Arrêter” stops; “Écouter” previews; “Remplacer l'audio” clearly signals replacement. Never show success before server confirmation. Preserve a previous recording unless replacement succeeds.

### 4.6 State matrix

| State | Required treatment |
|---|---|
| Default | Accessible colour pair; clear label; stable dimensions. |
| Hover | Primary uses `#4D5741`; secondary uses a quiet neutral fill. Apply only where hover exists. No lift on every panel. |
| Keyboard focus | 3px `#59634C` outline with a 3px offset; ensure surrounding clearance and contrast, including on coloured surfaces. Never remove focus without an equivalent indicator. |
| Pressed | Primary uses `#414B36`; optional 1px downward translation; no layout shift. Student tiles may use scale 0.99, but no bounce or shake. |
| Selected | Moss outline plus a check/label and soft moss fill. Distinguish selection from correctness. Use the appropriate native/ARIA semantics. |
| Disabled/unavailable | Neutral background, readable explanation where relevant. No hover response. Do not disable the only route to learning why an action is unavailable. |
| Loading | Layout-matched static skeletons; reserve image/video space; `aria-busy` on the region. A button uses a stable-width loading label. No long shimmer loops. |
| Empty | Relevant short heading, one sentence and at most one useful action. Do not display several oversized “nothing here” panels. |
| No filter results | Explain the current filter and offer “Effacer les filtres”. Do not use the account's empty state. |
| Validation error | Inline message, icon and text; keep entered values. On submit, focus the error summary or first invalid field as appropriate. |
| Network/save error | Explicit failure and retry; no fake success toast. Keep the work in memory where the existing architecture permits. |
| Disconnected live session | Non-blocking state, recovery action/status, no optimistic “connected” state without confirmation. |
| Success, teacher | Brief inline “Enregistré” only after confirmed persistence. Avoid unnecessary modal success screens. |
| Success, student | “Tu as trouvé.”, a check and a soft tint. Let the child continue without flashing, public ranking or a confetti shower. |
| Retry, student | “Écoute encore. Tu peux réessayer.” Preserve the learning task and its scoring rules. No shaking tile, buzzer or shaming message. |

Motion: hover 140ms, press 80ms, reveal 180ms, gentle success 240ms. Use a single ease-out curve such as `cubic-bezier(0.2,0,0,1)`. Prefer opacity/transform. Respect `prefers-reduced-motion`; avoid autoplay decoration, infinite animation and parallax.

## 5. Responsive screen blueprints

These are wireframe specifications for the required mockups. Implement them using the actual application components, then produce rendered desktop, mobile and tablet screenshots. Do not call a wireframe or an unconnected static page a tested implementation.

Global responsive contract:
- Below 768px: single-column mobile layouts.
- 768–1023px: tablet layouts; navigation in a labelled drawer rather than an icon-only rail.
- 1024px and above: full teacher sidebar where relevant.
- 1280px and above: three-pane lesson editor.
- Stress-test intermediate widths, not just breakpoint endpoints.
- Use `minmax(0, 1fr)` and `min-width: 0` in flexible panels; fix intrinsic overflow at its source.
- No isolated dark navigation or presenter section in an otherwise light interface.

### 5.1 Teacher dashboard, including per-student progress

**Desktop 1440 × 900**

```
+------------------+-----------------------------------------------------------+
| Original logo    | Tableau de bord                     + Créer une leçon    |
|                  | Bonjour, [prénom]                                        |
| Tableau de bord  |-----------------------------------------------------------|
| Classes          | Séance / action utile       | À traiter                  |
| Leçons           | class + lesson + real state | requests + review counts   |
| Progression      | Ouvrir le cours             | compact labelled links     |
| Bibliothèque     |-----------------------------------------------------------|
|   audio          | Progression des élèves     Classe [..] Rechercher [..]   |
|                  | Élève | Avancement | À revoir | Dernière activité | Voir  |
| Administration*  | ... current real student records ...                      |
| Aide / compte    |-----------------------------------------------------------|
|                  | Détail de l'élève sélectionné                             |
|                  | Leçon [..]  Dernière tentative / Historique                |
|                  | Exercice | Statut | Erreurs | Réponses choisies | Activité |
+------------------+-----------------------------------------------------------+
* visible only to authorised roles
```

The top work area must be compact enough for the progress section to begin in the first desktop viewport. Target approximately 320–400px for header + top content, but let text zoom reflow naturally. The progress section itself must not be forced to a fixed height.

Do not invent a calendar or upcoming lesson. If scheduling data does not exist, use “Préparer une séance” with the existing class/lesson selection. Counts must come from the existing data model.

Combine family and student-account requests into one compact request summary, with separate labelled categories. Distinguish an empty inbox from a failed request load. Move teacher-role management to an admin-only destination, retaining server-side authorisation.

Keep class filtering, student search and “À revoir” filtering near the progress table. Default to neutral ordering; allow “À revoir” as a deliberate filter rather than publicly ranking children.

**Mobile 390 × 844**

Header: original logo, 44px “Menu” control, account menu. Then title and one main teaching action. Compact request summary. Then class filter and student list. Each row shows name, actual completion, review count and last activity with “Voir le suivi”. Selecting a student opens a full-width detail page or accessible sheet with activity rows and labelled error/history fields.

At 390px there must be no horizontal document scrolling and no four-button cluster forced onto one row.

**Tablet**

At 768px use a full-width main area and drawer navigation; show the summary list or a deliberately reduced-column table, with details below. At 1024px a full table may be appropriate. Do not bury progress below expanded administration.

### 5.2 Lesson builder

**Desktop 1440 × 900**

```
+-------------------------------------------------------------------------+
| Retour aux leçons | Les fruits | Brouillon | Enregistrer | Aperçu | Publier |
+-------------------+-------------------------------+---------------------+
| PLAN DE LA LEÇON  | ACTIVITÉ SÉLECTIONNÉE         | APERÇU ÉLÈVE        |
| Titre / classe    | Type + title                  | same renderer as    |
| 1. ...           | Instruction / authored audio  | the real learner    |
| 2. ... selected  | Choices + correct response    | experience          |
| 3. ...           | Relevant options only         |                     |
| ...              |                               | Audio preview        |
| + Une activité   | Duplicate / move / delete     |                     |
+-------------------+-------------------------------+---------------------+
```

Focused workspace rather than an endlessly scrolling form. At ≥1280px use outline `16rem`, editor `minmax(28rem,1fr)`, preview `22rem`, with `1.5rem` gaps and `2rem` outer padding. Drop or reduce the global sidebar inside this focused editor if needed; retain a clear return route.

Only the selected block is expanded. All original activity types remain available: video, letters, illustrated lesson, multiple choice, matching, drag-and-drop, word ordering. One “Ajouter une activité” picker, using consistent icons and labels, replaces the rainbow panel.

Reordering must work with explicit up/down controls as well as drag. Preserve focus and unsaved state when changing blocks.

Use the actual student exercise renderer in a safe preview mode: do not record attempts, send live events, or mutate lesson progress during preview. Audio must be manually playable.

Use explicit save if that is the existing persistence model. Do not claim autosave without implementing reliable confirmation, failure and conflict handling. Publish and slideshow generation remain separate operations if that is how the platform works. Show stale/out-of-date presentation state if the data can establish it; do not invent automatic regeneration.

**Mobile 390 × 844**

Sticky two-line header with return, concise title and save status. A labelled switcher: “Plan”, “Activité”, “Aperçu”. One pane at a time. Large form controls; choice cards may stack. Keep save/publish reachable without forcing a journey to the bottom of a multi-screen form. A bottom action area must include safe-area padding and must not cover fields or error messages when the virtual keyboard appears.

**Tablet**

At 768–1023px show outline via a drawer and editor as the main area; preview in a separate tab. At 1024–1279px use outline + editor, with preview opened on demand. Do not squeeze three full panels into tablet portrait.

### 5.3 Live-class presenter

**Desktop 1440 × 900**

```
+------------------------------------------------------------------------+
| Cours en direct · [classe]   Connexion réelle      Activité 4 sur 12     |
+----------------------------------------------------+-------------------+
|                                                    | PARTICIPANTS      |
|                                                    | teacher + up to   |
|             SHARED LEARNING STAGE                  | six children      |
|       large letter / word / images / answers       |                   |
|                                                    | PRIVATE FOLLOW-UP |
|                                                    | response summary  |
+----------------------------------------------------+-------------------+
| Précédent | Suivant | [context action] | Micro | Caméra | ... | Terminer |
+------------------------------------------------------------------------+
```

Use a light background throughout. Stage `minmax(0,1fr)` plus an approximately `18rem` participant rail. Header minimum 64px and toolbar minimum 80px; allow wrapping/height growth under zoom. Use `min-height: 100dvh`, not a fragile fixed screen height.

Allow one teacher plus up to six children, not six participants total. Participants should not cover exercise content. Teacher-only answers, mistakes and moderation controls must never enter the student stage or student-authorised data.

Use a short current-activity label rather than 30 tiny dots. Reveal secondary activity navigation in an accessible panel. Keep existing exercise progression and teacher-controlled reveal behaviour intact.

Move sound activation into a predictable preflight/control location. Honour browser user-gesture and device-permission requirements; never claim a microphone or camera is enabled before confirmation. Add explicit camera-off, permission-denied, reconnecting and unavailable states using the existing media provider.

Preserve keyboard shortcuts where safe, but never capture arrows or Space while typing in fields. Ending a session is visually separated and confirmed.

**Mobile 390 × 844**

Stage first. Compact participant strip or labelled “Participants” sheet. “Précédent” and “Suivant” remain visible in a wrapping bottom control area with ≥44px teacher targets. Media controls move to a second row or a clear “Commandes” sheet. No all-in-one toolbar shrunk to unreadable icons.

**Tablet**

Landscape: stage and compact participant rail. Portrait: stage above a bounded participant strip. Keep controls out of the answer area. Test with seven participants, not just the two shown in capture fixtures.

**Student live companion**

Use the student target sizes and the same lesson stage. A teacher video tile and discreet self-view must not block answers. Do not expose teacher response summaries. The waiting state says “Le cours n'a pas encore commencé.” and offers “Retour à mes leçons”. Preserve the actual joining/synchronisation mechanism; no invented video provider migration.

### 5.4 Student home

**Desktop 1440 × 900**

```
+------------------------------------------------------------------------+
| Original logo                                              Mon compte |
+------------------------------------------------------------------------+
| Bonjour, [prénom]                    small, optional brand illustration |
|                                                                        |
| [LIVE ONLY: Le cours a commencé          Rejoindre le cours]            |
|                                                                        |
| À continuer                                                            |
| [meaningful lesson cover] [lesson title] [real progress] [Continuer]     |
|                                                                        |
| Mes leçons                                                             |
| [letter cover]        [fruit cover]       [vegetable cover]              |
| title / real state    title / real state  title / real state            |
+------------------------------------------------------------------------+
```

Replace the large slate hero with a warm greeting. Make lesson identity concrete: a large letter, an approved fruit photo, or an appropriate existing illustration. Do not invent new instructional content.

Only show a resume panel if resumable progress is actually available. Otherwise lead with “Choisis une leçon”. When class is live, joining it becomes the strongest action. When class is not live, do not make a misleading join button the strongest action.

A known upcoming time may be displayed only if the backend provides it. Otherwise use an honest inactive-class message and retain a useful learning action.

Grid: three lesson columns on wide desktop, two on tablet, one generous column on 390px mobile. A lesson tile may use a horizontal composition on mobile to conserve height. Use 24px radius, restrained image framing and 64px controls. Do not show an entire alphabet or every exercise directly on the home screen.

**Mobile 390 × 844**

64px-accessible header controls, greeting, real live-class state, the next lesson action, then the lesson list. Aim to reveal the first useful learning action without a large decorative hero. No colour-cycling “Commencer” buttons. Avoid nested button/link interactions inside a fully clickable tile.

**Tablet**

Use 24px page padding and a two-column lesson grid. Keep touch targets at 64px even though more space is available. No hover-only controls.

### 5.5 Student Arabic reading exercise

Use an existing letter-recognition exercise as the reference; example Arabic glyphs below illustrate layout, not a new authored lesson.

**Desktop/tablet**

```
+------------------------------------------------------------------------+
| ← Mes leçons                             Activité 2 sur 6              |
+------------------------------------------------------------------------+
|                       Écoute, puis touche la lettre.                    |
|                              [ Écouter ]                               |
|                                                                        |
|                    [  ب  ]   [  ت  ]   [  ث  ]                          |
|                                                                        |
|                    reserved, quiet feedback area                       |
|                          [ Continuer, when relevant ]                  |
+------------------------------------------------------------------------+
```

One objective, one prominent listening action, three large answer tiles, and one feedback area. Do not reveal the correct target as a visual answer when the task assesses listening. Any example answer order must be derived from the existing exercise logic.

French instructions remain in the French shell. Arabic content uses `lang="ar"` and a scoped `dir="rtl"` container. Keep the answer's logical order and scoring mapping correct; do not double-reverse arrays and CSS layout.

Use a stage max-width of 52rem. Answer tiles can be 10–12rem on desktop and at least 6.5rem on mobile. For three narrow-screen choices use `repeat(3,minmax(0,1fr))`, a 0.75rem gap, 1rem side padding, and minimum content width rules appropriate to the glyph. Long word answers may require another layout; never shrink text or crop diacritics to fit.

**Mobile 390 × 844**

64px back/audio/continue targets. Instruction near the upper part of the task, not after hundreds of empty pixels. Three answer tiles fit within the viewport. Allow natural scrolling at enlarged text sizes rather than fixing the stage height and clipping content.

**Arabic and pedagogical regression requirements**

Use normal Unicode text, not manually reversed strings. Use `<bdi lang="ar" dir="rtl">` for isolated inline Arabic in French labels; use structural `dir="rtl"` for an Arabic exercise region. Prefer logical spacing properties.

Do not split a joined Arabic word into unrelated spans if that breaks shaping. Preserve authored vowel marks and deliberate initial/medial/final letter forms. Do not normalise away content distinctions. Validate at least ب / ت / ث, initial/medial/final forms of م, and vocalised existing words with the teacher.

The original letter-tracing paths, direction, start points and hit testing must remain unchanged unless separately validated. A new font's outline is not a safe automatic replacement for a teaching path.

Alternative access must not accidentally reveal the correct answer. Provide accessible option identification and authored equivalent learning paths where required; do not claim a screenshot-level redesign alone establishes full accessibility for listening or tracing assessments.

## 6. French microcopy

Use sentence case. Be precise about system states, warm without hype, and sparing with exclamation marks.

| Context | Proposed copy |
|---|---|
| Teacher main title | “Tableau de bord” |
| Teacher greeting | “Bonjour, [prénom]” |
| Teacher progress | “Progression des élèves” |
| Follow-up filter | “À revoir” |
| Family requests | “Inscriptions des familles” |
| Student account approvals | “Comptes élèves à valider” |
| Empty request inbox | “Aucune demande en attente.” |
| Empty class list | “Votre première classe” / “Créez une classe pour y regrouper vos élèves.” / “Créer une classe” |
| Empty lesson library | “Préparez votre première leçon” / “Ajoutez une activité, puis associez la leçon à une classe.” / “Créer une leçon” |
| Empty progress | “Les progrès apparaîtront ici” / “Les premières activités réalisées par vos élèves alimenteront ce suivi.” |
| No filtered students | “Aucun élève ne correspond à ces filtres.” / “Effacer les filtres” |
| Add builder block | “Ajouter une activité” |
| Builder preview | “Voir comme un élève” |
| Save draft | “Enregistrer le brouillon” |
| Saving | “Enregistrement…” |
| Save success | “Enregistré” |
| Save failed | “L'enregistrement a échoué. Vos modifications sont toujours affichées.” / “Réessayer” |
| Publish | “Publier la leçon” |
| End live session | “Terminer le cours” |
| End confirmation | “Terminer le cours pour toute la classe ?” / “Rester dans le cours” / “Terminer le cours” |
| Audio missing | “Aucun audio enregistré” / “Enregistrer le son” |
| Microphone permission | “Autorisez le microphone dans votre navigateur pour enregistrer.” |
| Child home | “Bonjour, [prénom]” / “Choisis une leçon” |
| Resume | “Continuer” |
| First attempt | “Commencer” |
| Live available | “Le cours a commencé” / “Rejoindre le cours” |
| Live not started | “Le cours n'a pas encore commencé.” / “Retour à mes leçons” |
| Child empty lessons | “Tes leçons apparaîtront ici.” |
| Listen | “Écouter” / “Réécouter” |
| Letter instruction | “Écoute, puis touche la lettre.” |
| Vocabulary instruction | “Écoute, puis touche la bonne image.” |
| Gentle retry | “Écoute encore. Tu peux réessayer.” |
| Success | “Tu as trouvé.” |
| Completion | “Tu as terminé” / “Tu peux revenir quand tu veux.” |
| Exit exercise | “Retour à mes leçons” |
| Audio playback failure | “Le son n'a pas pu démarrer.” / “Réessayer” |

Do not promise “Tes réponses sont enregistrées” unless persistence has been confirmed. Do not announce a scheduled start or teacher presence that the application cannot establish. Voice prompts must use the approved pedagogy and real recordings; do not replace phonemes with generic text-to-speech without teacher review.

## 7. Implementation sequence for Claude Code

### Phase 0 — Discover and protect

Inspect package versions, app/pages routing, layouts, design primitives, styling, authentication, role checks, data loading, lessons, attempts, recordings and live-class state. Identify which screenshot maps to which actual route/component. Report filenames before making changes.

Run the project's existing baseline checks. Record pre-existing failures separately. Capture representative baseline screens using seeded or anonymised fixtures, not real child personal data.

Create a non-destructive plan and work in reviewable changes. Do not discard unrelated local changes. Do not delete functioning features to improve screenshots.

### Phase 1 — Tokens and teacher dashboard

Integrate the semantic tokens into the installed Tailwind version. Build shared buttons, fields, badges, focus styles, empty/loading states and the teacher shell. Redesign the teacher dashboard and progress detail first.

Verify the complete page at 1440 × 900, 390 × 844, 768 × 1024 and 1180 × 820. Confirm the mobile overflow issue is resolved. Keep production data, auth and all progress fields working.

### Phase 2 — Student shell and one real Arabic exercise

Build student home and one actual letter-recognition exercise using the shared tokens and child sizing. Compare Arabic shaping, recordings, answers, attempts and completion against the existing implementation. Preserve trace geometry in separate exercises.

### Phase 3 — Lesson authoring

Refactor the builder into outline/editor/preview without changing the lesson schema. Preview must use the existing student rendering logic without saving attempts or joining a live session. Verify create, edit, reorder, duplicate, delete, save, publish and presentation-generation workflows.

### Phase 4 — Presenter and remaining screens

Redesign the presenter around the existing live architecture, then bring classes, audio libraries, authentication, waiting states, vocabulary and completion into the same system. Test real permissions, reconnection and class access.

Finish each phase with screenshots, tests and an honest list of limitations. Do not report that an unrun test passed. If screenshots cannot be captured in the environment, report that explicitly and provide exact manual verification steps.

## 8. Acceptance criteria

### Visual and responsive

- All five required screens have desktop and mobile renders, plus tablet verification.
- No horizontal document overflow at 390px; also stress-test 320px and intermediate widths.
- No clipped controls, overlapping labels, missing Arabic vowel marks or fixed bars covering focused content.
- No rainbow action buttons, large unrelated emoji, default-gradient panels, dark sidebar islands, generic metric-card grids or heavy card shadows.
- Original logo and valid teaching imagery are preserved.
- Meaningful information appears before decorative or occasional administration.
- Teacher data remains dense enough to scan; student controls remain large enough to use.
- True empty, loading, error, selected and success states exist; not just the ideal populated screenshot.

### Functional

- Enrolment/account approvals and teacher-role management remain authorised server-side.
- Class membership and the six-child group limit retain their existing rules.
- Lesson save and publish preserve original semantics.
- Progress retains current mistakes, wrong answers, earlier history and last activity.
- Filtered totals and “first try” labels are traceable to the actual data model.
- Letter lessons do not incorrectly display zero playable activities.
- Preview never writes learner progress or emits real classroom events.
- Recordings retain permissions, playback, upload and replacement behaviour.
- Live stage, participant state, teacher controls and student synchronisation still work.
- No private answers, progress data or staff-only actions are exposed to students.

### Accessibility

WCAG 2.2 AA is the target, not a claim achieved by choosing colours alone.
- Normal text ≥4.5:1; qualifying large text ≥3:1; essential control/state graphics ≥3:1.
- Project targets are stricter than the WCAG 2.2 AA size minimum: at least 44px for teacher controls and 64px for student controls.
- Visible keyboard focus, logical tab order, labelled controls and correct dialog focus behaviour.
- No hover-only instructions or drag-only reordering.
- Status is not communicated by colour alone.
- Reflow under browser zoom and text enlargement; no loss of tasks at 200% text size, with appropriate testing of WCAG reflow conditions.
- French document language; scoped Arabic language and direction.
- Reduced motion and stable loading layouts.
- Screen-reader announcements are brief and deduplicated.
- Automated accessibility checks plus manual keyboard and representative screen-reader checks. Do not treat a clean automated report as proof of complete conformance.
- The accessibility of listening/tracing pedagogy must be reviewed with the educator; a visual overhaul does not solve every assessment-access issue.

### Performance and engineering

- Keep existing framework versions; avoid adding a UI framework just for this redesign.
- Use current project conventions and reusable components; no parallel static application.
- Semantic tokens are centralised; no duplicated hardcoded colour systems.
- Self-hosted font delivery through supported Next.js mechanisms; no unnecessary families or runtime font-CDN requests.
- Use optimised, correctly sized existing image assets and reserved dimensions.
- No heavy animation library for simple feedback.
- Reuse the actual student renderer for previews where safe.
- Run lint, type checks, tests and production build using the repository's scripts.
- Report changed files, commands actually run, screenshots generated, and unresolved issues.

## 9. Suggested reusable components

Adapt names to the repository; this is not a requirement to create every component or route from scratch.

`TeacherShell`, `StudentShell`, `PageHeader`, `PrimaryAction`, `StatusPill`,
`RequestSummary`, `StudentProgressTable`, `StudentProgressDetail`,
`LessonOutline`, `ActivityEditor`, `StudentPreview`, `AudioRecorder`,
`LiveStage`, `ParticipantRail`, `PresenterToolbar`,
`LessonTile`, `ExerciseShell`, `ListenButton`, `AnswerTile`,
`EmptyState`, `InlineNotice`, `Skeleton`, `AccessibleDialog`.

Do not over-abstract unrelated teacher and child behaviours into one giant component. Share foundations and domain renderers; keep appropriate interaction differences.

## 10. Technical and visual references

References were consulted on 26 October 2026. Design recommendations above are original proposals, not claims that the references use this exact palette or component system.

- WCAG text contrast: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- WCAG non-text contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG 2.2 AA target-size minimum (24 CSS px, with exceptions; this project's minimums are larger): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- W3C structural RTL markup: https://www.w3.org/International/questions/qa-html-dir
- Next.js font delivery: https://nextjs.org/docs/app/getting-started/fonts
- Tailwind theme variables: https://tailwindcss.com/docs/theme
- Noto Arabic source project: https://github.com/notofonts/arabic
- Nunito source metadata: https://github.com/google/fonts/blob/main/ofl/nunito/METADATA.pb
- Linear work organisation reference: https://linear.app/docs/projects
- Craft block-structure reference: https://support.craft.do/en/write-and-edit
- Lovevery material/learning-object presentation reference: https://lovevery.com/products/the-play-kits
