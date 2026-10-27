-- PROPOSED — not applied, not in supabase/migrations on purpose.
-- Atomic lesson updates (backlog B3-1). Requires owner approval.
--
-- Adds a monotonically increasing version to lessons. PATCH /api/lessons will
-- then run ONE statement:
--   update lessons set ..., version = version + 1
--   where id = :id and version = :expectedVersion [and author_id = :me]
-- and answer 409 when no row was updated (someone else saved first). The
-- editor keeps its unsaved draft and offers « Recharger » / « Écraser ».
-- No read-compare-write: the check and the write are the same statement.

alter table public.lessons
  add column if not exists version integer not null default 1;

-- Rollback: alter table public.lessons drop column if exists version;
