-- Creates the client, contract, technical items and payment schedule atomically.
-- This avoids partially-created contracts when any dependent insert fails.
create or replace function public.create_contract_bundle(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (p_data->>'organization_id')::uuid;
  v_client uuid;
  v_contract uuid;
  v_tax_id text := nullif(regexp_replace(coalesce(p_data->>'tax_id',''), '\D', '', 'g'), '');
  v_total numeric(14,2) := (p_data->>'total_value')::numeric;
  v_count integer := greatest(1, least(120, coalesce((p_data->>'installment_count')::integer, 1)));
  v_base numeric(14,2);
  v_item jsonb;
  v_i integer;
begin
  if not public.has_org_role(v_org, array['admin','commercial']::public.app_role[]) then
    raise exception 'Sem permissão para criar contratos nesta organização';
  end if;
  if coalesce(trim(p_data->>'client_name'),'') = '' or coalesce(trim(p_data->>'title'),'') = '' or v_total <= 0 then
    raise exception 'Cliente, título e valor positivo são obrigatórios';
  end if;

  if v_tax_id is not null then
    select id into v_client from public.clients where organization_id=v_org and tax_id=v_tax_id;
  end if;
  if v_client is null then
    insert into public.clients(organization_id,name,person_type,tax_id,email,phone,address,owner_id)
    values(v_org,trim(p_data->>'client_name'),case when length(v_tax_id)=14 then 'company' else 'individual' end,
      v_tax_id,nullif(p_data->>'email',''),nullif(p_data->>'phone',''),
      jsonb_build_object('full',coalesce(p_data->>'address','')),(select auth.uid()))
    returning id into v_client;
  else
    update public.clients set
      name=trim(p_data->>'client_name'),
      email=coalesce(nullif(p_data->>'email',''),email),
      phone=coalesce(nullif(p_data->>'phone',''),phone),
      address=case when coalesce(p_data->>'address','')<>'' then jsonb_build_object('full',p_data->>'address') else address end
    where id=v_client;
  end if;

  insert into public.contracts(organization_id,contract_number,client_id,status,total_value,title,payment_terms,
    installment_count,execution_days,commission_percent,metadata,seller_id,manager_id)
  values(v_org,trim(p_data->>'contract_number'),v_client,'draft',v_total,trim(p_data->>'title'),
    nullif(p_data->>'payment_terms',''),v_count,nullif(p_data->>'execution_days','')::integer,
    coalesce(nullif(p_data->>'commission_percent','')::numeric,0),coalesce(p_data->'metadata','{}'::jsonb),
    nullif(p_data->>'seller_id','')::uuid,nullif(p_data->>'manager_id','')::uuid)
  returning id into v_contract;

  for v_item in select value from jsonb_array_elements(coalesce(p_data->'items','[]'::jsonb)) loop
    if coalesce(trim(v_item->>'name'),'')<>'' and coalesce((v_item->>'quantity')::numeric,0)>0 then
      insert into public.contract_items(organization_id,contract_id,item_type,name,quantity,unit_price,warranty_months)
      values(v_org,v_contract,coalesce(nullif(v_item->>'item_type',''),'Produto'),trim(v_item->>'name'),
        (v_item->>'quantity')::numeric,coalesce((v_item->>'unit_price')::numeric,0),nullif(v_item->>'warranty_months','')::integer);
    end if;
  end loop;

  v_base := trunc((v_total/v_count)*100)/100;
  for v_i in 1..v_count loop
    insert into public.installments(organization_id,contract_id,installment_number,total_installments,amount,due_date,status)
    values(v_org,v_contract,v_i,v_count,
      case when v_i=v_count then v_total-(v_base*(v_count-1)) else v_base end,
      (current_date+((v_i-1)||' month')::interval)::date,'pending');
  end loop;

  return jsonb_build_object('contract_id',v_contract,'client_id',v_client,'contract_number',p_data->>'contract_number');
end;
$$;

revoke all on function public.create_contract_bundle(jsonb) from public;
grant execute on function public.create_contract_bundle(jsonb) to authenticated;
