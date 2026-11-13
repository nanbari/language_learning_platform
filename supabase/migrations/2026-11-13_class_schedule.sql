-- Horaire hebdomadaire d'une classe : le jour et l'heure où elle a cours,
-- pour le calendrier de la page « Mes classes » (voir src/lib/classes.ts,
-- ClassSchedule). Les trois colonnes sont vides ensemble (classe sans
-- horaire) ou remplies ensemble.
--   schedule_day     : 1 = lundi … 7 = dimanche
--   schedule_start   : heure de début "HH:MM", heure de l'école (sans fuseau)
--   schedule_minutes : durée du cours
-- À exécuter une seule fois dans l'éditeur SQL Supabase, AVANT de déployer le
-- code qui l'utilise (/api/classes lit ces colonnes).

alter table public.classes
  add column if not exists schedule_day smallint check (schedule_day between 1 and 7),
  add column if not exists schedule_start text check (schedule_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists schedule_minutes smallint check (schedule_minutes between 15 and 480);

alter table public.classes drop constraint if exists classes_schedule_complete;
alter table public.classes add constraint classes_schedule_complete check (
  (schedule_day is null and schedule_start is null and schedule_minutes is null)
  or (schedule_day is not null and schedule_start is not null and schedule_minutes is not null)
);

-- Retour arrière :
--   alter table public.classes drop constraint if exists classes_schedule_complete;
--   alter table public.classes drop column if exists schedule_day, drop column if exists schedule_start, drop column if exists schedule_minutes;
