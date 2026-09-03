-- Toda organizacao nova nasce com sua unidade de negocio principal.
-- Sem isso, uma empresa recem-criada ficaria sem unidade e sem prontidao fiscal.
create or replace function public.create_primary_business_unit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.business_units (organization_id, name, tax_id, city, state, utility_company, is_primary)
  values (new.id, new.name, new.tax_id, new.city, new.state, new.utility_company, true)
  on conflict (organization_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_create_primary_unit on public.organizations;

create trigger organizations_create_primary_unit
  after insert on public.organizations
  for each row execute function public.create_primary_business_unit();

-- Cobre organizacoes criadas entre a migracao anterior e esta.
insert into public.business_units (organization_id, name, tax_id, city, state, utility_company, is_primary)
select o.id, o.name, o.tax_id, o.city, o.state, o.utility_company, true
from public.organizations o
where not exists (select 1 from public.business_units b where b.organization_id = o.id);
