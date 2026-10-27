-- Sauvegarde atomique des leçons : plus de « dernier qui écrit gagne ».
--
-- Chaque enregistrement incrémente `version` dans la même instruction que la
-- vérification (update … where id = ? and version = ?) : si quelqu'un d'autre
-- a enregistré entre-temps, aucune ligne n'est touchée et l'API répond 409 ;
-- l'éditeur garde le brouillon et propose de recharger ou d'écraser.
-- Tant que la colonne n'existe pas, l'API se comporte comme avant (sans
-- vérification) et le signale dans ses journaux.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

alter table public.lessons
  add column if not exists version integer not null default 1;

-- Retour arrière : alter table public.lessons drop column if exists version;
