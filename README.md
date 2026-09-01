# Voltua ERP Solar

Aplicação web do ERP da Voltua, com autenticação e persistência no Supabase.

## Desenvolvimento

1. Copie `.env.example` para `.env.local`.
2. Preencha somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para executar o frontend.
3. Execute `npm ci` e `npm run dev`.

Nunca publique `SUPABASE_SERVICE_ROLE_KEY`, a senha do banco ou o token da CLI. Essas credenciais são exclusivas para tarefas administrativas locais.

## Validação

Execute `npm run check`. O comando valida TypeScript, a sintaxe do componente principal e o build de produção.

## Publicação

O workflow `Deploy production` publica o branch `main` no GitHub Pages. Configure no repositório os secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Em **Settings → Pages**, selecione **GitHub Actions** como origem da publicação.
