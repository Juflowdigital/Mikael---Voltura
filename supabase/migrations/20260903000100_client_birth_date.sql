-- Data de nascimento do cliente: coluna exibida na listagem comercial.
-- Aditiva e opcional: nao altera registros existentes nem quebra inserts atuais.
alter table public.clients
  add column if not exists birth_date date;

comment on column public.clients.birth_date is
  'Data de nascimento (pessoa fisica). Opcional; nulo para pessoa juridica.';
