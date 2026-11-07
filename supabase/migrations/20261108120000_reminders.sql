-- English Mode — daily reminders over Web Push (Milestone 8b).
--
-- Learners own their reminder preferences (time, weekdays, on/off). Push
-- subscriptions stay server-written (PRD §8). A pg_cron job pings the app's
-- reminder endpoint every 15 minutes; the endpoint decides who is due, so a
-- missed or repeated ping never sends a reminder twice in one local day.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.notification_preferences
  -- ISO weekdays (1 = Monday … 7 = Sunday) on which the reminder fires.
  add column weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  -- Learner-local day of the last reminder (server-written claim).
  add column last_reminded_on date,
  add constraint notification_preferences_weekdays_check check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]
  ),
  add constraint notification_preferences_channels_check check (
    channels <@ '{push}'::text[]
  );

grant update (weekdays) on public.notification_preferences to authenticated;

alter table public.push_subscriptions
  add column user_agent text check (char_length(user_agent) <= 300),
  add column last_success_at timestamptz;

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Scheduler. The endpoint URL and shared secret live in Vault and are set by
-- `pnpm push:setup` (service role only); until then the job is a no-op.
-- ---------------------------------------------------------------------------

create function public.configure_reminder_trigger(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_url !~ '^https://' or char_length(p_secret) < 32 then
    raise exception 'invalid reminder trigger configuration';
  end if;
  delete from vault.secrets
    where name in ('reminders_url', 'reminders_cron_secret');
  perform vault.create_secret(p_url, 'reminders_url');
  perform vault.create_secret(p_secret, 'reminders_cron_secret');
end;
$$;

revoke all on function public.configure_reminder_trigger(text, text)
  from public, anon, authenticated;
grant execute on function public.configure_reminder_trigger(text, text)
  to service_role;

select cron.schedule(
  'english-mode-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := s.url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || s.secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets
        where name = 'reminders_url') as url,
      (select decrypted_secret from vault.decrypted_secrets
        where name = 'reminders_cron_secret') as secret
  ) s
  where s.url is not null and s.secret is not null;
  $$
);
