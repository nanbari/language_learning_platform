-- Schema Monte & Souris — à exécuter dans l'éditeur SQL Supabase

-- Table utilisateurs (complète le auth.users de Supabase)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('teacher', 'student', 'admin')),
  -- Droits d'administration, cumulables avec le rôle (un enseignant peut être
  -- admin). L'ancienne valeur role = 'admin' reste acceptée et vaut
  -- enseignant + admin (voir src/app/api/auth/route.ts).
  is_admin boolean not null default false,
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
    exists (select 1 from public.users where id = auth.uid() and (role = 'teacher' or is_admin))
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
    exists (select 1 from public.users where id = auth.uid() and (role = 'teacher' or is_admin))
  );

-- ─────────────────────────────────────────────────────────────
-- Séries de révision générées par l’agent (voir src/lib/practiceGenerator.ts)
-- blocks  = blocs d’exercices au format des leçons, id préfixé "gen-" ;
--           leurs événements vont dans exercise_events avec lesson_id =
--           leçon d’origine.
-- sources = points faibles à l’origine de la série (block_id, réponses fausses).
-- ─────────────────────────────────────────────────────────────
create table public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  blocks jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

-- Dernière série d’un élève pour une leçon
create index practice_sets_user_lesson_idx on public.practice_sets (user_id, lesson_id, created_at desc);

alter table public.practice_sets enable row level security;

-- Élèves : lecture de leurs propres séries (l’écriture passe par le serveur)
create policy "Students read own practice sets" on public.practice_sets
  for select using (auth.uid() = user_id);

-- Enseignants et admins : lecture de toutes les séries
create policy "Teachers can read practice sets" on public.practice_sets
  for select using (
    exists (select 1 from public.users where id = auth.uid() and (role = 'teacher' or is_admin))
  );

-- ─────────────────────────────────────────────────────────────
-- Demandes de compte élève (voir src/lib/signup.ts)
-- Le formulaire public /inscription enregistre une demande ; un admin
-- l’approuve ou la refuse depuis son tableau de bord. Le compte Auth et le
-- profil `users` ne sont créés qu’à l’approbation, avec password_hash
-- (bcrypt) fourni à l’inscription, puis effacé.
-- ─────────────────────────────────────────────────────────────
create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null
);

-- Une seule demande en attente par adresse
create unique index signup_requests_pending_email_idx
  on public.signup_requests (email) where status = 'pending';

-- Aucune policy : la table n’est accessible que par le serveur (service role)
alter table public.signup_requests enable row level security;
