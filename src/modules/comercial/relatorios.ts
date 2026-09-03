/** Comercial › Relatórios — catálogo de extrações em CSV (tela M12). */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, isoDay } from '../../core/format'
import { list } from '../../data/db'
import { clientCity, clientName, findAll as findProposals, powerKwp, PROPOSAL_LABEL } from '../../data/proposals'
import { findAll as findLeads, STAGE_LABEL } from '../../data/leads'
import { cityState, findAll as findClients } from '../../data/clients'
import { members, nameOf } from '../../data/team'
import type { Contract } from '../../core/types'

export interface Report {
  id: string
  title: string
  description: string
  mark: string
  color: string
  soft: string
  build: () => Promise<{ headers: string[]; rows: unknown[][] }>
}

const I = {
  chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  flow: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.6 17 22l-5-3-5 3 1.5-8.4"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  money: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
}

function contracts(): Promise<Contract[]> {
  return list<Contract>('contracts', {
    select: 'id,contract_number,client_id,title,status,total_value,signed_at,commission_percent,seller_id,created_at',
    orderBy: 'created_at',
  })
}

const REPORTS: Report[] = [
  {
    id: 'negociacoes',
    title: 'Negociações',
    description: 'Extração do pipeline — uma linha por negociação criada na janela filtrada.',
    mark: I.chart,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const rows = await findProposals()
      return {
        headers: ['Número', 'Cliente', 'Cidade/Estado', 'Status', 'Potência (kWp)', 'Valor (R$)', 'Criada em'],
        rows: rows.map((p) => [
          p.proposal_number,
          clientName(p),
          clientCity(p),
          PROPOSAL_LABEL[p.status],
          csvNumber(powerKwp(p)),
          csvNumber(p.total_value),
          date(p.created_at),
        ]),
      }
    },
  },
  {
    id: 'negociacoes-por-fase',
    title: 'Negociações por Fase',
    description: 'Negociações em andamento — funil, fase atual e dias em aberto em evidência.',
    mark: I.flow,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const [leads, team] = await Promise.all([findLeads(), members()])
      return {
        headers: ['Lead', 'Fase', 'Responsável', 'Origem', 'Valor estimado (R$)', 'Dias em aberto'],
        rows: leads.map((lead) => [
          lead.name,
          STAGE_LABEL[lead.stage],
          nameOf(team, lead.assigned_to),
          lead.source ?? '',
          csvNumber(lead.estimated_value),
          Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000),
        ]),
      }
    },
  },
  {
    id: 'vendas-realizadas',
    title: 'Vendas Realizadas',
    description: 'Negociações aceitas — valor fechado, potência e data de fechamento.',
    mark: I.award,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const rows = (await findProposals()).filter((p) => p.status === 'accepted')
      return {
        headers: ['Número', 'Cliente', 'Potência (kWp)', 'Valor (R$)', 'Fechada em'],
        rows: rows.map((p) => [p.proposal_number, clientName(p), csvNumber(powerKwp(p)), csvNumber(p.total_value), date(p.created_at)]),
      }
    },
  },
  {
    id: 'vendas-por-vendedor',
    title: 'Vendas por Vendedor',
    description: 'Ranking agregado por vendedor, com taxa de conversão.',
    mark: I.users,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const [leads, team] = await Promise.all([findLeads(), members()])
      return {
        headers: ['Vendedor', 'Leads', 'Ganhos', 'Perdidos', 'Valor ganho (R$)', 'Taxa de conversão (%)'],
        rows: team.map((member) => {
          const own = leads.filter((lead) => lead.assigned_to === member.userId)
          const won = own.filter((lead) => lead.stage === 'won')
          const lost = own.filter((lead) => lead.stage === 'lost')
          const value = won.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0)
          return [
            member.name,
            own.length,
            won.length,
            lost.length,
            csvNumber(value),
            csvNumber(own.length ? (won.length / own.length) * 100 : 0),
          ]
        }),
      }
    },
  },
  {
    id: 'propostas-emitidas',
    title: 'Propostas Emitidas',
    description: 'Extração de propostas — uma linha por proposta criada na janela filtrada.',
    mark: I.file,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const rows = await findProposals()
      return {
        headers: ['Número', 'Cliente', 'Status', 'Valor (R$)', 'Validade', 'Emitida em'],
        rows: rows.map((p) => [
          p.proposal_number,
          clientName(p),
          PROPOSAL_LABEL[p.status],
          csvNumber(p.total_value),
          p.valid_until ? date(p.valid_until) : '',
          date(p.created_at),
        ]),
      }
    },
  },
  {
    id: 'carteira-de-clientes',
    title: 'Carteira de Clientes',
    description: 'Clientes cadastrados — contato, localização e responsável.',
    mark: I.users,
    color: '#2dd4bf',
    soft: 'rgba(45,212,191,.14)',
    build: async () => {
      const [rows, team] = await Promise.all([findClients(), members()])
      return {
        headers: ['Nome', 'Tipo', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Cidade/Estado', 'Responsável', 'Cadastrado em'],
        rows: rows.map((client) => [
          client.name,
          client.person_type === 'company' ? 'Pessoa jurídica' : 'Pessoa física',
          client.tax_id ?? '',
          client.email ?? '',
          client.phone ?? '',
          cityState(client),
          nameOf(team, client.owner_id),
          date(client.created_at),
        ]),
      }
    },
  },
  {
    id: 'comissionamento-por-vendedor',
    title: 'Comissionamento por Vendedor',
    description: 'Agregado por pessoa: contratos, valor total e comissão prevista.',
    mark: I.money,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, team] = await Promise.all([contracts(), members()])
      return {
        headers: ['Vendedor', 'Contratos', 'Valor total (R$)', 'Comissão prevista (R$)', 'Percentual médio (%)'],
        rows: team.map((member) => {
          const own = rows.filter((contract) => contract.seller_id === member.userId)
          const total = own.reduce((sum, contract) => sum + Number(contract.total_value ?? 0), 0)
          const commission = own.reduce(
            (sum, contract) => sum + (Number(contract.total_value ?? 0) * Number(contract.commission_percent ?? 0)) / 100,
            0,
          )
          const average = own.length
            ? own.reduce((sum, contract) => sum + Number(contract.commission_percent ?? 0), 0) / own.length
            : 0
          return [member.name, own.length, csvNumber(total), csvNumber(commission), csvNumber(average)]
        }),
      }
    },
  },
  {
    id: 'comissoes-por-venda',
    title: 'Comissões por Venda',
    description: 'Extrato detalhado — contrato, valor, percentual aplicado e comissão calculada.',
    mark: I.money,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const [rows, team] = await Promise.all([contracts(), members()])
      return {
        headers: ['Contrato', 'Título', 'Vendedor', 'Valor (R$)', 'Percentual (%)', 'Comissão (R$)', 'Assinado em'],
        rows: rows.map((contract) => [
          contract.contract_number,
          contract.title ?? '',
          nameOf(team, contract.seller_id),
          csvNumber(contract.total_value),
          csvNumber(contract.commission_percent),
          csvNumber((Number(contract.total_value ?? 0) * Number(contract.commission_percent ?? 0)) / 100),
          contract.signed_at ? date(contract.signed_at) : '',
        ]),
      }
    },
  },
  {
    id: 'vendas-por-tipo-de-gerador',
    title: 'Vendas por Tipo de Gerador',
    description: 'Vendas fechadas por faixa de potência — microgeração, minigeração e acima.',
    mark: I.pie,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const rows = (await findProposals()).filter((p) => p.status === 'accepted')
      const buckets = [
        { label: 'Microgeração (até 75 kWp)', test: (kwp: number) => kwp > 0 && kwp <= 75 },
        { label: 'Minigeração (75 a 5.000 kWp)', test: (kwp: number) => kwp > 75 && kwp <= 5000 },
        { label: 'Acima de 5.000 kWp', test: (kwp: number) => kwp > 5000 },
        { label: 'Sem potência informada', test: (kwp: number) => !kwp },
      ]
      return {
        headers: ['Faixa', 'Vendas', 'Potência total (kWp)', 'Valor total (R$)'],
        rows: buckets.map((bucket) => {
          const group = rows.filter((p) => bucket.test(Number(powerKwp(p) ?? 0)))
          return [
            bucket.label,
            group.length,
            csvNumber(group.reduce((sum, p) => sum + Number(powerKwp(p) ?? 0), 0)),
            csvNumber(group.reduce((sum, p) => sum + Number(p.total_value ?? 0), 0)),
          ]
        }),
      }
    },
  },
]

function reportCard(report: Report): HTMLElement {
  const button = h('button.btn.btn-primary', { style: { marginTop: '14px' } }, 'Gerar CSV') as HTMLButtonElement

  button.addEventListener('click', async () => {
    button.disabled = true
    button.textContent = 'Gerando…'
    await guard(async () => {
      const { headers, rows } = await report.build()
      downloadCsv(`${report.id}-${isoDay()}`, toCsv(headers, rows))
    }, 'Relatório gerado. O download começou.')
    button.disabled = false
    button.textContent = 'Gerar CSV'
  })

  return h(
    'article.card',
    { style: { padding: '20px' } },
    h('div.kpi-icon', { style: { background: report.soft, color: report.color, width: '38px', height: '38px' } }, icon(report.mark, 17)),
    h('div', { style: { fontSize: '15px', fontWeight: '650', marginTop: '14px' } }, report.title),
    h('div.muted', { style: { fontSize: '12.5px', marginTop: '6px', lineHeight: '1.55' } }, report.description),
    button,
  )
}

export function render(host: HTMLElement): void {
  mount(
    host,
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Comercial' }, { label: 'Relatórios' }] }),
    h(
      'div.grid',
      { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
      REPORTS.map(reportCard),
    ),
  )
}
