-- ClimaZEN — Webhook ticket client → OT + e-mail (après site-portal.sql)
-- Option A (recommandé) : Supabase Dashboard → Database → Webhooks
--   Table : client_tickets | Event : INSERT
--   URL   : https://climazen.fr/api/process-client-ticket
--   Header: X-Ticket-Webhook-Secret = (même valeur que TICKET_WEBHOOK_SECRET sur Vercel)
--   Body  : {"ticketId": "{{ record.id }}"}
--
-- Option B : extension pg_net (ci-dessous) + secrets Supabase Vault

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_client_ticket_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  api_url text := coalesce(
    nullif(current_setting('app.climazen_api_url', true), ''),
    'https://climazen.fr'
  );
  webhook_secret text := coalesce(
    nullif(current_setting('app.ticket_webhook_secret', true), ''),
    ''
  );
  req_id bigint;
begin
  if webhook_secret = '' then
    raise notice 'ticket webhook: secret absent (app.ticket_webhook_secret) — configurez le webhook Dashboard ou ALTER DATABASE SET.';
    return new;
  end if;

  select net.http_post(
    url := api_url || '/api/process-client-ticket',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Ticket-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object('ticketId', new.id)
  ) into req_id;

  return new;
exception when others then
  raise notice 'ticket webhook pg_net: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists client_tickets_process_ot on public.client_tickets;
create trigger client_tickets_process_ot
  after insert on public.client_tickets
  for each row
  execute function public.notify_client_ticket_webhook();

-- Secrets (exemple — remplacez par vos valeurs, puis redémarrez la connexion) :
-- ALTER DATABASE postgres SET app.ticket_webhook_secret = 'votre-secret-long';
-- ALTER DATABASE postgres SET app.climazen_api_url = 'https://climazen.fr';
