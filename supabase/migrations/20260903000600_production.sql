-- Producao, requisicoes de material e apontamentos logisticos.
create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  code text not null,
  client_id uuid not null references public.clients,
  contract_id uuid references public.contracts,
  business_unit_id uuid references public.business_units,
  manager_id uuid references public.profiles,
  stage text not null default 'a-produzir' check(stage in ('a-produzir','em-producao','concluida','cancelada')),
  purchase_flow text not null default 'nao-iniciado' check(purchase_flow in ('nao-iniciado','em-andamento','concluido')),
  shipping_flow text not null default 'nao-iniciado' check(shipping_flow in ('nao-iniciado','em-andamento','concluido')),
  conflicts jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, code)
);

create table if not exists public.material_requisitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  number text not null,
  work_id uuid references public.works,
  production_order_id uuid references public.production_orders on delete set null,
  requested_by uuid references public.profiles,
  status text not null default 'open' check(status in ('open','approved','separated','delivered','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, number)
);

create table if not exists public.material_requisition_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  requisition_id uuid not null references public.material_requisitions on delete cascade,
  inventory_item_id uuid not null references public.inventory_items,
  quantity numeric(14,3) not null check(quantity > 0),
  delivered_quantity numeric(14,3) not null default 0 check(delivered_quantity >= 0),
  created_at timestamptz not null default now(),
  unique(requisition_id, inventory_item_id)
);

create table if not exists public.logistics_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  work_id uuid references public.works,
  production_order_id uuid references public.production_orders on delete set null,
  kind text not null check(kind in ('expedicao','entrega','coleta','devolucao')),
  occurred_at timestamptz not null default now(),
  vehicle text,
  driver text,
  notes text,
  created_by uuid references public.profiles,
  created_at timestamptz not null default now()
);

alter table public.production_orders enable row level security;
alter table public.material_requisitions enable row level security;
alter table public.material_requisition_items enable row level security;
alter table public.logistics_entries enable row level security;

create policy production_orders_select on public.production_orders
  for select to authenticated using(public.is_org_member(organization_id));
create policy production_orders_insert on public.production_orders
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]));
create policy production_orders_update on public.production_orders
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]));
create policy production_orders_delete on public.production_orders
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy material_requisitions_select on public.material_requisitions
  for select to authenticated using(public.is_org_member(organization_id));
create policy material_requisitions_insert on public.material_requisitions
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]));
create policy material_requisitions_update on public.material_requisitions
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]));
create policy material_requisitions_delete on public.material_requisitions
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy material_requisition_items_select on public.material_requisition_items
  for select to authenticated using(public.is_org_member(organization_id));
create policy material_requisition_items_insert on public.material_requisition_items
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]));
create policy material_requisition_items_update on public.material_requisition_items
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]));
create policy material_requisition_items_delete on public.material_requisition_items
  for delete to authenticated using(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]));

create policy logistics_entries_select on public.logistics_entries
  for select to authenticated using(public.is_org_member(organization_id));
create policy logistics_entries_insert on public.logistics_entries
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','engineering','installer']::public.app_role[]));
create policy logistics_entries_update on public.logistics_entries
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]));
create policy logistics_entries_delete on public.logistics_entries
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create index if not exists production_orders_org_idx on public.production_orders(organization_id);
create index if not exists material_requisitions_org_idx on public.material_requisitions(organization_id);
create index if not exists material_requisition_items_req_idx on public.material_requisition_items(requisition_id);
create index if not exists logistics_entries_org_idx on public.logistics_entries(organization_id);
