/** Suprimentos e Patrimônio › Relatórios. */
import { renderReports, REPORT_ICONS, type ReportDef } from '../../ui/components/reports'
import { csvNumber } from '../../core/csv'
import { date } from '../../core/format'
import { assets, isMaintenanceLate, maintenances, needsMaintenance, statusLabel } from '../../data/assets'
import { PURCHASE_LABEL, purchaseOrders, suppliers, items, isBelowMinimum } from '../../data/inventory'
import { members, nameOf } from '../../data/team'

const REPORTS: ReportDef[] = [
  {
    id: 'patrimonio',
    title: 'Patrimônio',
    description: 'Itens com categoria, responsável, valor e próxima revisão.',
    mark: REPORT_ICONS.box,
    color: '#4ade80',
    soft: 'rgba(74,222,128,.14)',
    build: async () => {
      const [rows, team] = await Promise.all([assets(), members()])
      return {
        headers: ['Patrimônio', 'Item', 'Categoria', 'Nº de série', 'Situação', 'Responsável', 'Localização', 'Aquisição', 'Valor (R$)', 'Próxima revisão', 'Revisão próxima'],
        rows: rows.map((asset) => [
          asset.asset_tag,
          asset.name,
          asset.category,
          asset.serial_number ?? '',
          statusLabel(asset.status),
          nameOf(team, asset.responsible_id),
          asset.location ?? '',
          asset.acquisition_date ? date(asset.acquisition_date) : '',
          csvNumber(asset.acquisition_value),
          asset.next_maintenance_at ? date(asset.next_maintenance_at) : '',
          needsMaintenance(asset) ? 'Sim' : 'Não',
        ]),
      }
    },
  },
  {
    id: 'manutencoes',
    title: 'Manutenções',
    description: 'Manutenções agendadas e concluídas, com custo e fornecedor.',
    mark: REPORT_ICONS.truck,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, list] = await Promise.all([maintenances(), assets()])
      const assetName = (id: string) => list.find((asset) => asset.id === id)?.name ?? ''
      const assetTag = (id: string) => list.find((asset) => asset.id === id)?.asset_tag ?? ''
      return {
        headers: ['Patrimônio', 'Item', 'Descrição', 'Fornecedor', 'Agendada para', 'Vencida', 'Concluída em', 'Custo (R$)', 'Situação'],
        rows: rows.map((row) => [
          assetTag(row.asset_id),
          assetName(row.asset_id),
          row.description,
          row.provider ?? '',
          row.scheduled_at ? date(row.scheduled_at) : '',
          isMaintenanceLate(row) ? 'Sim' : 'Não',
          row.completed_at ? date(row.completed_at) : '',
          csvNumber(row.cost),
          row.status === 'completed' ? 'Concluída' : 'Pendente',
        ]),
      }
    },
  },
  {
    id: 'suprimentos',
    title: 'Suprimentos',
    description: 'Pedidos de compra por fornecedor e itens abaixo do mínimo.',
    mark: REPORT_ICONS.money,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const [orders, vendors, stock] = await Promise.all([purchaseOrders(), suppliers(), items()])
      const supplierName = (id: string) => vendors.find((vendor) => vendor.id === id)?.name ?? ''
      const rows: unknown[][] = [
        ...orders.map((order) => [
          'Pedido de compra',
          order.order_number,
          supplierName(order.supplier_id),
          PURCHASE_LABEL[order.status],
          csvNumber(order.total_value),
          order.expected_at ? date(order.expected_at) : '',
        ]),
        ...stock.filter(isBelowMinimum).map((item) => [
          'Item abaixo do mínimo',
          item.sku,
          item.name,
          'Saldo ' + csvNumber(item.quantity) + ' de mínimo ' + csvNumber(item.minimum_quantity),
          csvNumber(Number(item.quantity) * Number(item.average_cost)),
          '',
        ]),
      ]
      return { headers: ['Tipo', 'Identificação', 'Descrição', 'Situação', 'Valor (R$)', 'Previsão'], rows }
    },
  },
]

export function render(host: HTMLElement): void {
  renderReports(host, [{ label: 'Suprimentos e Patrimônio' }, { label: 'Relatórios' }], REPORTS)
}
