-- Cours en direct : la séance passe par le serveur, et les canaux Realtime
-- deviennent privés. Comptes désactivables.
--
-- À exécuter une seule fois dans l'éditeur SQL Supabase, AVANT de déployer le
-- code qui l'utilise (les routes /api/classes/:id/live/* lisent ces colonnes
-- et tables ; les canaux privés exigent les politiques ci-dessous).
-- Prérequis côté serveur (Netlify) : la variable SUPABASE_JWT_SECRET (le
-- « JWT Secret » du projet, Settings → API) pour émettre les jetons Realtime.
--
-- Retour arrière : voir le bloc commenté en fin de fichier.

-- 1. Écran courant de la séance, déposé par l'enseignant, relu par les élèves.
alter table public.classes
  add column if not exists live_state jsonb,
  add column if not exists live_state_at timestamptz;

-- 2. Compte désactivé : plus aucune connexion ni requête protégée
--    (lib/serverSession relit cette colonne à chaque requête).
alter table public.users
  add column if not exists disabled_at timestamptz;

-- 3. Réponses d'une séance (effacées à sa fin). L'exactitude est calculée par
--    le serveur ; l'élève est celui de la session.
create table if not exists public.live_answers (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  room text not null,
  slide_index integer not null check (slide_index >= 0),
  student_id uuid not null references public.users(id) on delete cascade,
  choice_id text not null check (char_length(choice_id) <= 80),
  correct boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists live_answers_session_idx on public.live_answers (class_id, room, created_at);

-- 4. Élèves présents (dernier signe de vie), pour le décompte de l'enseignant.
create table if not exists public.live_participants (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  room text not null,
  seen_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- Lues et écrites uniquement par les routes serveur (client service-role) :
-- RLS activée, aucune politique = aucun accès par la Data API.
alter table public.live_answers enable row level security;
alter table public.live_participants enable row level security;

-- 5. Canaux Realtime privés de la séance.
--    Le serveur émet un JWT (sub = id de l'utilisateur, role = authenticated)
--    pour l'enseignant de la classe et ses élèves. Les sujets sont
--    live:<salon>:control (le serveur seul y publie) et live:<salon>:video
--    (mise en relation WebRTC entre participants).
create or replace function public.ms_live_role(uid uuid, topic text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.teacher_id = uid then 'teacher'
    when exists (select 1 from public.class_members m where m.class_id = c.id and m.student_id = uid) then 'student'
    else null
  end
  from public.classes c
  where c.live_room is not null
    and c.live_started_at > now() - interval '6 hours'
    and topic in ('live:' || c.live_room || ':control', 'live:' || c.live_room || ':video')
  limit 1
$$;

revoke all on function public.ms_live_role(uuid, text) from public, anon;
grant execute on function public.ms_live_role(uuid, text) to authenticated, service_role;

drop policy if exists "live members receive" on realtime.messages;
create policy "live members receive" on realtime.messages
  for select to authenticated
  using (public.ms_live_role(auth.uid(), realtime.topic()) is not null);

-- Seul le sujet vidéo accepte des messages des navigateurs ; sur le sujet de
-- contrôle, aucune politique d'insertion : le service-role seul publie.
drop policy if exists "live members signal video" on realtime.messages;
create policy "live members signal video" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() like 'live:%:video'
    and public.ms_live_role(auth.uid(), realtime.topic()) is not null
  );

-- Retour arrière (à exécuter seulement si l'ancien code est redéployé) :
-- drop policy if exists "live members signal video" on realtime.messages;
-- drop policy if exists "live members receive" on realtime.messages;
-- drop function if exists public.ms_live_role(uuid, text);
-- drop table if exists public.live_participants;
-- drop table if exists public.live_answers;
-- alter table public.classes drop column if exists live_state, drop column if exists live_state_at;
-- -- users.disabled_at peut rester : l'ancien code l'ignore.
