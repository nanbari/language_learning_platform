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

-- ─────────────────────────────────────────────────────────────
-- Événements d'exercice (journal fin, base des agents adaptatifs)
-- Une ligne par interaction : essai, réussite, indice, simple affichage.
-- block_id = id du bloc dans lessons.exercises->'blocks' (pas de FK possible
-- sur du jsonb). Voir src/lib/exerciseEvents.ts pour la sémantique.
-- ─────────────────────────────────────────────────────────────
create table public.exercise_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id text not null,
  exercise_type text not null check (exercise_type in ('quiz', 'matching', 'dragdrop', 'wordorder', 'image-quiz')),
  event_type text not null check (event_type in ('attempt', 'complete', 'hint', 'view')),
  correct boolean,
  answer jsonb,
  attempt_number integer check (attempt_number is null or attempt_number >= 1),
  hint_count integer not null default 0 check (hint_count >= 0),
  time_ms integer check (time_ms is null or time_ms >= 0),
  created_at timestamptz not null default now()
);

-- Parcours d'un élève dans une leçon (recommandation, répétition espacée)
create index exercise_events_user_lesson_idx on public.exercise_events (user_id, lesson_id, created_at desc);
-- Statistiques par exercice (exercice trop dur, mal rédigé…)
create index exercise_events_lesson_block_idx on public.exercise_events (lesson_id, block_id);

alter table public.exercise_events enable row level security;

-- Élèves : lecture et insertion de leurs propres événements uniquement
create policy "Students manage own events" on public.exercise_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enseignants et admins : lecture de tous les événements
create policy "Teachers can read events" on public.exercise_events
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role in ('teacher', 'admin'))
  );
