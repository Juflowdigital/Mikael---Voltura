alter table public.contracts
  add column if not exists title text,
  add column if not exists seller_id uuid references public.profiles,
  add column if not exists manager_id uuid references public.profiles,
  add column if not exists payment_terms text,
  add column if not exists installment_count integer check(installment_count between 1 and 120),
  add column if not exists execution_days integer check(execution_days > 0),
  add column if not exists commission_percent numeric(6,2) check(commission_percent >= 0),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.contract_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  contract_id uuid not null references public.contracts on delete cascade,
  item_type text not null,
  name text not null,
  quantity numeric(12,3) not null check(quantity > 0),
  unit_price numeric(14,2) not null default 0 check(unit_price >= 0),
  warranty_months integer check(warranty_months >= 0),
  created_at timestamptz not null default now()
);

alter table public.contract_items enable row level security;
create policy contract_items_select on public.contract_items for select to authenticated using(public.is_org_member(organization_id));
create policy contract_items_insert on public.contract_items for insert to authenticated with check(public.has_org_role(organization_id,array['admin','commercial']::public.app_role[]));
create policy contract_items_update on public.contract_items for update to authenticated using(public.has_org_role(organization_id,array['admin','commercial']::public.app_role[])) with check(public.has_org_role(organization_id,array['admin','commercial']::public.app_role[]));
create policy contract_items_delete on public.contract_items for delete to authenticated using(public.has_org_role(organization_id,array['admin']::public.app_role[]));

create index if not exists contract_items_contract_idx on public.contract_items(contract_id);
