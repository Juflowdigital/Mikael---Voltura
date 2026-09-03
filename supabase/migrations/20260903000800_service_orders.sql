-- Ordens de servico: a visita agendada. O chamado (service_tickets) registra
-- o problema; a OS registra a ida a campo para resolver.
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  order_number text not null,
  ticket_id uuid references public.service_tickets on delete set null,
  client_id uuid not null references public.clients,
  work_id uuid references public.works,
  kind text not null default 'corretiva' check(kind in ('corretiva','preventiva','garantia','instalacao')),
  status text not null default 'scheduled' check(status in ('scheduled','in_progress','done','cancelled')),
  scheduled_for date,
  technician_id uuid references public.profiles,
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, order_number)
);

alter table public.service_orders enable row level security;

create policy service_orders_select on public.service_orders
  for select to authenticated using(public.is_org_member(organization_id));
create policy service_orders_insert on public.service_orders
  for insert to authenticated
  with check(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]));
create policy service_orders_update on public.service_orders
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]));
create policy service_orders_delete on public.service_orders
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create index if not exists service_orders_org_idx on public.service_orders(organization_id);
create index if not exists service_orders_ticket_idx on public.service_orders(ticket_id);
