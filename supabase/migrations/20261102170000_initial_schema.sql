-- English Mode — initial schema (PRD §8).
--
-- Ownership model: every learner-owned row carries user_id. Child rows that
-- point at another learner-owned row use a composite foreign key
-- (child_id, user_id) -> parent(id, user_id), so Postgres itself guarantees a
-- message can never belong to someone else's session (PRD §8 "RLS: non-negotiable").
-- Row-level security and grants live in the next migration.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & consent
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  native_language text not null default 'tr',
  target_language text not null default 'en',
  purpose text check (purpose in ('career', 'casual', 'travel')),
  dialect text not null default 'en-US' check (dialect in ('en-US', 'en-GB')),
  timezone text not null default 'Europe/Istanbul',
  daily_minutes integer not null default 25 check (daily_minutes in (5, 15, 25, 30)),
  feedback_mode text not null default 'end'
    check (feedback_mode in ('end', 'on_request', 'immediate')),
  interests text[] not null default '{}' check (cardinality(interests) <= 10),
  goals text[] not null default '{}' check (cardinality(goals) <= 10),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Every new auth user gets an empty profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  consent_type text not null
    check (consent_type in ('data_processing', 'voice_processing', 'audio_retention')),
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= granted_at)
);

-- At most one active grant per consent type.
create unique index consents_one_active_idx
  on public.consents (user_id, consent_type)
  where revoked_at is null;

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  modality text not null check (modality in ('text', 'audio', 'mixed')),
  rubric jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  estimated_level text,
  is_official boolean not null default false check (is_official = false),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scenarios (shared catalog, server-managed)
-- ---------------------------------------------------------------------------

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null check (category in ('career', 'founder', 'client', 'social')),
  difficulty text not null default 'adaptive'
    check (difficulty in ('easy', 'medium', 'hard', 'adaptive')),
  summary text not null default '',
  persona jsonb not null default '{}'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  duration_options integer[] not null default '{5,10}',
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Sessions, messages, feedback
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete set null,
  mode text not null
    check (mode in ('text', 'recorded_audio', 'realtime_voice', 'writing', 'review')),
  status text not null default 'active'
    check (status in ('active', 'completed', 'interrupted', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system_summary')),
  modality text not null default 'text' check (modality in ('text', 'speech_transcript')),
  content text not null check (char_length(content) <= 8000),
  -- Client-generated key that makes message retries idempotent (PRD §9).
  client_message_id uuid,
  sequence_number integer not null check (sequence_number >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);

create unique index messages_client_id_idx
  on public.messages (session_id, client_message_id)
  where client_message_id is not null;

create table public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  user_id uuid not null,
  analyzer_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Learning items & reviews
-- ---------------------------------------------------------------------------

create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  phrase text not null check (char_length(phrase) between 1 and 300),
  normalized_phrase text not null check (char_length(normalized_phrase) between 1 and 300),
  meaning_tr text,
  example text,
  category text not null default 'expression',
  status text not null default 'suggested'
    check (status in ('suggested', 'new', 'learning', 'review', 'mastered', 'archived')),
  source_session_id uuid,
  source_message_id uuid,
  source_context text,
  fsrs_state jsonb,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_phrase),
  unique (id, user_id),
  foreign key (source_session_id, user_id)
    references public.sessions (id, user_id) on delete set null (source_session_id),
  foreign key (source_message_id, user_id)
    references public.messages (id, user_id) on delete set null (source_message_id)
);

create trigger learning_items_set_updated_at
before update on public.learning_items
for each row execute function public.set_updated_at();

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  learning_item_id uuid not null,
  session_id uuid,
  -- Client-generated key that makes grade retries idempotent (PRD §9).
  client_request_id uuid,
  grade integer not null check (grade between 1 and 4),
  response_text text check (char_length(response_text) <= 2000),
  ai_suggested_grade integer check (ai_suggested_grade between 1 and 4),
  previous_state jsonb not null,
  next_state jsonb not null,
  reviewed_at timestamptz not null default now(),
  foreign key (learning_item_id, user_id)
    references public.learning_items (id, user_id) on delete cascade,
  foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete set null (session_id)
);

create unique index review_logs_client_request_idx
  on public.review_logs (user_id, client_request_id)
  where client_request_id is not null;

create table public.error_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  pattern_key text not null,
  category text not null,
  explanation_tr text,
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  last_seen_at timestamptz not null default now(),
  evidence jsonb not null default '[]'::jsonb,
  unique (user_id, pattern_key)
);

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  title text not null,
  instructions text not null,
  kind text not null,
  estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 60),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  user_id uuid not null,
  answer_text text check (char_length(answer_text) <= 8000),
  private_audio_path text,
  feedback jsonb,
  submitted_at timestamptz not null default now(),
  foreign key (assignment_id, user_id)
    references public.assignments (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Voice & pronunciation (used from Milestone 6/7)
-- ---------------------------------------------------------------------------

create table public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  session_id uuid,
  provider text not null,
  storage_path text,
  mime_type text,
  duration_seconds numeric check (duration_seconds >= 0),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete set null (session_id)
);

create table public.pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  session_id uuid,
  reference_text text not null,
  locale text not null default 'en-US' check (locale in ('en-US', 'en-GB')),
  result jsonb,
  private_audio_path text,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete set null (session_id)
);

-- ---------------------------------------------------------------------------
-- Notifications & usage
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  enabled boolean not null default false,
  reminder_time time,
  timezone text not null default 'Europe/Istanbul',
  channels text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  session_id uuid,
  provider text not null,
  model text not null,
  operation text not null,
  input_tokens bigint,
  output_tokens bigint,
  audio_seconds numeric,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete set null (session_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index learning_due_idx on public.learning_items (user_id, due_at)
  where status in ('new', 'learning', 'review');
create index messages_session_order_idx on public.messages (session_id, sequence_number);
create index sessions_user_time_idx on public.sessions (user_id, started_at desc);
create index assignments_due_idx on public.assignments (user_id, status, due_at);
create index review_logs_item_idx on public.review_logs (learning_item_id, reviewed_at desc);
create index consents_user_idx on public.consents (user_id, consent_type);
create index ai_usage_user_time_idx on public.ai_usage_logs (user_id, created_at desc);
