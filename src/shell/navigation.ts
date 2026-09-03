/**
 * Estrutura de menu do Voltura, espelhando os 11 modulos do padrao ASTER.
 * Cada item resolve para a rota `#/<modulo>/<pagina>`.
 */

export interface NavItem {
  label: string
  slug: string
}

export interface NavGroup {
  label: string
  slug: string
  icon: string
  color: string
  soft: string
  items: NavItem[]
}

/* Paths no estilo Lucide (stroke, viewBox 24). */
const ICONS = {
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  contract: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  project: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><circle cx="11" cy="11" r="2"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  headset: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/><path d="M18 12a2 2 0 0 0 0 4h3v-4z"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6l1.6-7.4H5.1"/>',
  users: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.4-2-6.5-4-8a5 5 0 0 0-.5-8.3"/>',
}

export const NAV: NavGroup[] = [
  {
    label: 'Administração',
    slug: 'administracao',
    icon: ICONS.shield,
    color: '#93b0d1',
    soft: 'rgba(147,176,209,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Minha Empresa', slug: 'minha-empresa' },
      { label: 'Integrações', slug: 'integracoes' },
      { label: 'Usuários', slug: 'usuarios' },
      { label: 'Modelos', slug: 'modelos' },
      { label: 'Regras de Aprovação', slug: 'regras-de-aprovacao' },
      { label: 'Configurações Gerais', slug: 'configuracoes-gerais' },
    ],
  },
  {
    label: 'Comercial',
    slug: 'comercial',
    icon: ICONS.hand,
    color: '#f472b6',
    soft: 'rgba(244,114,182,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Clientes', slug: 'clientes' },
      { label: 'Leads', slug: 'leads' },
      { label: 'Dimensionamentos', slug: 'dimensionamentos' },
      { label: 'Gestão de Negociações', slug: 'negociacoes' },
      { label: 'Funil de Vendas', slug: 'funil-de-vendas' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Contratos',
    slug: 'contratos',
    icon: ICONS.contract,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Gestão de Contratos', slug: 'gestao-de-contratos' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Projetos',
    slug: 'projetos',
    icon: ICONS.project,
    color: '#60a5fa',
    soft: 'rgba(96,165,250,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Gestão de Projetos', slug: 'gestao-de-projetos' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Produção e Estoque',
    slug: 'producao',
    icon: ICONS.box,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Produtos', slug: 'produtos' },
      { label: 'Fornecedores', slug: 'fornecedores' },
      { label: 'Gestão de Produção', slug: 'gestao-de-producao' },
      { label: 'Gestão de Estoque', slug: 'gestao-de-estoque' },
      { label: 'Gestão de Compras', slug: 'gestao-de-compras' },
      { label: 'Requisições de Material', slug: 'requisicoes-de-material' },
      { label: 'Apontamentos Logísticos', slug: 'apontamentos-logisticos' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Obras',
    slug: 'obras',
    icon: ICONS.building,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Gestão de Obras', slug: 'gestao-de-obras' },
      { label: 'Equipes', slug: 'equipes' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Pós-Vendas',
    slug: 'pos-vendas',
    icon: ICONS.headset,
    color: '#2dd4bf',
    soft: 'rgba(45,212,191,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Chamados', slug: 'chamados' },
      { label: 'Ordens de Serviço', slug: 'ordens-de-servico' },
      { label: 'Controle de Satisfação', slug: 'satisfacao' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Vendas Avulsas',
    slug: 'vendas-avulsas',
    icon: ICONS.gift,
    color: '#fb7185',
    soft: 'rgba(251,113,133,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Gestão de Vendas', slug: 'gestao-de-vendas' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Financeiro',
    slug: 'financeiro',
    icon: ICONS.wallet,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    items: [
      { label: 'Visão Geral', slug: 'visao-geral' },
      { label: 'Lançamentos', slug: 'lancamentos' },
      { label: 'Caixas e Bancos', slug: 'caixas-e-bancos' },
      { label: 'Centros de Custo', slug: 'centros-de-custo' },
      { label: 'Conciliação', slug: 'conciliacao' },
      { label: 'Notas Fiscais', slug: 'notas-fiscais' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Suprimentos e Patrimônio',
    slug: 'suprimentos',
    icon: ICONS.cart,
    color: '#4ade80',
    soft: 'rgba(74,222,128,.14)',
    items: [
      { label: 'Compras', slug: 'compras' },
      { label: 'Estoque', slug: 'estoque' },
      { label: 'Patrimônio e Frota', slug: 'patrimonio-e-frota' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
  {
    label: 'Recursos Humanos',
    slug: 'recursos-humanos',
    icon: ICONS.users,
    color: '#c084fc',
    soft: 'rgba(192,132,252,.14)',
    items: [
      { label: 'Colaboradores', slug: 'colaboradores' },
      { label: 'Metas e Permissões', slug: 'metas-e-permissoes' },
      { label: 'Relatórios', slug: 'relatorios' },
    ],
  },
]

/** Dashboard inicial: existe como rota, mas nao aparece na lista de modulos. */
export const HOME: NavGroup = {
  label: 'Início',
  slug: 'inicio',
  icon: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  color: '#f6a623',
  soft: 'rgba(246,166,35,.14)',
  items: [{ label: 'Painel', slug: 'painel' }],
}

export const DEFAULT_PATH = '/inicio/painel'

export interface NavLocation {
  group: NavGroup
  item: NavItem
  path: string
}

/**
 * Sub-paginas alcancadas por botao, nao pelo menu (ex.: "Criar Contrato").
 * Resolvem como rota valida, mas nao aparecem na lista de itens do modulo.
 */
export const SUBPAGES: { groupSlug: string; label: string; slug: string }[] = [
  { groupSlug: 'comercial', label: 'Nova Negociação', slug: 'nova-negociacao' },
  { groupSlug: 'contratos', label: 'Criar Contrato', slug: 'criar-contrato' },
]

export function findLocation(path: string): NavLocation | null {
  const [, groupSlug, itemSlug] = path.split('/')
  const group = groupSlug === HOME.slug ? HOME : NAV.find((entry) => entry.slug === groupSlug)
  if (!group) return null

  const item =
    group.items.find((entry) => entry.slug === itemSlug) ??
    SUBPAGES.find((entry) => entry.groupSlug === groupSlug && entry.slug === itemSlug)
  if (!item) return null

  return { group, item: { label: item.label, slug: item.slug }, path: `/${groupSlug}/${itemSlug}` }
}

/** Todos os itens em uma lista plana — usado pela busca global. */
export function flatItems(): NavLocation[] {
  return NAV.flatMap((group) =>
    group.items.map((item) => ({ group, item, path: `/${group.slug}/${item.slug}` })),
  )
}
