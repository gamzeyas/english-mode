-- English Mode — Milestone 4: assignment planner, writing coach, baseline
-- and matched assessments (PRD §4, §11, §12, §16).
--
-- AI-produced records (assessment rubrics, submission feedback, writing coach
-- responses) are written by the server with the secret key; learners can read
-- them but never forge them.

-- ---------------------------------------------------------------------------
-- Assignments: daily planner metadata.
-- ---------------------------------------------------------------------------

alter table public.assignments
  -- Learner-local calendar day the task belongs to (Europe/Istanbul by default).
  add column scheduled_for date not null default current_date,
  -- Idempotency key for generated tasks, e.g. "2026-11-03:review" or
  -- "session:<uuid>". Retried generation never duplicates a task.
  add column plan_key text,
  add column source_session_id uuid,
  -- Kind-specific data: scenario slug, rewrite sentence, swap provenance.
  add column payload jsonb not null default '{}'::jsonb,
  add constraint assignments_kind_check check (
    kind in ('review', 'conversation', 'roleplay', 'rewrite', 'interview_answer', 'follow_up')
  ),
  add constraint assignments_plan_key_unique unique (user_id, plan_key),
  add constraint assignments_source_session_fk foreign key (source_session_id, user_id)
    references public.sessions (id, user_id) on delete set null (source_session_id);

alter table public.assignments alter column scheduled_for drop default;

create index assignments_day_idx
  on public.assignments (user_id, scheduled_for, status);

grant insert (
  user_id, title, instructions, kind, estimated_minutes, status,
  scheduled_for, plan_key, source_session_id, payload
) on public.assignments to authenticated;
grant update (status, due_at, scheduled_for) on public.assignments to authenticated;

create policy "assignments: insert own" on public.assignments
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Submissions: one per assignment; feedback is server-written.
-- ---------------------------------------------------------------------------

alter table public.submissions
  add column session_id uuid,
  add constraint submissions_one_per_assignment unique (assignment_id),
  add constraint submissions_session_fk foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete set null (session_id);

revoke insert on public.submissions from authenticated;
grant insert (assignment_id, user_id, answer_text, session_id)
  on public.submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Assessments: baseline + fortnightly matched tasks (server-written).
-- ---------------------------------------------------------------------------

alter table public.assessments
  add column kind text not null default 'baseline'
    check (kind in ('baseline', 'matched')),
  add column task_set text not null default 'baseline-v1',
  add column assessor_version text;

drop policy "assessments: insert own" on public.assessments;
revoke insert on public.assessments from authenticated;

create index assessments_user_time_idx
  on public.assessments (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Writing coach entries (server-written; learners read and delete).
-- ---------------------------------------------------------------------------

create table public.writing_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 4000),
  intent text not null check (char_length(intent) between 1 and 200),
  register text not null
    check (register in ('casual', 'neutral', 'professional', 'formal')),
  coach_version text not null,
  response jsonb not null,
  revision_text text check (char_length(revision_text) <= 4000),
  revision_feedback jsonb,
  revised_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

alter table public.writing_entries enable row level security;

revoke all on public.writing_entries from anon, authenticated;
grant select, delete on public.writing_entries to authenticated;

create policy "writing_entries: read own" on public.writing_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "writing_entries: delete own" on public.writing_entries
  for delete to authenticated using (user_id = (select auth.uid()));

create index writing_entries_user_time_idx
  on public.writing_entries (user_id, created_at desc);
