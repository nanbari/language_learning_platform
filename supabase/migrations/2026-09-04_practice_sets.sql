-- Table des séries de révision générées par l'agent.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.users(id) on delete cascade,
  lesson_id uuid not null
    references public.lessons(id) on delete cascade,
  blocks jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index practice_sets_user_lesson_idx
  on public.practice_sets (user_id, lesson_id, created_at desc);

alter table public.practice_sets enable row level security;

create policy "Students read own practice sets"
  on public.practice_sets
  for select using (auth.uid() = user_id);

create policy "Teachers can read practice sets"
  on public.practice_sets
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );
