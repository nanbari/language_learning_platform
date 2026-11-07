-- Demandes d'inscription : décision « inscrit » / « sans suite » et conservation
-- limitée (RGPD, art. 5.1.e), conforme à la mention affichée sur le formulaire :
--  - demande sans suite : effacée 6 mois après son classement ;
--  - enfant inscrit : coordonnées conservées pendant l'inscription, puis un an
--    après sa fin (l'admin clique « Fin d'inscription », qui remplit ended_at).
-- Les demandes déjà « traitées » deviennent « inscrit » par prudence : rien
-- n'est effacé par erreur, l'admin peut les reclasser à la main.
-- À exécuter une seule fois dans l'éditeur SQL Supabase (rejouable).

alter table public.enrollment_requests drop constraint if exists enrollment_requests_status_check;
update public.enrollment_requests set status = 'enrolled' where status = 'handled';
alter table public.enrollment_requests
  add constraint enrollment_requests_status_check check (status in ('new', 'enrolled', 'closed'));
alter table public.enrollment_requests add column if not exists ended_at timestamptz;

-- Tâche nocturne (3 h UTC). pg_cron tourne dans la base Supabase (tous les plans) ;
-- si l'extension n'est pas disponible ici, l'activer dans Database → Extensions.
-- Le nom de tâche est unique : une nouvelle exécution remplace la précédente.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'purge_enrollment_requests',
  '0 3 * * *',
  $$ delete from public.enrollment_requests
     where (status = 'closed'   and handled_at < now() - interval '6 months')
        or (status = 'enrolled' and ended_at   < now() - interval '1 year') $$
);

-- Vérification : select jobname, schedule, active from cron.job;
-- Historique :   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
