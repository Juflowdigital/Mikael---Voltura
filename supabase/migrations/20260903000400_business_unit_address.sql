-- O gatilho nao copiava o endereco da empresa para a unidade principal,
-- deixando a unidade com pendencia fiscal mesmo quando a empresa tinha endereco.
create or replace function public.create_primary_business_unit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.business_units (organization_id, name, tax_id, address, city, state, utility_company, is_primary)
  values (new.id, new.name, new.tax_id, new.address, new.city, new.state, new.utility_company, true)
  on conflict (organization_id, name) do nothing;
  return new;
end;
$$;

-- Preenche o endereco das unidades principais ja criadas sem ele.
update public.business_units b
set address = o.address, updated_at = now()
from public.organizations o
where b.organization_id = o.id
  and b.is_primary
  and b.address is null
  and o.address is not null;
