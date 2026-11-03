-- English Mode — row-level security and grants (PRD §8 "RLS: non-negotiable").
--
-- Rules:
--   * RLS is enabled on every table in `public`.
--   * `anon` gets nothing. `authenticated` gets only the operations the app
--     performs with the learner's own JWT; everything else (analyzer output,
--     usage logs, push subscriptions, audio metadata) is written server-side
--     with the secret key, which bypasses RLS and never reaches the browser.
--   * Every policy compares `user_id` with `(select auth.uid())` (evaluated
--     once per statement). Composite foreign keys from the previous migration
--     additionally pin child rows to the same owner as their parent.
--   * Immutable records (messages, review logs) have no update/delete policy.

-- ---------------------------------------------------------------------------
-- Start from zero privileges
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

-- Future objects created by migrations also start without client privileges.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.assessments enable row level security;
alter table public.scenarios enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.session_feedback enable row level security;
alter table public.learning_items enable row level security;
alter table public.review_logs enable row level security;
alter table public.error_patterns enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.audio_assets enable row level security;
alter table public.pronunciation_attempts enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ai_usage_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: read + update own row (insert happens via the auth trigger;
-- account deletion goes through the server-side delete pipeline).
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant update (
  display_name, purpose, dialect, timezone, daily_minutes, feedback_mode,
  interests, goals, onboarding_completed_at
) on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Consents: read, grant, revoke own.
-- ---------------------------------------------------------------------------

grant select, insert on public.consents to authenticated;
grant update (revoked_at) on public.consents to authenticated;

create policy "consents: read own" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "consents: insert own" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "consents: revoke own" on public.consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Assessments: read + create own.
-- ---------------------------------------------------------------------------

grant select, insert on public.assessments to authenticated;

create policy "assessments: read own" on public.assessments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "assessments: insert own" on public.assessments
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Scenarios: shared read-only catalog for signed-in learners.
-- ---------------------------------------------------------------------------

grant select on public.scenarios to authenticated;

create policy "scenarios: read active" on public.scenarios
  for select to authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- Sessions: read, start, update status, delete (cascades transcript).
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.sessions to authenticated;
grant update (status, ended_at, summary, metadata) on public.sessions to authenticated;

create policy "sessions: read own" on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sessions: insert own" on public.sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sessions: update own" on public.sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "sessions: delete own" on public.sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Messages: read + append own; immutable afterwards.
-- ---------------------------------------------------------------------------

grant select, insert on public.messages to authenticated;

create policy "messages: read own" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "messages: insert own" on public.messages
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Session feedback: read own (written by the server-side analyzer).
-- ---------------------------------------------------------------------------

grant select on public.session_feedback to authenticated;

create policy "session_feedback: read own" on public.session_feedback
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Learning items: full CRUD on own items (pool is learner-editable, PRD §3.9).
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.learning_items to authenticated;
grant update (
  phrase, normalized_phrase, meaning_tr, example, category, status,
  source_context, fsrs_state, due_at, last_reviewed_at
) on public.learning_items to authenticated;

create policy "learning_items: read own" on public.learning_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "learning_items: insert own" on public.learning_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "learning_items: update own" on public.learning_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "learning_items: delete own" on public.learning_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Review logs: read + append own; immutable afterwards.
-- ---------------------------------------------------------------------------

grant select, insert on public.review_logs to authenticated;

create policy "review_logs: read own" on public.review_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "review_logs: insert own" on public.review_logs
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Error patterns: read + delete own (written by the analyzer).
-- ---------------------------------------------------------------------------

grant select, delete on public.error_patterns to authenticated;

create policy "error_patterns: read own" on public.error_patterns
  for select to authenticated using (user_id = (select auth.uid()));
create policy "error_patterns: delete own" on public.error_patterns
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Assignments: read own, complete/skip/reschedule (generated server-side).
-- ---------------------------------------------------------------------------

grant select on public.assignments to authenticated;
grant update (status, due_at) on public.assignments to authenticated;

create policy "assignments: read own" on public.assignments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "assignments: update own" on public.assignments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Submissions: read + submit own.
-- ---------------------------------------------------------------------------

grant select, insert on public.submissions to authenticated;

create policy "submissions: read own" on public.submissions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "submissions: insert own" on public.submissions
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Audio, pronunciation, usage: read own only (server writes).
-- ---------------------------------------------------------------------------

grant select on public.audio_assets to authenticated;
grant select on public.pronunciation_attempts to authenticated;
grant select on public.ai_usage_logs to authenticated;

create policy "audio_assets: read own" on public.audio_assets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "pronunciation_attempts: read own" on public.pronunciation_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_usage_logs: read own" on public.ai_usage_logs
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Notification preferences: read + upsert own.
-- ---------------------------------------------------------------------------

grant select, insert on public.notification_preferences to authenticated;
grant update (enabled, reminder_time, timezone, channels) on public.notification_preferences
  to authenticated;

create policy "notification_preferences: read own" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_preferences: insert own" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notification_preferences: update own" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Push subscriptions: read + remove own (PRD §8: server-only writes).
-- ---------------------------------------------------------------------------

grant select, delete on public.push_subscriptions to authenticated;

create policy "push_subscriptions: read own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
