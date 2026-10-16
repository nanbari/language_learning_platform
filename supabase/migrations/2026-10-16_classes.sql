-- Classes : chaque enseignant regroupe ses élèves en classes. Le cours en
-- direct se lance pour une classe, et seuls ses élèves peuvent le rejoindre
-- (plus de code à communiquer).
-- `live_room` est le nom du salon de la séance en cours (tiré au hasard,
-- impossible à deviner), null quand aucun cours n'est en direct.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  live_room text,
  live_started_at timestamptz,
  created_at timestamptz not null default now()
);

create index classes_teacher_idx on public.classes (teacher_id);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index class_members_student_idx on public.class_members (student_id);

-- Lues et écrites uniquement par les routes serveur (client service-role).
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
