-- Produtos compostos ("Gerador Completo"): um produto agrega painel, inversor
-- e estrutura. inventory_items continua sendo o item de estoque unitario.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  kind text not null default 'gerador' check(kind in ('gerador','componente','servico')),
  generator_type text check(generator_type in ('ongrid','hibrido','offgrid')),
  name text not null,
  unit text not null default 'Conjunto',
  category text,
  active boolean not null default true,
  total_power_wp numeric(12,2) not null default 0 check(total_power_wp >= 0),
  kit_price numeric(14,2) not null default 0 check(kit_price >= 0),
  -- garantias, tributacao e anexos, na mesma estrutura das abas do cadastro
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);

create table if not exists public.product_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  component_type text not null check(component_type in ('painel','inversor','estrutura','stringbox','otimizador','servico')),
  brand text,
  model text,
  quantity numeric(12,3) not null default 1 check(quantity > 0),
  -- painel em W, inversor em kW; a unidade depende do component_type
  power numeric(12,3),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.product_components enable row level security;

create policy products_select on public.products
  for select to authenticated using(public.is_org_member(organization_id));
create policy products_insert on public.products
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','commercial','engineering']::public.app_role[]));
create policy products_update on public.products
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','commercial','engineering']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','commercial','engineering']::public.app_role[]));
create policy products_delete on public.products
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy product_components_select on public.product_components
  for select to authenticated using(public.is_org_member(organization_id));
create policy product_components_insert on public.product_components
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','commercial','engineering']::public.app_role[]));
create policy product_components_update on public.product_components
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','commercial','engineering']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','commercial','engineering']::public.app_role[]));
create policy product_components_delete on public.product_components
  for delete to authenticated using(public.has_org_role(organization_id, array['admin','engineering']::public.app_role[]));

create index if not exists products_org_idx on public.products(organization_id);
create index if not exists product_components_product_idx on public.product_components(product_id);
