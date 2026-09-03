/** Contratos › Relatórios — extrações em CSV do ciclo contratual. */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, isoDay } from '../../core/format'
import { findAll, items, powerKwp, STAGE_LABEL, stageOf, STATUS_LABEL } from '../../data/contracts'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf } from '../../data/team'

interface Report {
  id: string
  title: string
  description: string
  mark: string
  color: string
  soft: string
  build: () => Promise<{ headers: string[]; rows: unknown[][] }>
}

const I = {
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
  flow: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
}

const REPORTS: Report[] = [
  {
    id: 'contratos',
    title: 'Contratos',
    description: 'Um contrato por linha — cliente, etapa, potência, valor e prazo.',
    mark: I.file,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const [contracts, clients, team] = await Promise.all([findAll(), findClients(), members()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Número', 'Título', 'Cliente', 'Status', 'Etapa', 'Potência (kWp)', 'Valor (R$)', 'Vendedor', 'Prazo (dias)', 'Criado em'],
        rows: contracts.map((contract) => [
          contract.contract_number,
          contract.title ?? '',
          clientName(contract.client_id),
          STATUS_LABEL[contract.status],
          STAGE_LABEL[stageOf(contract)],
          csvNumber(powerKwp(contract)),
          csvNumber(contract.total_value),
          nameOf(team, contract.seller_id),
          contract.execution_days ?? '',
          date(contract.created_at),
        ]),
      }
    },
  },
  {
    id: 'contratos-por-etapa',
    title: 'Contratos por Etapa',
    description: 'Agregado do funil contratual — quantidade e valor em cada etapa.',
    mark: I.flow,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const contracts = await findAll()
      const stages = [...new Set(contracts.map((contract) => stageOf(contract)))]
      return {
        headers: ['Etapa', 'Contratos', 'Valor total (R$)', 'Potência total (kWp)'],
        rows: stages.map((stage) => {
          const group = contracts.filter((contract) => stageOf(contract) === stage)
          return [
            STAGE_LABEL[stage],
            group.length,
            csvNumber(group.reduce((sum, contract) => sum + Number(contract.total_value ?? 0), 0)),
            csvNumber(group.reduce((sum, contract) => sum + Number(powerKwp(contract) ?? 0), 0)),
          ]
        }),
      }
    },
  },
  {
    id: 'itens-de-contrato',
    title: 'Itens de Contrato',
    description: 'Composição dos contratos — produto, quantidade, valor unitário e total.',
    mark: I.box,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const [contracts, clients] = await Promise.all([findAll(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      const rows: unknown[][] = []
      for (const contract of contracts) {
        for (const item of await items(contract.id)) {
          rows.push([
            contract.contract_number,
            clientName(contract.client_id),
            item.item_type,
            item.name,
            csvNumber(item.quantity),
            csvNumber(item.unit_price),
            csvNumber(item.quantity * item.unit_price),
          ])
        }
      }
      return {
        headers: ['Contrato', 'Cliente', 'Tipo', 'Produto', 'Quantidade', 'Valor unitário (R$)', 'Total (R$)'],
        rows,
      }
    },
  },
  {
    id: 'prazos-de-execucao',
    title: 'Prazos de Execução',
    description: 'Contratos assinados com prazo — data prevista de entrega e dias restantes.',
    mark: I.clock,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [contracts, clients] = await Promise.all([findAll(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Contrato', 'Cliente', 'Assinado em', 'Prazo (dias)', 'Entrega prevista', 'Dias restantes'],
        rows: contracts
          .filter((contract) => contract.signed_at && contract.execution_days)
          .map((contract) => {
            const due = new Date(contract.signed_at as string).getTime() + (contract.execution_days as number) * 86400000
            return [
              contract.contract_number,
              clientName(contract.client_id),
              date(contract.signed_at),
              contract.execution_days,
              date(new Date(due).toISOString().slice(0, 10)),
              Math.round((due - Date.now()) / 86400000),
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
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Contratos', path: '/contratos/visao-geral' }, { label: 'Relatórios' }] }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, REPORTS.map(reportCard)),
  )
}
