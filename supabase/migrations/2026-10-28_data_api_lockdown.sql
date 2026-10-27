-- Data API verrouillée pour les comptes utilisateurs.
--
-- L'application ne lit et n'écrit les tables que depuis le serveur (clé
-- service-role) ; aucun navigateur n'interroge PostgREST avec un JWT
-- d'utilisateur. Les politiques « authenticated » héritées du premier schéma
-- ne servaient donc à rien… sauf à ouvrir une porte : depuis que le cours en
-- direct remet à chaque participant un vrai JWT Supabase (canaux Realtime
-- privés), ce JWT permettrait aussi d'appeler /rest/v1 et, par exemple, de
-- lire toutes les leçons (« Authenticated can read lessons »).
--
-- RLS reste activée partout ; sans politique, la Data API ne rend rien aux
-- rôles anon et authenticated. Le service-role n'est pas concerné.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

drop policy if exists "Users can read own profile" on public.users;
drop policy if exists "Authenticated can read lessons" on public.lessons;
drop policy if exists "Teachers can create lessons" on public.lessons;
drop policy if exists "Users can manage own progress" on public.progress;
drop policy if exists "Students manage own events" on public.exercise_events;
drop policy if exists "Teachers can read events" on public.exercise_events;
drop policy if exists "Students read own practice sets" on public.practice_sets;
drop policy if exists "Teachers can read practice sets" on public.practice_sets;

-- Les politiques Realtime (« live members receive », « live members signal
-- video ») sont volontairement conservées : ce sont elles qui autorisent les
-- participants d'un cours à rejoindre ses canaux privés.

-- Vérification (doit ne lister que les deux politiques realtime) :
-- select schemaname, tablename, policyname from pg_policies
--  where schemaname in ('public', 'realtime') order by 1, 2, 3;

-- Retour arrière : réexécuter les `create policy` correspondants de
-- supabase/schema.sql et supabase/migrations/2026-09-04_is_admin.sql.
