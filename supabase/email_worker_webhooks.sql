begin;

-- ----------------------------------------------------------------------------
-- 1. Store the centralized worker URL in Supabase Vault.
--
-- vault.create_secret() creates a new Vault secret. On an already-configured
-- production database, do not repeatedly run this setup file just to change
-- values. Existing Vault state should be inspected first during the final
-- migration/configuration pass.
-- ----------------------------------------------------------------------------

select vault.create_secret(
  'https://YOUR-DEPLOYED-DOMAIN.com/api/email/process',
  'yuhbusiness_email_webhook_url'
);

-- ----------------------------------------------------------------------------
-- 2. Store the webhook authorization secret.
--
-- This value must exactly match EMAIL_WEBHOOK_SECRET in the deployed Next.js
-- application's server environment.
-- ----------------------------------------------------------------------------

select vault.create_secret(
  'PASTE_A_LONG_RANDOM_WEBHOOK_SECRET',
  'yuhbusiness_email_webhook_secret'
);

-- ----------------------------------------------------------------------------
-- 3. Trigger function used by all centralized email queue tables.
--
-- SECURITY
--   SECURITY DEFINER is required because the trigger must read decrypted Vault
--   values and invoke pg_net independently of the inserting user's privileges.
--
--   The search_path is deliberately restricted. Extension-owned objects are
--   referenced with explicit schemas (vault / net).
--
-- BEHAVIOR
--   The webhook body is only a wake-up signal. The Next.js worker does not
--   trust record_id or table for delivery authorization. It claims queued jobs
--   from Supabase and reloads authoritative source records before sending.
--
-- FAILURE BEHAVIOR
--   pg_net is asynchronous. net.http_post() queues the HTTP request rather than
--   waiting for the remote application to finish processing the email queue.
-- ----------------------------------------------------------------------------

create or replace function public.notify_email_worker()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  worker_url text;
  webhook_secret text;
begin
  select decrypted_secret
    into worker_url
  from vault.decrypted_secrets
  where name = 'yuhbusiness_email_webhook_url'
  limit 1;

  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'yuhbusiness_email_webhook_secret'
  limit 1;

  -- A missing configuration should not block the transaction that created the
  -- email queue row. The scheduled cron worker remains the recovery path.
  if nullif(btrim(worker_url), '') is null
     or nullif(btrim(webhook_secret), '') is null then
    raise warning
      'YuhBusiness email worker webhook URL or secret is not configured.';

    return new;
  end if;

  -- Reject obviously unsafe/mistyped destinations before placing a pg_net
  -- request. Production should use HTTPS.
  if worker_url !~* '^https://[^[:space:]]+$' then
    raise warning
      'YuhBusiness email worker webhook URL must be a valid HTTPS URL.';

    return new;
  end if;

  begin
    perform net.http_post(
      url := worker_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || webhook_secret,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'table', tg_table_name,
        'record_id', new.id
      ),
      timeout_milliseconds := 10000
    );
  exception
    when others then
      -- Webhook wake-up failure must not roll back the business transaction or
      -- delete/lose the queued email. The cron processor can pick it up later.
      raise warning
        'Unable to enqueue YuhBusiness email worker webhook for table %.',
        tg_table_name;
  end;

  return new;
end;
$$;

-- The trigger function is infrastructure-only. Application users should not
-- invoke it directly.
revoke all on function public.notify_email_worker() from public;
revoke all on function public.notify_email_worker() from anon;
revoke all on function public.notify_email_worker() from authenticated;

-- ----------------------------------------------------------------------------
-- 4. Transactional email queue
-- ----------------------------------------------------------------------------

drop trigger if exists trg_notify_transactional_email_worker
on public.transactional_email_deliveries;

create trigger trg_notify_transactional_email_worker
after insert on public.transactional_email_deliveries
for each row
execute function public.notify_email_worker();

-- ----------------------------------------------------------------------------
-- 5. Order email queue
-- ----------------------------------------------------------------------------

drop trigger if exists trg_notify_order_email_worker
on public.order_email_deliveries;

create trigger trg_notify_order_email_worker
after insert on public.order_email_deliveries
for each row
execute function public.notify_email_worker();

-- ----------------------------------------------------------------------------
-- 6. Appointment email queue
-- ----------------------------------------------------------------------------

drop trigger if exists trg_notify_appointment_email_worker
on public.appointment_email_deliveries;

create trigger trg_notify_appointment_email_worker
after insert on public.appointment_email_deliveries
for each row
execute function public.notify_email_worker();

commit;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- Run these manually after the final migration/configuration phase.
--
-- Confirm the three centralized-worker triggers:
--
-- select
--   event_object_table,
--   trigger_name
-- from information_schema.triggers
-- where trigger_schema = 'public'
--   and trigger_name in (
--     'trg_notify_transactional_email_worker',
--     'trg_notify_order_email_worker',
--     'trg_notify_appointment_email_worker'
--   )
-- order by event_object_table;
--
-- Check recent pg_net responses after inserting a test queue row:
--
-- select
--   id,
--   status_code,
--   timed_out,
--   error_msg,
--   created
-- from net._http_response
-- order by created desc
-- limit 20;
--
-- SECURITY NOTE
--   Do not select decrypted_secret values into screenshots/logs while testing.
-- ============================================================================
