-- English Mode — apply_review(): report stale card state with a custom
-- SQLSTATE (EM409). 40001 made PostgREST retry the transaction, so a stale
-- grade hung instead of failing fast with a conflict.

create or replace function public.apply_review(
  p_item_id uuid,
  p_client_request_id uuid,
  p_expected_state jsonb,
  p_previous_state jsonb,
  p_next_state jsonb,
  p_grade integer,
  p_response_text text,
  p_ai_suggested_grade integer,
  p_status text,
  p_due_at timestamptz,
  p_reviewed_at timestamptz
)
returns table (review_log_id uuid, due_at timestamptz, status text, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_current jsonb;
  v_log uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select li.fsrs_state into v_current
  from public.learning_items li
  where li.id = p_item_id and li.user_id = v_user
  for update;
  if not found then
    raise exception 'learning item not found' using errcode = 'P0002';
  end if;

  select rl.id into v_log
  from public.review_logs rl
  where rl.user_id = v_user and rl.client_request_id = p_client_request_id;
  if found then
    return query
      select v_log, li.due_at, li.status, true
      from public.learning_items li
      where li.id = p_item_id;
    return;
  end if;

  if v_current is distinct from p_expected_state then
    raise exception 'card state changed since it was loaded' using errcode = 'EM409';
  end if;

  insert into public.review_logs (
    user_id, learning_item_id, client_request_id, grade, response_text,
    ai_suggested_grade, previous_state, next_state, reviewed_at
  ) values (
    v_user, p_item_id, p_client_request_id, p_grade, p_response_text,
    p_ai_suggested_grade, p_previous_state, p_next_state, p_reviewed_at
  )
  returning id into v_log;

  update public.learning_items li
  set fsrs_state = p_next_state,
      due_at = p_due_at,
      status = p_status,
      last_reviewed_at = p_reviewed_at
  where li.id = p_item_id and li.user_id = v_user;

  return query select v_log, p_due_at, p_status, false;
end;
$$;
