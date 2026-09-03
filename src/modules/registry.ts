/**
 * Registro de telas. Cada rota carrega seu modulo sob demanda (code splitting).
 * Rotas ausentes caem no fallback `pending`, que aponta para o sistema atual
 * enquanto a migracao por fases nao alcanca aquele modulo.
 */
import type { ScreenLoader } from '../core/router'

export const SCREENS: Record<string, ScreenLoader> = {
  '/inicio/painel': () => import('./inicio/painel'),
  '/comercial/visao-geral': () => import('./comercial/visao-geral'),
  '/comercial/clientes': () => import('./comercial/clientes'),
  '/comercial/leads': () => import('./comercial/leads'),
  '/comercial/dimensionamentos': () => import('./comercial/dimensionamentos'),
  '/comercial/negociacoes': () => import('./comercial/negociacoes'),
  '/comercial/funil-de-vendas': () => import('./comercial/funil-de-vendas'),
  '/comercial/relatorios': () => import('./comercial/relatorios'),
  '/contratos/visao-geral': () => import('./contratos/visao-geral'),
  '/contratos/gestao-de-contratos': () => import('./contratos/gestao-de-contratos'),
  '/contratos/criar-contrato': () => import('./contratos/criar-contrato'),
  '/contratos/relatorios': () => import('./contratos/relatorios'),
  '/projetos/visao-geral': () => import('./projetos/visao-geral'),
  '/projetos/gestao-de-projetos': () => import('./projetos/gestao-de-projetos'),
  '/projetos/relatorios': () => import('./projetos/relatorios'),
  '/administracao/visao-geral': () => import('./administracao/visao-geral'),
  '/administracao/minha-empresa': () => import('./administracao/minha-empresa'),
  '/administracao/integracoes': () => import('./administracao/integracoes'),
  '/administracao/usuarios': () => import('./administracao/usuarios'),
  '/administracao/modelos': () => import('./administracao/modelos'),
  '/administracao/regras-de-aprovacao': () => import('./administracao/regras-de-aprovacao'),
  '/administracao/configuracoes-gerais': () => import('./administracao/configuracoes-gerais'),
  '/producao/visao-geral': () => import('./producao/visao-geral'),
  '/producao/produtos': () => import('./producao/produtos'),
  '/producao/fornecedores': () => import('./producao/fornecedores'),
  '/producao/gestao-de-producao': () => import('./producao/gestao-de-producao'),
  '/producao/gestao-de-estoque': () => import('./producao/gestao-de-estoque'),
  '/producao/gestao-de-compras': () => import('./producao/gestao-de-compras'),
  '/producao/requisicoes-de-material': () => import('./producao/requisicoes-de-material'),
  '/producao/apontamentos-logisticos': () => import('./producao/apontamentos-logisticos'),
  '/producao/relatorios': () => import('./producao/relatorios'),
  '/obras/visao-geral': () => import('./obras/visao-geral'),
  '/obras/gestao-de-obras': () => import('./obras/gestao-de-obras'),
  '/obras/equipes': () => import('./obras/equipes'),
  '/obras/relatorios': () => import('./obras/relatorios'),
  '/financeiro/visao-geral': () => import('./financeiro/visao-geral'),
  '/financeiro/lancamentos': () => import('./financeiro/lancamentos'),
  '/financeiro/caixas-e-bancos': () => import('./financeiro/caixas-e-bancos'),
  '/financeiro/centros-de-custo': () => import('./financeiro/centros-de-custo'),
  '/financeiro/conciliacao': () => import('./financeiro/conciliacao'),
  '/financeiro/notas-fiscais': () => import('./financeiro/notas-fiscais'),
  '/financeiro/relatorios': () => import('./financeiro/relatorios'),
}

export function screenLoader(path: string): ScreenLoader | null {
  return SCREENS[path] ?? null
}
