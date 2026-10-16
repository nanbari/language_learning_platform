-- Sons des lettres enregistrés par les enseignants depuis la plateforme
-- (page « Sons des lettres »), joués dans l'exercice « choisir le son ».
-- Un son par lettre (numéro 1 à 28) ; le fichier mp3 est sur R2.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.letter_sounds (
  letter_id integer primary key check (letter_id between 1 and 28),
  url text not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Lue et écrite uniquement par les routes serveur (client service-role).
alter table public.letter_sounds enable row level security;
