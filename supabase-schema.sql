-- Schema Monte & Souris — à exécuter dans l'éditeur SQL Supabase

-- Table utilisateurs (complète le auth.users de Supabase)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('teacher', 'student', 'admin')),
  points integer default 0,
  created_at timestamptz default now()
);

-- Table leçons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  age_group text not null,
  author_id uuid references public.users(id) on delete cascade,
  exercises jsonb not null default '[]',
  published_at timestamptz,
  created_at timestamptz default now()
);

-- Table progression élèves
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  completed_at timestamptz default now(),
  unique(user_id, lesson_id)
);

-- Fonction pour incrémenter les points
create or replace function increment_points(user_id_param uuid, pts integer)
returns void as $$
  update public.users set points = points + pts where id = user_id_param;
$$ language sql;

-- RLS Policies
alter table public.users enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;

-- Users: chacun peut lire son profil
create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

-- Lessons: tous les authentifiés peuvent lire
create policy "Authenticated can read lessons" on public.lessons
  for select using (auth.role() = 'authenticated');

-- Lessons: seuls les enseignants peuvent créer/modifier
create policy "Teachers can create lessons" on public.lessons
  for insert with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'teacher')
  );

-- Progress: chacun peut lire/écrire sa propre progression
create policy "Users can manage own progress" on public.progress
  for all using (auth.uid() = user_id);
