-- Le formulaire de demande d'inscription demande désormais, pour chaque enfant,
-- les lettres déjà connues et le vocabulaire acquis (et ses domaines).
-- Les demandes antérieures gardent ces colonnes à null.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

alter table public.enrollment_requests
  add column letters text check (letters in ('none', 'some', 'all')),
  add column known_letters smallint[],
  add column vocabulary text check (vocabulary in ('none', 'some', 'lots')),
  add column vocabulary_domains text[],
  add column vocabulary_other text check (char_length(vocabulary_other) <= 200);
