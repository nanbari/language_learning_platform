-- PROPOSED — not applied, not in supabase/migrations on purpose.
-- Offline event delivery with idempotency (backlog B3-2). Requires owner approval.
--
-- exercise_events are learning records (review loop, teacher insights,
-- practice generation), not telemetry. Today a batch lost on a flaky network
-- is gone. Plan:
--   client: queue unsent batches in localStorage with a client-generated
--           event_id (uuid) per event; flush on load / online / pagehide;
--   server: insert … on conflict (event_id) do nothing, so a RETRIED batch
--           never duplicates an attempt, while a genuinely new attempt (new
--           event_id) is always kept.

alter table public.exercise_events
  add column if not exists event_id uuid;

-- Partial unique index: legacy rows (null) stay untouched.
create unique index if not exists exercise_events_event_id_key
  on public.exercise_events (event_id)
  where event_id is not null;

-- Rollback:
--   drop index if exists public.exercise_events_event_id_key;
--   alter table public.exercise_events drop column if exists event_id;
