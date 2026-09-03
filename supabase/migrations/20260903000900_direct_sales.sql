-- Vendas avulsas: venda de produto ou servico sem contrato de sistema solar.
create table if not exists public.direct_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  sale_number text not null,
  client_id uuid references public.clients,
  seller_id uuid references public.profiles,
  status text not null default 'draft' check(status in ('draft','confirmed','delivered','cancelled')),
  sold_at date not null default current_date,
  total_value numeric(14,2) not null default 0 check(total_value >= 0),
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, sale_number)
);

create table if not exists public.direct_sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  sale_id uuid not null references public.direct_sales on delete cascade,
  inventory_item_id uuid references public.inventory_items,
  description text not null,
  quantity numeric(12,3) not null check(quantity > 0),
  unit_price numeric(14,2) not null default 0 check(unit_price >= 0),
  created_at timestamptz not null default now()
);

-- Cargo do colaborador, exibido em Recursos Humanos.
alter table public.organization_members
  add column if not exists job_title text;

alter table public.direct_sales enable row level security;
alter table public.direct_sale_items enable row level security;

create policy direct_sales_select on public.direct_sales
  for select to authenticated using(public.is_org_member(organization_id));
create policy direct_sales_insert on public.direct_sales
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','commercial','finance']::public.app_role[]));
create policy direct_sales_update on public.direct_sales
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','commercial','finance']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','commercial','finance']::public.app_role[]));
create policy direct_sales_delete on public.direct_sales
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy direct_sale_items_select on public.direct_sale_items
  for select to authenticated using(public.is_org_member(organization_id));
create policy direct_sale_items_insert on public.direct_sale_items
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','commercial','finance']::public.app_role[]));
create policy direct_sale_items_update on public.direct_sale_items
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','commercial','finance']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','commercial','finance']::public.app_role[]));
create policy direct_sale_items_delete on public.direct_sale_items
  for delete to authenticated using(public.has_org_role(organization_id, array['admin','commercial']::public.app_role[]));

create index if not exists direct_sales_org_idx on public.direct_sales(organization_id);
create index if not exists direct_sale_items_sale_idx on public.direct_sale_items(sale_id);
