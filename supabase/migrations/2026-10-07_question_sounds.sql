-- Questions des exercices de lettres enregistrées à voix haute par un admin
-- (page « Sons des lettres ») : une par type d'exercice, jouée à l'élève
-- quand l'exercice apparaît dans une leçon. Le fichier mp3 est sur R2.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.question_sounds (
  kind text primary key
    check (kind in ('pickSound', 'findLetter', 'findInWord', 'completeWord')),
  url text not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Lue et écrite uniquement par les routes serveur (client service-role).
alter table public.question_sounds enable row level security;
