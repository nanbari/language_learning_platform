-- À « inscrit », le compte élève de l'enfant est créé (invitation par e-mail
-- pour choisir le mot de passe) : la demande garde le lien vers ce compte.
-- Null pour une demande pas encore inscrite, ou inscrite avant cette migration.
-- Le compte n'est pas effacé avec la demande (tâche de conservation) : la
-- colonne se vide si le compte est supprimé.
-- À exécuter une seule fois dans l'éditeur SQL Supabase, AVANT de déployer le
-- code qui l'utilise (/api/admin/enrollments lit et écrit student_id).

alter table public.enrollment_requests
  add column if not exists student_id uuid references public.users(id) on delete set null;

-- Compte famille (voir src/lib/family.ts) : le premier enfant inscrit porte
-- l'adresse du parent et le mot de passe ; ses frères et sœurs ont chacun leur
-- profil, rattaché ici, sans mot de passe propre (adresse technique
-- eleve-…@famille.monteetsouris.com). À la connexion, la famille choisit le prénom.
-- Si le compte porteur est supprimé, les profils rattachés sont détachés et ne
-- peuvent plus se connecter : rattachez-les d'abord à un autre profil (runbook).
alter table public.users
  add column if not exists family_account_id uuid references public.users(id) on delete set null;

create index if not exists users_family_account_idx on public.users (family_account_id)
  where family_account_id is not null;
