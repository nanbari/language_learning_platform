-- Demandes d'inscription des familles, envoyées depuis le formulaire public
-- /demande-inscription (lien partagé avec la vidéo de présentation).
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  email text not null,
  phone text not null,
  child_name text not null,
  child_age smallint not null check (child_age between 4 and 12),
  level text not null check (level in ('beginner', 'reader')),
  availability text[] not null,
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.users(id) on delete set null
);

create index enrollment_requests_status_idx
  on public.enrollment_requests (status, created_at);

-- Aucune policy : la table n'est accessible que par le serveur (service role)
alter table public.enrollment_requests enable row level security;
