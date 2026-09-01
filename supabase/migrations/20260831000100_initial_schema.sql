begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','commercial','engineering','installer','finance','viewer');
create type public.crm_stage as enum ('lead','qualified','site_visit','proposal_sent','negotiation','won','lost');
create type public.record_status as enum ('draft','pending','active','completed','cancelled');
create type public.finance_direction as enum ('income','expense');
create type public.payment_status as enum ('pending','paid','overdue','cancelled');
create type public.priority_level as enum ('low','medium','high','critical');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, legal_name text,
  tax_id text unique, city text, state char(2), utility_company text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null, phone text, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'viewer', job_title text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=(select auth.uid()) and m.active)
$$;
create or replace function public.has_org_role(org_id uuid, allowed public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=(select auth.uid()) and m.active and m.role=any(allowed))
$$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid,public.app_role[]) from public;
grant execute on function public.is_org_member(uuid), public.has_org_role(uuid,public.app_role[]) to authenticated;

create table public.clients (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 name text not null, person_type text not null default 'individual' check(person_type in ('individual','company')),
 tax_id text, email text, phone text, address jsonb not null default '{}'::jsonb, city text, state char(2),
 utility_company text, service_voltage text, monthly_consumption_kwh numeric(12,2) check(monthly_consumption_kwh>=0),
 owner_id uuid references public.profiles, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,tax_id)
);
create table public.leads (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid references public.clients on delete set null, name text not null, email text, phone text, city text,
 customer_type text, source text, stage public.crm_stage not null default 'lead', estimated_value numeric(14,2) check(estimated_value>=0),
 loss_reason text, assigned_to uuid references public.profiles, next_action_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.crm_activities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 lead_id uuid references public.leads on delete cascade, client_id uuid references public.clients on delete cascade,
 kind text not null, subject text not null, description text, occurred_at timestamptz not null default now(), created_by uuid references public.profiles,
 created_at timestamptz not null default now(), check(lead_id is not null or client_id is not null)
);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid not null references public.clients, lead_id uuid references public.leads,
 monthly_consumption_kwh numeric(12,2) not null check(monthly_consumption_kwh>0), system_power_kwp numeric(10,3) not null check(system_power_kwp>0),
 module_count integer not null check(module_count>0), module_power_w integer not null check(module_power_w>0), inverter_power_kw numeric(10,3),
 estimated_generation_kwh numeric(12,2), roof_area_m2 numeric(10,2), estimated_price numeric(14,2), payback_years numeric(5,2), assumptions jsonb not null default '{}'::jsonb,
 created_by uuid references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.proposals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 proposal_number text not null, client_id uuid not null references public.clients, budget_id uuid references public.budgets,
 status text not null default 'draft' check(status in ('draft','sent','viewed','accepted','rejected','expired')),
 total_value numeric(14,2) not null check(total_value>=0), valid_until date, sent_at timestamptz, accepted_at timestamptz,
 created_by uuid references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,proposal_number)
);
create table public.proposal_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 proposal_id uuid not null references public.proposals on delete cascade, version integer not null check(version>0), content jsonb not null default '{}'::jsonb,
 pdf_path text, created_by uuid references public.profiles, created_at timestamptz not null default now(), unique(proposal_id,version)
);
create table public.contracts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 contract_number text not null, client_id uuid not null references public.clients, proposal_id uuid references public.proposals,
 status text not null default 'draft' check(status in ('draft','sent','partially_signed','signed','cancelled')),
 total_value numeric(14,2) not null check(total_value>=0), signed_at timestamptz, document_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,contract_number)
);
create table public.contract_signatures (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 contract_id uuid not null references public.contracts on delete cascade, signer_name text not null, signer_email text not null,
 signed_at timestamptz, ip_address inet, user_agent text, created_at timestamptz not null default now()
);

create table public.homologations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid not null references public.clients, contract_id uuid references public.contracts, utility_company text not null,
 protocol text, status text not null default 'documents', deadline date, access_opinion_expires_at date,
 responsible_id uuid references public.profiles, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,protocol)
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid references public.clients, homologation_id uuid references public.homologations on delete cascade,
 kind text not null, name text not null, storage_path text not null, mime_type text, uploaded_by uuid references public.profiles,
 created_at timestamptz not null default now()
);
create table public.works (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 work_number text not null, client_id uuid not null references public.clients, contract_id uuid references public.contracts,
 name text not null, status text not null default 'planning' check(status in ('planning','separation','mobilization','installation','commissioning','delivery','completed','paused','cancelled')),
 system_power_kwp numeric(10,3), address jsonb not null default '{}'::jsonb, latitude numeric(9,6), longitude numeric(9,6),
 planned_start date, planned_end date, actual_start date, actual_end date, budgeted_cost numeric(14,2), actual_cost numeric(14,2) not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,work_number)
);
create table public.work_assignments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 work_id uuid not null references public.works on delete cascade, user_id uuid not null references public.profiles, assignment_role text not null,
 starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), unique(work_id,user_id,assignment_role)
);
create table public.work_checklist_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 work_id uuid not null references public.works on delete cascade, title text not null, stage text not null, position integer not null default 0,
 completed boolean not null default false, completed_by uuid references public.profiles, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.work_photos (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 work_id uuid not null references public.works on delete cascade, checklist_item_id uuid references public.work_checklist_items on delete set null,
 stage text not null, storage_path text not null, latitude numeric(9,6), longitude numeric(9,6), captured_at timestamptz not null default now(), uploaded_by uuid references public.profiles
);
create table public.field_checkins (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 work_id uuid not null references public.works on delete cascade, user_id uuid not null references public.profiles,
 kind text not null check(kind in ('checkin','checkout')), latitude numeric(9,6) not null, longitude numeric(9,6) not null,
 occurred_at timestamptz not null default now()
);

create table public.suppliers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 name text not null, tax_id text, email text, phone text, lead_time_days integer check(lead_time_days>=0), rating numeric(3,2) check(rating between 0 and 5),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,tax_id)
);
create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 order_number text not null, supplier_id uuid not null references public.suppliers, work_id uuid references public.works,
 status text not null default 'draft' check(status in ('draft','quoted','approved','ordered','partially_received','received','cancelled')),
 total_value numeric(14,2) not null default 0 check(total_value>=0), expected_at date, approved_by uuid references public.profiles,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,order_number)
);
create table public.inventory_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 sku text not null, name text not null, category text, unit text not null default 'un', barcode text,
 quantity numeric(14,3) not null default 0, minimum_quantity numeric(14,3) not null default 0, average_cost numeric(14,2) not null default 0,
 location text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,sku), unique(organization_id,barcode)
);
create table public.purchase_order_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 purchase_order_id uuid not null references public.purchase_orders on delete cascade, inventory_item_id uuid not null references public.inventory_items,
 quantity numeric(14,3) not null check(quantity>0), unit_price numeric(14,2) not null check(unit_price>=0), received_quantity numeric(14,3) not null default 0,
 created_at timestamptz not null default now(), unique(purchase_order_id,inventory_item_id)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 inventory_item_id uuid not null references public.inventory_items, work_id uuid references public.works, purchase_order_id uuid references public.purchase_orders,
 movement_type text not null check(movement_type in ('in','out','reserve','release','adjustment','transfer')),
 quantity numeric(14,3) not null check(quantity<>0), unit_cost numeric(14,2), notes text, performed_by uuid references public.profiles,
 occurred_at timestamptz not null default now()
);
create table public.assets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 asset_tag text not null, name text not null, category text not null, serial_number text, status text not null default 'available',
 responsible_id uuid references public.profiles, work_id uuid references public.works, location text, acquisition_date date, acquisition_value numeric(14,2),
 next_maintenance_at date, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,asset_tag)
);
create table public.asset_maintenances (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 asset_id uuid not null references public.assets on delete cascade, description text not null, status public.record_status not null default 'pending',
 scheduled_at date, completed_at date, cost numeric(14,2), provider text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.financial_accounts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 name text not null, bank_name text, account_type text, opening_balance numeric(14,2) not null default 0, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);
create table public.financial_transactions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 account_id uuid references public.financial_accounts, client_id uuid references public.clients, supplier_id uuid references public.suppliers,
 work_id uuid references public.works, contract_id uuid references public.contracts, direction public.finance_direction not null,
 category text not null, description text not null, amount numeric(14,2) not null check(amount>0), due_date date not null,
 paid_at timestamptz, status public.payment_status not null default 'pending', payment_method text, document_path text,
 created_by uuid references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.installments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 contract_id uuid not null references public.contracts on delete cascade, transaction_id uuid unique references public.financial_transactions on delete set null,
 installment_number integer not null check(installment_number>0), total_installments integer not null check(total_installments>=installment_number),
 amount numeric(14,2) not null check(amount>0), due_date date not null, paid_at timestamptz, status public.payment_status not null default 'pending',
 payment_method text, receipt_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(contract_id,installment_number)
);
create table public.commissions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 user_id uuid not null references public.profiles, contract_id uuid not null references public.contracts,
 rate numeric(7,4) not null check(rate between 0 and 1), amount numeric(14,2) not null check(amount>=0), status public.payment_status not null default 'pending',
 paid_at timestamptz, created_at timestamptz not null default now(), unique(user_id,contract_id)
);

create table public.om_contracts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid not null references public.clients, work_id uuid references public.works, plan_name text not null,
 frequency text not null, amount numeric(14,2) not null check(amount>=0), starts_on date not null, ends_on date, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.service_tickets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 ticket_number text not null, client_id uuid not null references public.clients, work_id uuid references public.works,
 title text not null, description text, priority public.priority_level not null default 'medium', status text not null default 'open',
 assigned_to uuid references public.profiles, sla_due_at timestamptz, resolved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,ticket_number)
);
create table public.energy_generation (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 work_id uuid not null references public.works, reference_month date not null, projected_kwh numeric(14,2), generated_kwh numeric(14,2) not null check(generated_kwh>=0),
 source text not null default 'manual', recorded_by uuid references public.profiles, created_at timestamptz not null default now(), unique(work_id,reference_month)
);
create table public.warranties (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid not null references public.clients, work_id uuid references public.works, kind text not null, manufacturer text,
 serial_number text, starts_on date not null, ends_on date not null check(ends_on>=starts_on), document_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nps_responses (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 client_id uuid not null references public.clients, work_id uuid references public.works, score smallint not null check(score between 0 and 10),
 comment text, responded_at timestamptz not null default now()
);
create table public.sales_goals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 user_id uuid not null references public.profiles, reference_month date not null, target_kwp numeric(12,3) check(target_kwp>=0),
 target_revenue numeric(14,2) check(target_revenue>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,user_id,reference_month)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
 user_id uuid references public.profiles on delete cascade, title text not null, body text not null, severity text not null default 'info',
 entity_type text, entity_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.organization_settings (
 organization_id uuid primary key references public.organizations on delete cascade, calculation jsonb not null default '{}'::jsonb,
 alerts jsonb not null default '{}'::jsonb, integrations jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations on delete cascade,
 user_id uuid references public.profiles on delete set null, action text not null, entity_type text not null, entity_id uuid,
 old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array[
 'organizations','profiles','organization_members','clients','leads','budgets','proposals','contracts','homologations','works',
 'work_checklist_items','suppliers','purchase_orders','inventory_items','assets','asset_maintenances','financial_accounts',
 'financial_transactions','installments','om_contracts','service_tickets','warranties','sales_goals'
] loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t); end loop; end $$;
create trigger set_updated_at before update on public.organization_settings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Índices para FKs, filtros de status, datas e busca operacional.
create index clients_org_name_idx on public.clients(organization_id,name);
create index leads_org_stage_idx on public.leads(organization_id,stage);
create index leads_assigned_idx on public.leads(assigned_to,updated_at desc);
create index crm_activities_lead_date_idx on public.crm_activities(lead_id,occurred_at desc);
create index proposals_client_status_idx on public.proposals(client_id,status);
create index contracts_client_status_idx on public.contracts(client_id,status);
create index homologations_org_deadline_idx on public.homologations(organization_id,deadline);
create index works_org_status_idx on public.works(organization_id,status);
create index work_assignments_user_idx on public.work_assignments(user_id,work_id);
create index checklist_work_position_idx on public.work_checklist_items(work_id,position);
create index purchase_orders_supplier_status_idx on public.purchase_orders(supplier_id,status);
create index inventory_movements_item_date_idx on public.inventory_movements(inventory_item_id,occurred_at desc);
create index financial_transactions_org_due_idx on public.financial_transactions(organization_id,status,due_date);
create index installments_due_idx on public.installments(organization_id,status,due_date);
create index tickets_org_status_sla_idx on public.service_tickets(organization_id,status,sla_due_at);
create index notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create index audit_logs_org_date_idx on public.audit_logs(organization_id,created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
create policy organizations_select on public.organizations for select to authenticated using(public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated using(public.has_org_role(id,array['admin']::public.app_role[])) with check(public.has_org_role(id,array['admin']::public.app_role[]));
create policy profiles_select on public.profiles for select to authenticated using(id=(select auth.uid()) or exists(select 1 from public.organization_members mine join public.organization_members theirs using(organization_id) where mine.user_id=(select auth.uid()) and theirs.user_id=profiles.id and mine.active and theirs.active));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy members_select on public.organization_members for select to authenticated using(public.is_org_member(organization_id));
create policy members_admin_all on public.organization_members for all to authenticated using(public.has_org_role(organization_id,array['admin']::public.app_role[])) with check(public.has_org_role(organization_id,array['admin']::public.app_role[]));

-- Todas as tabelas operacionais têm organization_id e ficam isoladas por tenant.
do $$ declare t text; begin foreach t in array array[
 'clients','leads','crm_activities','budgets','proposals','proposal_versions','contracts','contract_signatures','homologations','documents',
 'works','work_assignments','work_checklist_items','work_photos','field_checkins','suppliers','purchase_orders','inventory_items','purchase_order_items',
 'inventory_movements','assets','asset_maintenances','financial_accounts','financial_transactions','installments','commissions','om_contracts',
 'service_tickets','energy_generation','warranties','nps_responses','sales_goals','notifications','organization_settings','audit_logs'
] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',t||'_select',t);
 execute format('create policy %I on public.%I for insert to authenticated with check (public.is_org_member(organization_id))',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',t||'_update',t);
 execute format('create policy %I on public.%I for delete to authenticated using (public.has_org_role(organization_id,array[''admin'']::public.app_role[]))',t||'_delete',t);
 end loop; end $$;

commit;
