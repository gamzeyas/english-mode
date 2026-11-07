-- English Mode — Milestone 7b: pronunciation lab (Azure read-aloud
-- assessment). Attempts are written by the server only; learners read and
-- delete their own. Recordings are not stored (private_audio_path stays null).

alter table public.pronunciation_attempts
  -- Where the reference text came from: the built-in practice sets, the
  -- learner's pool, or their own sentence.
  add column source text not null default 'custom'
    check (source in ('catalog', 'pool', 'custom')),
  add column source_ref text,
  add column pron_score numeric check (pron_score between 0 and 100),
  add column assessor_version text,
  add constraint pronunciation_reference_length
    check (char_length(reference_text) between 1 and 200);

grant delete on public.pronunciation_attempts to authenticated;

create policy "pronunciation_attempts: delete own" on public.pronunciation_attempts
  for delete to authenticated using (user_id = (select auth.uid()));

create index pronunciation_attempts_user_time_idx
  on public.pronunciation_attempts (user_id, created_at desc);
