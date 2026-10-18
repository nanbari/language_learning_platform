-- Le formulaire de demande d'inscription ne demande plus les disponibilités.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

alter table public.enrollment_requests drop column availability;
