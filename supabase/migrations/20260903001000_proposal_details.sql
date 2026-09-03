-- Campos da tela "Nova Negociacao": titulo e os dados de acompanhamento
-- (unidade, concessionaria, gestor, vendedor, funil, fase, tags, endereco).
alter table public.proposals
  add column if not exists title text,
  add column if not exists business_unit_id uuid references public.business_units on delete set null,
  add column if not exists seller_id uuid references public.profiles,
  add column if not exists manager_id uuid references public.profiles,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists proposals_business_unit_idx on public.proposals(business_unit_id);
