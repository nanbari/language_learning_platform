-- Droits admin cumulables avec le rôle enseignant.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

alter table public.users
  add column if not exists is_admin boolean not null default false;

-- Les anciens comptes "admin" deviennent enseignant + admin
update public.users
  set is_admin = true, role = 'teacher'
  where role = 'admin';

-- Policies : un enseignant admin garde tous ses droits
drop policy if exists "Teachers can create lessons" on public.lessons;
create policy "Teachers can create lessons" on public.lessons
  for insert with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and (role = 'teacher' or is_admin)
    )
  );

drop policy if exists "Teachers can read events" on public.exercise_events;
create policy "Teachers can read events" on public.exercise_events
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and (role = 'teacher' or is_admin)
    )
  );

drop policy if exists "Teachers can read practice sets" on public.practice_sets;
create policy "Teachers can read practice sets" on public.practice_sets
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and (role = 'teacher' or is_admin)
    )
  );
