-- Monte & Souris — inventaire EN LECTURE SEULE du projet Supabase.
-- À exécuter par l'opérateur dans l'éditeur SQL (rôle postgres) ; coller les
-- résultats (sans clés ni mots de passe) dans docs/audit/ pour lever les
-- mentions « UNVERIFIED » du rapport. Aucune de ces requêtes ne modifie quoi
-- que ce soit.

-- 1. Tables du schéma public, RLS activée ou non, et nombre de politiques.
select t.tablename,
       t.rowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename) as policies
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

-- 2. Politiques existantes (public + realtime.messages), rôle visé et expression.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'realtime', 'storage')
order by schemaname, tablename, policyname;

-- 3. Droits des rôles anon / authenticated sur les tables public
--    (ce que la Data API accorde AVANT les politiques).
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 4. Vues et fonctions exposées (RPC) et leurs droits d'exécution.
select table_name as view_name from information_schema.views where table_schema = 'public' order by 1;

select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       (select string_agg(grantee || ':' || privilege_type, ', ')
          from information_schema.routine_privileges rp
         where rp.specific_schema = 'public' and rp.routine_name = p.proname
           and rp.grantee in ('anon', 'authenticated', 'public')) as exposed_to
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 5. Schémas exposés par la Data API (à comparer avec Settings → API → Exposed schemas).
select nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by 1;

-- 6. Buckets Storage et leurs politiques (le projet utilise R2, pas Storage : la liste devrait être vide).
select id, name, public from storage.buckets order by name;

-- 7. Realtime : la table des messages a-t-elle RLS, et quelles politiques (voir 2).
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'realtime' and relname = 'messages';

-- 8. Colonnes attendues par le code après la migration 2026-10-28.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'classes' and column_name in ('live_state', 'live_state_at'))
    or (table_name = 'users' and column_name = 'disabled_at'))
order by 1, 2;

select tablename from pg_tables where schemaname = 'public' and tablename in ('live_answers', 'live_participants', 'vocab_sounds');

-- Métadonnées à relever hors SQL (dashboard), sans valeur de clé :
--  - Settings → API : schémas exposés ; existence du « JWT Secret » (legacy HS256) ou passage aux « JWT Signing Keys » ;
--  - Authentication → Rate limits ; Providers → Email (confirmation requise ?) ; URL configuration (Site URL, Redirect URLs) ;
--  - Realtime → Settings : « Enable Realtime authorization (private channels) » ;
--  - Database → Backups : PITR / sauvegardes quotidiennes, dernière restauration testée.
