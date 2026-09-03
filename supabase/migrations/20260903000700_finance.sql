-- Centros de custo, notas fiscais e base de conciliacao bancaria.

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  code text not null,
  name text not null,
  kind text not null default 'both' check(kind in ('income','expense','both')),
  monthly_budget numeric(14,2) not null default 0 check(monthly_budget >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, code)
);

alter table public.financial_transactions
  add column if not exists cost_center_id uuid references public.cost_centers on delete set null;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  number text not null,
  series text,
  kind text not null default 'nfe' check(kind in ('nfe','nfse')),
  client_id uuid references public.clients,
  contract_id uuid references public.contracts,
  issue_date date not null default current_date,
  total_value numeric(14,2) not null default 0 check(total_value >= 0),
  status text not null default 'draft' check(status in ('draft','issued','cancelled','error')),
  access_key text,
  document_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, kind, number)
);

-- Linhas do extrato bancario, para conferir contra os lancamentos.
create table if not exists public.bank_statement_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  account_id uuid not null references public.financial_accounts on delete cascade,
  occurred_at date not null,
  description text not null,
  amount numeric(14,2) not null check(amount > 0),
  direction public.finance_direction not null,
  bank_reference text,
  matched_transaction_id uuid references public.financial_transactions on delete set null,
  reconciled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.cost_centers enable row level security;
alter table public.invoices enable row level security;
alter table public.bank_statement_entries enable row level security;

create policy cost_centers_select on public.cost_centers
  for select to authenticated using(public.is_org_member(organization_id));
create policy cost_centers_insert on public.cost_centers
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));
create policy cost_centers_update on public.cost_centers
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));
create policy cost_centers_delete on public.cost_centers
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy invoices_select on public.invoices
  for select to authenticated using(public.is_org_member(organization_id));
create policy invoices_insert on public.invoices
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));
create policy invoices_update on public.invoices
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));
create policy invoices_delete on public.invoices
  for delete to authenticated using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy bank_statement_entries_select on public.bank_statement_entries
  for select to authenticated using(public.is_org_member(organization_id));
create policy bank_statement_entries_insert on public.bank_statement_entries
  for insert to authenticated with check(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));
create policy bank_statement_entries_update on public.bank_statement_entries
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));
create policy bank_statement_entries_delete on public.bank_statement_entries
  for delete to authenticated using(public.has_org_role(organization_id, array['admin','finance']::public.app_role[]));

create index if not exists cost_centers_org_idx on public.cost_centers(organization_id);
create index if not exists invoices_org_idx on public.invoices(organization_id);
create index if not exists bank_statement_entries_account_idx on public.bank_statement_entries(account_id);
create index if not exists financial_transactions_cost_center_idx on public.financial_transactions(cost_center_id);
