-- Send after commit for every approval path, including mobile and profile edits.
create or replace function public.queue_account_approval_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text <> 'active' or new.welcome_email_sent_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then
      return new;
    end if;
  end if;
  perform net.http_post(
    url := 'https://tvibndejhjwlheqjcstj.supabase.co/functions/v1/send-welcome-email',
    body := jsonb_build_object('access_account_id', new.id),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
  return new;
end;
$$;
-- Trigger-only function: do not expose privileged execution through the Data API.
revoke all on function public.queue_account_approval_email() from public, anon, authenticated;
create trigger automatic_account_approval_email
after insert or update of status on public.access_accounts
for each row execute function public.queue_account_approval_email();
