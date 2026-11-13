-- Fin des « demandes de compte élève » (page /inscription, /api/signup,
-- /api/admin/signups) : depuis le 12 novembre 2026, le compte élève est créé
-- quand un admin marque une demande d'inscription « inscrit ». La table
-- signup_requests ne sert plus à rien et contient des adresses e-mail, des
-- noms et, pour les demandes jamais traitées, un hachage de mot de passe.
--
-- À exécuter une seule fois dans l'éditeur SQL Supabase, APRÈS avoir déployé
-- le code qui ne l'utilise plus (l'ancien code lit encore la table).
--
-- Suppression définitive. Le bloc refuse de continuer s'il reste une demande
-- en attente : recontactez d'abord ces familles pour qu'elles passent par
-- /demande-inscription. Pour les voir :
--   select name, email, created_at from public.signup_requests where status = 'pending';
-- Les comptes déjà approuvés ne sont pas touchés (ils vivent dans auth.users
-- et public.users).

do $$
declare
  waiting integer;
begin
  if to_regclass('public.signup_requests') is null then
    return;
  end if;
  select count(*) into waiting from public.signup_requests where status = 'pending';
  if waiting > 0 then
    raise exception 'signup_requests : % demande(s) encore en attente, table conservée', waiting;
  end if;
  drop table public.signup_requests;
end $$;

-- Compteurs de limitation de débit de l'ancienne route.
delete from public.rate_limits where key like 'signup:%';
