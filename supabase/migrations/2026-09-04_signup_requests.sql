-- Table des demandes de compte élève.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null
);

create unique index signup_requests_pending_email_idx
  on public.signup_requests (email)
  where status = 'pending';

alter table public.signup_requests enable row level security;
