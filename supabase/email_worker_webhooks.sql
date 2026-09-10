-- YuhBusiness email worker webhooks
-- Run this in Supabase SQL Editor after replacing the two placeholders below.
-- Do not commit real URLs, API keys, or webhook secrets to this file.
-- The deployed application must expose:
--   POST https://YOUR-DEPLOYED-DOMAIN.com/api/email/process
-- with EMAIL_WEBHOOK_SECRET set to the same secret below.

begin;

-- Store the production webhook URL and secret securely in Supabase Vault.
-- Replace both placeholder values before running this file.
select vault.create_secret(
  'https://YOUR-DEPLOYED-DOMAIN.com/api/email/process',
  'yuhbusiness_email_webhook_url'
);

select vault.create_secret(
  'PASTE_A_LONG_RANDOM_WEBHOOK_SECRET',
  'yuhbusiness_email_webhook_secret'
);

-- Send a request to the Next.js email worker after a queue row is inserted.
create or replace function public.notify_email_worker()
returns trigger
language plpgsql
security definer
set search_path = public
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

  if worker_url is null or webhook_secret is null then
    raise warning 'Email worker webhook secrets are not configured.';
    return new;
  end if;

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

  return new;
end;
$$;

drop trigger if exists trg_notify_transactional_email_worker
on public.transactional_email_deliveries;

create trigger trg_notify_transactional_email_worker
after insert on public.transactional_email_deliveries
for each row
execute function public.notify_email_worker();

drop trigger if exists trg_notify_order_email_worker
on public.order_email_deliveries;

create trigger trg_notify_order_email_worker
after insert on public.order_email_deliveries
for each row
execute function public.notify_email_worker();

drop trigger if exists trg_notify_appointment_email_worker
on public.appointment_email_deliveries;

create trigger trg_notify_appointment_email_worker
after insert on public.appointment_email_deliveries
for each row
execute function public.notify_email_worker();

commit;

-- Check recent webhook requests after inserting a test queue row:
-- select id, status_code, timed_out, error_msg, created
-- from net._http_response
-- order by created desc
-- limit 20;
