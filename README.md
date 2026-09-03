# Voltura ERP Solar

ERP para integradores fotovoltaicos. Frontend em TypeScript com Vite, dados e
autenticação no Supabase.

## Estrutura

```
src/
  core/       sessão, router, store, formatadores, cálculo solar e CSV
  data/       um repositório por domínio, sempre escopado por organization_id
  ui/         tokens de tema e componentes reutilizáveis
  shell/      sidebar, topbar, login e orquestração de telas
  modules/    uma pasta por módulo do menu, uma tela por arquivo
```

São **11 módulos e 55 telas**, cada item de menu com tela própria. O router
carrega cada tela sob demanda (code splitting).

## Desenvolvimento

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para rodar o frontend.
3. Execute `npm ci` e `npm run dev`.

Nunca publique `SUPABASE_SERVICE_ROLE_KEY`, a senha do banco ou o token da CLI.
Essas credenciais são exclusivas para tarefas administrativas locais.

## Banco de dados

Migrações ficam em `supabase/migrations`, aplicadas com `npx supabase db push`.
Toda tabela tem RLS por organização, usando os helpers `is_org_member` e
`has_org_role`.

## Validação

`npm run check` roda, nesta ordem:

- `lint` — auditoria estática (sem TODO, botão sem ação, catch vazio, dado simulado)
- `typecheck` — TypeScript em modo estrito
- `check:component` — garante que **todo item de menu tem tela própria** e que o
  app antigo não voltou ao projeto
- `build` — build de produção

`npm run test:e2e` roda o teste de ponta a ponta: login, navegação pelos 11
módulos, cadastro persistido, cálculo de dimensionamento, busca global e logout,
falhando se houver qualquer erro de console ou resposta HTTP ≥ 400.

## Publicação

O workflow `Deploy production` publica o branch `main` no GitHub Pages.
Configure no repositório os secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Em **Settings → Pages**, selecione **GitHub Actions** como origem.

## O que depende de serviço externo

Estas funções ficam registradas no sistema, mas o envio real depende de
integração contratada e **precisa de teste manual em produção**:

- emissão de nota fiscal na SEFAZ (Financeiro › Notas Fiscais)
- envio de e-mail e WhatsApp (Administração › Integrações)
- assinatura eletrônica de contratos
