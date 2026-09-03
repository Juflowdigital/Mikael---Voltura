/** Vendas Avulsas › Relatórios. */
import { renderReports, REPORT_ICONS, type ReportDef } from '../../ui/components/reports'
import { csvNumber } from '../../core/csv'
import { date } from '../../core/format'
import { countsAsRevenue, saleItems, sales, SALE_LABEL } from '../../data/sales'
import { findAll as findClients } from '../../data/clients'
import { members, nameOf } from '../../data/team'

const REPORTS: ReportDef[] = [
  {
    id: 'vendas-avulsas',
    title: 'Vendas Avulsas',
    description: 'Uma linha por venda, com cliente, vendedor, valor e situação.',
    mark: REPORT_ICONS.money,
    color: '#fb7185',
    soft: 'rgba(251,113,133,.14)',
    build: async () => {
      const [rows, clients, team] = await Promise.all([sales(), findClients(), members()])
      const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? 'Consumidor não identificado'
      return {
        headers: ['Venda', 'Cliente', 'Vendedor', 'Data', 'Forma de pagamento', 'Valor (R$)', 'Situação', 'Conta como receita'],
        rows: rows.map((sale) => [
          sale.sale_number,
          clientName(sale.client_id),
          nameOf(team, sale.seller_id),
          date(sale.sold_at),
          sale.payment_method ?? '',
          csvNumber(sale.total_value),
          SALE_LABEL[sale.status],
          countsAsRevenue(sale) ? 'Sim' : 'Não',
        ]),
      }
    },
  },
  {
    id: 'itens-vendidos',
    title: 'Itens Vendidos',
    description: 'Uma linha por item, com quantidade, valor unitário e total.',
    mark: REPORT_ICONS.box,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, lines, clients] = await Promise.all([sales(), saleItems(), findClients()])
      const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Venda', 'Cliente', 'Item', 'Quantidade', 'Valor unitário (R$)', 'Total (R$)', 'Data'],
        rows: lines.map((line) => {
          const sale = rows.find((entry) => entry.id === line.sale_id)
          return [
            sale ? sale.sale_number : '',
            sale ? clientName(sale.client_id) : '',
            line.description,
            csvNumber(line.quantity),
            csvNumber(line.unit_price),
            csvNumber(Number(line.quantity) * Number(line.unit_price)),
            sale ? date(sale.sold_at) : '',
          ]
        }),
      }
    },
  },
  {
    id: 'vendas-por-vendedor',
    title: 'Vendas por Vendedor',
    description: 'Agregado por pessoa, contando apenas confirmadas e entregues.',
    mark: REPORT_ICONS.users,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const [rows, team] = await Promise.all([sales(), members()])
      return {
        headers: ['Vendedor', 'Vendas', 'Valor total (R$)', 'Ticket médio (R$)'],
        rows: team.map((member) => {
          const own = rows.filter((sale) => sale.seller_id === member.userId && countsAsRevenue(sale))
          const total = own.reduce((sum, sale) => sum + Number(sale.total_value), 0)
          return [member.name, own.length, csvNumber(total), csvNumber(own.length ? total / own.length : 0)]
        }),
      }
    },
  },
]

export function render(host: HTMLElement): void {
  renderReports(host, [{ label: 'Vendas Avulsas' }, { label: 'Relatórios' }], REPORTS)
}
