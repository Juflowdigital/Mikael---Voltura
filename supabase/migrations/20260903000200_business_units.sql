-- Unidades de Negocio: entidade propria, como em Administracao > Minha Empresa.
-- Ate aqui o sistema guardava apenas um texto livre em organizations.branches,
-- que continua intacto para nao quebrar o app anterior.
create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name text not null,
  tax_id text,
  address text,
  city text,
  state char(2),
  utility_company text,
  is_primary boolean not null default false,
  -- Itens fiscais ainda pendentes de preenchimento (coluna "Prontidao fiscal").
  fiscal_pending jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);

alter table public.business_units enable row level security;

create policy business_units_select on public.business_units
  for select to authenticated using(public.is_org_member(organization_id));

create policy business_units_insert on public.business_units
  for insert to authenticated
  with check(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy business_units_update on public.business_units
  for update to authenticated
  using(public.has_org_role(organization_id, array['admin']::public.app_role[]))
  with check(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create policy business_units_delete on public.business_units
  for delete to authenticated
  using(public.has_org_role(organization_id, array['admin']::public.app_role[]));

create index if not exists business_units_org_idx on public.business_units(organization_id);

-- Cada organizacao nasce com a unidade principal espelhando os dados da empresa.
insert into public.business_units (organization_id, name, tax_id, city, state, utility_company, is_primary)
select o.id, o.name, o.tax_id, o.city, o.state, o.utility_company, true
from public.organizations o
where not exists (select 1 from public.business_units b where b.organization_id = o.id);
