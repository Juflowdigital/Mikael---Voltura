/** Produção e Estoque › Relatórios — extrações em CSV. */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { guard } from '../../ui/components/feedback'
import { csvNumber, downloadCsv, toCsv } from '../../core/csv'
import { date, dateTime, isoDay } from '../../core/format'
import {
  abcCurve,
  allComponents,
  COMPONENT_LABEL,
  isBelowMinimum,
  items,
  movements,
  products,
  PURCHASE_LABEL,
  purchaseOrders,
  suppliers,
} from '../../data/inventory'
import {
  FLOW_LABEL,
  LOGISTICS_LABEL,
  logistics,
  orders,
  REQUISITION_LABEL,
  requisitionItems,
  requisitions,
  STAGE_LABEL,
} from '../../data/production'
import { findAll as findClients } from '../../data/clients'

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
  box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  truck: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.3a4 4 0 0 0-1.1-2.8L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
}

const REPORTS: Report[] = [
  {
    id: 'posicao-de-estoque',
    title: 'Posição de Estoque',
    description: 'Saldo, mínimo, custo médio e valor imobilizado por item.',
    mark: I.box,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const rows = await items()
      return {
        headers: ['SKU', 'Item', 'Categoria', 'Local', 'Unidade', 'Saldo', 'Mínimo', 'Custo médio (R$)', 'Valor em estoque (R$)', 'Situação'],
        rows: rows.map((item) => [
          item.sku,
          item.name,
          item.category ?? '',
          item.location ?? '',
          item.unit,
          csvNumber(item.quantity),
          csvNumber(item.minimum_quantity),
          csvNumber(item.average_cost),
          csvNumber(Number(item.quantity) * Number(item.average_cost)),
          isBelowMinimum(item) ? 'Abaixo do mínimo' : 'Normal',
        ]),
      }
    },
  },
  {
    id: 'curva-abc',
    title: 'Curva ABC',
    description: 'Classificação dos itens por valor imobilizado (A, B e C).',
    mark: I.chart,
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    build: async () => {
      const rows = await items()
      const curve = abcCurve(rows)
      const total = rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.average_cost), 0)
      return {
        headers: ['Classe', 'Itens', 'Participação alvo', 'Valor total do estoque (R$)'],
        rows: [
          ['A', curve.a, 'até 80%', csvNumber(total)],
          ['B', curve.b, '80% a 95%', ''],
          ['C', curve.c, 'acima de 95%', ''],
        ],
      }
    },
  },
  {
    id: 'movimentacoes',
    title: 'Movimentações de Estoque',
    description: 'Entradas, saídas, reservas e ajustes com data e quantidade.',
    mark: I.box,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, stock] = await Promise.all([movements(), items()])
      const itemName = (id: string) => stock.find((item) => item.id === id)?.name ?? ''
      return {
        headers: ['Quando', 'Item', 'Tipo', 'Quantidade', 'Custo unitário (R$)', 'Observação'],
        rows: rows.map((row) => [
          dateTime(row.occurred_at),
          itemName(row.inventory_item_id),
          row.movement_type,
          csvNumber(row.quantity),
          csvNumber(row.unit_cost),
          row.notes ?? '',
        ]),
      }
    },
  },
  {
    id: 'producoes',
    title: 'Produções',
    description: 'Ordens de produção com etapa, fluxos de compra e expedição.',
    mark: I.chart,
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    build: async () => {
      const [rows, clients] = await Promise.all([orders(), findClients()])
      const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? ''
      return {
        headers: ['Código', 'Cliente', 'Etapa', 'Fluxo de compra', 'Fluxo de expedição', 'Conflitos', 'Início', 'Conclusão', 'Criada em'],
        rows: rows.map((order) => [
          order.code,
          clientName(order.client_id),
          STAGE_LABEL[order.stage],
          FLOW_LABEL[order.purchase_flow],
          FLOW_LABEL[order.shipping_flow],
          (order.conflicts ?? []).length,
          order.started_at ? date(order.started_at) : '',
          order.finished_at ? date(order.finished_at) : '',
          date(order.created_at),
        ]),
      }
    },
  },
  {
    id: 'requisicoes',
    title: 'Requisições de Material',
    description: 'Uma linha por item requisitado, com quantidade entregue.',
    mark: I.file,
    color: '#2dd4bf',
    soft: 'rgba(45,212,191,.14)',
    build: async () => {
      const [rows, lines, stock] = await Promise.all([requisitions(), requisitionItems(), items()])
      const itemName = (id: string) => stock.find((item) => item.id === id)?.name ?? ''
      return {
        headers: ['Requisição', 'Status', 'Item', 'Quantidade', 'Entregue', 'Solicitada em'],
        rows: lines.map((line) => {
          const requisition = rows.find((entry) => entry.id === line.requisition_id)
          return [
            requisition ? requisition.number : '',
            requisition ? REQUISITION_LABEL[requisition.status] : '',
            itemName(line.inventory_item_id),
            csvNumber(line.quantity),
            csvNumber(line.delivered_quantity),
            requisition ? date(requisition.created_at) : '',
          ]
        }),
      }
    },
  },
  {
    id: 'compras',
    title: 'Compras',
    description: 'Pedidos por fornecedor, situação, valor e previsão de entrega.',
    mark: I.file,
    color: '#fb7185',
    soft: 'rgba(251,113,133,.14)',
    build: async () => {
      const [rows, vendors] = await Promise.all([purchaseOrders(), suppliers()])
      const supplierName = (id: string) => vendors.find((vendor) => vendor.id === id)?.name ?? ''
      return {
        headers: ['Pedido', 'Fornecedor', 'Situação', 'Valor (R$)', 'Previsão', 'Aberto em'],
        rows: rows.map((order) => [
          order.order_number,
          supplierName(order.supplier_id),
          PURCHASE_LABEL[order.status],
          csvNumber(order.total_value),
          order.expected_at ? date(order.expected_at) : '',
          date(order.created_at),
        ]),
      }
    },
  },
  {
    id: 'apontamentos-logisticos',
    title: 'Apontamentos Logísticos',
    description: 'Expedições, entregas, coletas e devoluções registradas.',
    mark: I.truck,
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    build: async () => {
      const [rows, productions] = await Promise.all([logistics(), orders()])
      const code = (id: string | null) => productions.find((order) => order.id === id)?.code ?? ''
      return {
        headers: ['Quando', 'Tipo', 'Produção', 'Veículo', 'Motorista', 'Observação'],
        rows: rows.map((row) => [
          dateTime(row.occurred_at),
          LOGISTICS_LABEL[row.kind],
          code(row.production_order_id),
          row.vehicle ?? '',
          row.driver ?? '',
          row.notes ?? '',
        ]),
      }
    },
  },
  {
    id: 'composicao-de-produtos',
    title: 'Composição de Produtos',
    description: 'Cada componente dos geradores cadastrados, com marca e modelo.',
    mark: I.box,
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    build: async () => {
      const [rows, parts] = await Promise.all([products(), allComponents()])
      return {
        headers: ['Produto', 'Tipo de gerador', 'Componente', 'Marca', 'Modelo', 'Quantidade', 'Potência', 'Potência total (kWp)', 'Preço do kit (R$)'],
        rows: parts.map((part) => {
          const product = rows.find((entry) => entry.id === part.product_id)
          return [
            product ? product.name : '',
            product && product.generator_type ? product.generator_type : '',
            COMPONENT_LABEL[part.component_type],
            part.brand ?? '',
            part.model ?? '',
            csvNumber(part.quantity),
            csvNumber(part.power),
            csvNumber(Number(product ? product.total_power_wp : 0) / 1000),
            csvNumber(product ? product.kit_price : 0),
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
      downloadCsv(report.id + '-' + isoDay(), toCsv(headers, rows))
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
    pageHead({ title: 'Relatórios', crumbs: [{ label: 'Produção e Estoque' }, { label: 'Relatórios' }] }),
    h('div.grid', { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } }, REPORTS.map(reportCard)),
  )
}
