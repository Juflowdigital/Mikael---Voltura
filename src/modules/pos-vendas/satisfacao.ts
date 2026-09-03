/** Pós-Vendas › Controle de Satisfação — NPS por cliente. */
import { h, mount } from '../../ui/dom'
import { card, gridCols, gridTemplate } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { donutChart } from '../../ui/components/chart'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { selectField, textAreaField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { dateTime, orDash } from '../../core/format'
import { createNps, npsGroup, npsResponses, npsScore, NPS_LABEL, NPS_TONE } from '../../data/aftersales'
import { findAll as findClients } from '../../data/clients'
import { findAll as findWorks } from '../../data/works'
import type { Client, NpsResponse, Work } from '../../core/types'

function npsForm(clients: Client[], works: Work[], onSaved: () => Promise<void>): void {
  let clientId = ''
  let workId = ''
  let score = 10
  let comment = ''

  const handle = openModal({
    title: 'Registrar resposta de NPS',
    subtitle: 'Nota de 0 a 10: 9 e 10 são promotores, 7 e 8 neutros, 0 a 6 detratores.',
    width: '580px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      selectField({
        label: 'Cliente',
        placeholder: 'Selecione o cliente',
        options: clients.map((client) => ({ value: client.id, label: client.name })),
        onChange: (value) => (clientId = value),
      }),
      selectField({
        label: 'Obra (opcional)',
        placeholder: 'Sem obra',
        options: works.map((work) => ({ value: work.id, label: work.name })),
        onChange: (value) => (workId = value),
      }),
      selectField({
        label: 'Nota',
        value: '10',
        options: Array.from({ length: 11 }, (_, index) => ({ value: String(10 - index), label: String(10 - index) })),
        onChange: (value) => (score = Number(value)),
      }),
      textAreaField({ label: 'Comentário', onInput: (value) => (comment = value) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!clientId) {
              toast('Selecione o cliente.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createNps({ client_id: clientId, work_id: workId || null, score, comment: comment.trim() || null })
              await onSaved()
            }, 'Resposta registrada.')
            if (ok) handle.close()
          },
        },
        'Registrar resposta',
      ),
    ],
  })
}

export async function render(host: HTMLElement): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, clients, works] = await Promise.all([npsResponses(), findClients(), findWorks()])
    const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? '—'

    const promoters = rows.filter((row) => npsGroup(row.score) === 'promoter')
    const passives = rows.filter((row) => npsGroup(row.score) === 'passive')
    const detractors = rows.filter((row) => npsGroup(row.score) === 'detractor')
    const score = npsScore(rows)
    const average = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0
    const zone = score >= 50 ? 'zona de excelência' : score >= 0 ? 'zona de aperfeiçoamento' : 'zona crítica'
    const zoneColor = score >= 50 ? '#22c55e' : score >= 0 ? '#f6a623' : '#ef4444'
    const zoneSoft = score >= 50 ? 'rgba(34,197,94,.14)' : score >= 0 ? 'rgba(246,166,35,.14)' : 'rgba(239,68,68,.14)'

    const columns: Column<NpsResponse>[] = [
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => h('b', clientName(row.client_id)) },
      {
        key: 'score',
        label: 'Nota',
        align: 'right',
        sortable: true,
        value: (row) => row.score,
        render: (row) => h('b', { style: { fontSize: '15px' } }, String(row.score)),
      },
      {
        key: 'group',
        label: 'Classificação',
        value: (row) => NPS_LABEL[npsGroup(row.score)],
        render: (row) => badge(NPS_LABEL[npsGroup(row.score)], NPS_TONE[npsGroup(row.score)]),
      },
      { key: 'comment', label: 'Comentário', render: (row) => orDash(row.comment) },
      { key: 'responded_at', label: 'Respondido em', sortable: true, render: (row) => dateTime(row.responded_at) },
    ]

    mount(
      host,
      pageHead({
        title: 'Controle de Satisfação',
        crumbs: [{ label: 'Pós-Vendas' }, { label: 'Controle de Satisfação' }],
        actions: [
          h(
            'button.btn.btn-primary',
            {
              onClick: () => {
                if (!clients.length) {
                  toast('Cadastre um cliente antes de registrar NPS.', 'error')
                  return
                }
                npsForm(clients, works, draw)
              },
            },
            '+ Registrar resposta',
          ),
        ],
      }),
      h(
        'div.stack',
        gridCols(
          4,
          kpiCard({ label: 'NPS', value: String(score), hint: zone, mark: KPI_ICONS.trophy, color: zoneColor, soft: zoneSoft }),
          kpiCard({
            label: 'Respostas',
            value: String(rows.length),
            hint: 'nota média ' + average.toFixed(1).replace('.', ','),
            mark: KPI_ICONS.chart,
            color: '#38bdf8',
            soft: 'rgba(56,189,248,.14)',
          }),
          kpiCard({ label: 'Promotores', value: String(promoters.length), mark: KPI_ICONS.check, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
          kpiCard({ label: 'Detratores', value: String(detractors.length), mark: KPI_ICONS.alert, color: '#ef4444', soft: 'rgba(239,68,68,.14)' }),
        ),
        gridTemplate(
          '1fr 1.6fr',
          card(
            { title: 'Distribuição', subtitle: 'NPS = % promotores − % detratores' },
            donutChart({
              data: [
                { label: 'Promotores', value: promoters.length, color: '#22c55e' },
                { label: 'Neutros', value: passives.length, color: '#f6a623' },
                { label: 'Detratores', value: detractors.length, color: '#ef4444' },
              ],
              total: rows.length,
              totalLabel: 'Respostas',
            }),
          ),
          card(
            { flush: true },
            dataTable({
              columns,
              rows,
              searchable: true,
              searchPlaceholder: 'Buscar por cliente ou comentário',
              pageSize: 10,
              initialSort: { key: 'responded_at', ascending: false },
              emptyTitle: 'Nenhuma resposta registrada',
              emptyHint: 'Registre a nota do cliente após a entrega da obra.',
              totalLabel: (total) => `${total} resposta(s)`,
            }),
          ),
        ),
      ),
    )
  }

  await draw()
}
