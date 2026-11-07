-- English Mode — Turkish translations of coach turns (server-written).
--
-- Kept out of `messages` because learners may insert their own messages:
-- a column there would be learner-writable, while a translation is
-- AI-produced and must only come from the server.

create table public.message_translations (
  message_id uuid primary key,
  user_id uuid not null,
  text_tr text not null check (char_length(text_tr) between 1 and 8000),
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  foreign key (message_id, user_id)
    references public.messages (id, user_id) on delete cascade
);

alter table public.message_translations enable row level security;

revoke all on public.message_translations from anon, authenticated;
grant select on public.message_translations to authenticated;

create policy "message_translations: read own" on public.message_translations
  for select to authenticated using (user_id = (select auth.uid()));

create index message_translations_user_idx
  on public.message_translations (user_id);
