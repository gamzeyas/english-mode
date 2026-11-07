-- English Mode — Milestone 8: listening and pronunciation tasks in the
-- daily plan (chosen by the weekly focus).

alter table public.assignments drop constraint assignments_kind_check;
alter table public.assignments add constraint assignments_kind_check check (
  kind in (
    'review', 'conversation', 'roleplay', 'rewrite', 'interview_answer',
    'follow_up', 'listening', 'pronunciation'
  )
);
