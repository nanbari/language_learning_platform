-- Enregistrements du vocabulaire (page « Enregistrements audio ») : pour
-- chaque mot, la question « أَيْنَ … ؟ » lue par l'enseignant, et la consigne
-- de l'exercice (« Écoute, puis choisis l'image. ») sous l'identifiant
-- réservé « _instruction ». Jusqu'ici gardés dans le navigateur de
-- l'enseignant, ils n'atteignaient pas les élèves ; le fichier mp3 est
-- maintenant sur R2 et son adresse ici, comme pour les sons des lettres.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table public.vocab_sounds (
  word_id text primary key,                 -- id du mot dans src/data/arabicVocabulary.ts (a1, fo3…) ou « _instruction »
  url text not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Lue et écrite uniquement par les routes serveur (client service-role).
alter table public.vocab_sounds enable row level security;
