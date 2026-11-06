-- Le formulaire demande au débutant qui reconnaît toutes les lettres isolées
-- s'il reconnaît aussi des lettres dans leurs formes attachées (début, milieu,
-- fin), et lesquelles. Null pour les autres demandes.
-- À exécuter une seule fois dans l'éditeur SQL Supabase, après
-- 2026-11-06_enrollment_level_details.sql.

alter table public.enrollment_requests
  add column letter_forms text check (letter_forms in ('none', 'some', 'all')),
  add column known_letter_forms smallint[];
