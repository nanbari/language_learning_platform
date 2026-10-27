-- Événements d'exercice : envoi fiable depuis le navigateur.
--
-- Les événements (essais, réussites, indices) nourrissent la liste « à
-- revoir » de l'élève, le tableau de bord enseignant et les révisions
-- générées : ce sont des données d'apprentissage. Le navigateur leur donne
-- désormais un identifiant (`event_id`) et conserve les lots non envoyés
-- pour les renvoyer plus tard ; l'index unique garantit qu'un lot renvoyé
-- deux fois n'est enregistré qu'une fois (un nouvel essai a un nouvel id).
-- Les lignes existantes gardent event_id NULL (les NULL ne se heurtent pas).
-- Tant que la colonne n'existe pas, l'API enregistre sans identifiant.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

alter table public.exercise_events
  add column if not exists event_id uuid;

create unique index if not exists exercise_events_event_id_key
  on public.exercise_events (event_id);

-- Retour arrière :
--   drop index if exists public.exercise_events_event_id_key;
--   alter table public.exercise_events drop column if exists event_id;
