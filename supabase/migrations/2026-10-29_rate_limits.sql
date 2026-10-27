-- Limitation de débit des routes publiques (connexion, demandes de compte et
-- d'inscription, réinitialisation de mot de passe).
--
-- Le serveur Netlify est sans état : le compteur vit ici. Une fonction
-- atomique incrémente le compteur d'une clé (adresse IP, éventuellement
-- e-mail) dans une fenêtre glissante et dit si la limite est dépassée.
-- Tant que la fonction n'existe pas, l'API laisse passer et le signale dans
-- ses journaux (comportement d'avant).
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table if not exists public.rate_limits (
  key text primary key,
  hits integer not null,
  window_start timestamptz not null
);
alter table public.rate_limits enable row level security;  -- aucune politique : service-role seulement

create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set hits = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else public.rate_limits.hits + 1 end,
        window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else public.rate_limits.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Entretien (facultatif, à lancer de temps en temps) :
--   delete from public.rate_limits where window_start < now() - interval '1 day';

-- Retour arrière :
--   drop function if exists public.rate_limit_hit(text, integer, integer);
--   drop table if exists public.rate_limits;
