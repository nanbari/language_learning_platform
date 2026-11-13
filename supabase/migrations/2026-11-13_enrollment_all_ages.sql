-- Inscriptions ouvertes aux adolescents et aux adultes : le formulaire
-- /demande-inscription propose chaque âge de 4 à 17 ans, puis « 18 ans ou
-- plus », enregistré 18 (l'âge exact d'un adulte n'est pas demandé).
-- La contrainte d'origine limitait child_age à 4–12 ans.
-- À exécuter une seule fois dans l'éditeur SQL Supabase, AVANT de déployer le
-- code qui l'utilise (sinon une demande pour un élève de 13 ans ou plus est refusée).

alter table public.enrollment_requests drop constraint if exists enrollment_requests_child_age_check;
alter table public.enrollment_requests
  add constraint enrollment_requests_child_age_check check (child_age between 4 and 18);

-- Retour arrière (impossible tant qu'une demande a plus de 12 ans) :
--   alter table public.enrollment_requests drop constraint enrollment_requests_child_age_check;
--   alter table public.enrollment_requests add constraint enrollment_requests_child_age_check check (child_age between 4 and 12);
