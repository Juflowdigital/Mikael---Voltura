/** Produção e Estoque › Visão Geral — indicadores e curva ABC (telas M19/M21). */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { donutChart } from '../../ui/components/chart'
import { badge } from '../../ui/components/badge'
import { emptyState } from '../../ui/components/feedback'
import { date, decimal, money } from '../../core/format'
import { navigate } from '../../core/router'
import { abcCurve, isBelowMinimum, items, purchaseOrders, PURCHASE_LABEL, PURCHASE_TONE } from '../../data/inventory'
import { orders, REQUISITION_LABEL, REQUISITION_TONE, requisitions, STAGE_LABEL } from '../../data/production'
import { findAll as findClients } from '../../data/clients'
import type { Child } from '../../ui/dom'

function miniTable(headers: string[], rows: Child[][]): HTMLElement {
  return h(
    'div.table-wrap',
    h(
      'table.data',
      h('thead', h('tr', headers.map((label, index) => h(index >= headers.length - 1 ? 'th.col-right' : 'th', label)))),
      h(
        'tbody',
        rows.map((cells) => h('tr', cells.map((cell, index) => h(index >= headers.length - 1 ? 'td.col-right' : 'td', cell)))),
      ),
    ),
  )
}

export async function render(host: HTMLElement): Promise<void> {
  const [stock, productions, reqs, purchases, clients] = await Promise.all([
    items(),
    orders(),
    requisitions(),
    purchaseOrders(),
    findClients(),
  ])
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'

  const toProduce = productions.filter((order) => order.stage === 'a-produzir')
  const inProduction = productions.filter((order) => order.stage === 'em-producao')
  const done = productions.filter((order) => order.stage === 'concluida')
  const openRequisitions = reqs.filter((row) => row.status === 'open' || row.status === 'approved')
  const pendingPurchases = purchases.filter((row) => ['draft', 'quoted', 'approved', 'ordered'].includes(row.status))

  const curve = abcCurve(stock)
  const belowMinimum = stock.filter(isBelowMinimum)
  const stockValue = stock.reduce((sum, item) => sum + Number(item.quantity) * Number(item.average_cost), 0)

  mount(
    host,
    pageHead({ title: 'Produção e Estoque', crumbs: [{ label: 'Produção e Estoque' }, { label: 'Visão Geral' }] }),
    h(
      'div.stack',
      gridCols(
        4,
        kpiCard({ label: 'A produzir', value: String(toProduce.length), mark: KPI_ICONS.clock, color: '#38bdf8', soft: 'rgba(56,189,248,.14)', onClick: () => navigate('/producao/gestao-de-producao', { filtro: 'a-produzir' }) }),
        kpiCard({ label: 'Em produção', value: String(inProduction.length), mark: KPI_ICONS.box, color: '#f6a623', soft: 'rgba(246,166,35,.14)', onClick: () => navigate('/producao/gestao-de-producao', { filtro: 'em-producao' }) }),
        kpiCard({ label: 'Produção concluída', value: String(done.length), mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)', onClick: () => navigate('/producao/gestao-de-producao', { filtro: 'concluida' }) }),
        kpiCard({ label: 'Compras pendentes', value: String(pendingPurchases.length), hint: money(pendingPurchases.reduce((sum, row) => sum + Number(row.total_value), 0)), mark: KPI_ICONS.alert, color: '#a78bfa', soft: 'rgba(167,139,250,.14)', onClick: () => navigate('/producao/gestao-de-compras') }),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Produções em andamento', footerLink: { label: 'Ver todas', path: '/producao/gestao-de-producao' }, flush: true },
          inProduction.length
            ? miniTable(
                ['Produção', 'Cliente', 'Início'],
                inProduction.slice(0, 6).map((order) => [
                  h('div', h('b', order.code), h('div.faint', { style: { fontSize: '11.5px' } }, STAGE_LABEL[order.stage])),
                  clientName(order.client_id),
                  order.started_at ? date(order.started_at) : '—',
                ]),
              )
            : emptyState({ title: 'Nenhuma produção em andamento' }),
        ),
        card(
          { title: 'Compras em aberto', footerLink: { label: 'Ver todas', path: '/producao/gestao-de-compras' }, flush: true },
          pendingPurchases.length
            ? miniTable(
                ['Pedido', 'Situação', 'Valor'],
                pendingPurchases.slice(0, 6).map((order) => [
                  h('b', order.order_number),
                  badge(PURCHASE_LABEL[order.status], PURCHASE_TONE[order.status]),
                  money(order.total_value),
                ]),
              )
            : emptyState({ title: 'Nenhuma compra em aberto' }),
        ),
      ),
      gridTemplate(
        '1fr 1fr',
        card(
          { title: 'Curva ABC de Estoque', subtitle: 'Classificação por valor imobilizado · ' + money(stockValue) + ' em estoque' },
          donutChart({
            data: [
              { label: 'Classe A', value: curve.a, color: '#22c55e' },
              { label: 'Classe B', value: curve.b, color: '#f6a623' },
              { label: 'Classe C', value: curve.c, color: '#8ba0b8' },
            ],
            total: curve.total,
            totalLabel: 'Itens',
          }),
        ),
        card(
          { title: 'Requisições de Material em aberto', footerLink: { label: 'Ver todas', path: '/producao/requisicoes-de-material' }, flush: true },
          openRequisitions.length
            ? miniTable(
                ['Nº', 'Status', 'Solicitada em'],
                openRequisitions.slice(0, 6).map((row) => [
                  h('b', row.number),
                  badge(REQUISITION_LABEL[row.status], REQUISITION_TONE[row.status]),
                  date(row.created_at),
                ]),
              )
            : emptyState({ title: 'Nenhuma requisição em aberto' }),
        ),
      ),
      belowMinimum.length
        ? card(
            { title: 'Itens abaixo do mínimo', subtitle: belowMinimum.length + ' item(ns) precisam de reposição', flush: true },
            miniTable(
              ['Item', 'Saldo', 'Mínimo', 'Repor'],
              belowMinimum.map((item) => [
                h('div', h('b', item.name), h('div.faint', { style: { fontSize: '11.5px' } }, item.sku)),
                h('b', { style: { color: 'var(--red)' } }, decimal(item.quantity) + ' ' + item.unit),
                decimal(item.minimum_quantity),
                decimal(Math.max(0, Number(item.minimum_quantity) - Number(item.quantity))),
              ]),
            ),
          )
        : null,
    ),
  )
}
