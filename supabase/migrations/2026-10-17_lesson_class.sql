-- Leçons par classe : chaque leçon est proposée à une seule classe, et seuls
-- les élèves de cette classe la voient (liste, leçon, révisions).
-- Une leçon sans classe (créée avant cette migration, ou dont la classe a été
-- supprimée) n'est visible d'aucun élève tant que l'enseignant ne lui en
-- attribue pas une depuis l'éditeur.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

alter table public.lessons
  add column class_id uuid references public.classes(id) on delete set null;

create index lessons_class_idx on public.lessons (class_id);
