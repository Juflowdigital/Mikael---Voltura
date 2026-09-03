/** Financeiro › Notas Fiscais — controle de emissão. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { date, isoDay, money, orDash, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  createInvoice,
  INVOICE_LABEL,
  INVOICE_TONE,
  invoices,
  nextInvoiceNumber,
  setInvoiceStatus,
  type InvoiceInput,
} from '../../data/finance'
import { findAll as findClients } from '../../data/clients'
import { findAll as findContracts } from '../../data/contracts'
import type { Invoice, InvoiceStatus } from '../../core/types'

const STATUSES: InvoiceStatus[] = ['draft', 'issued', 'cancelled', 'error']

function invoiceForm(
  clients: { id: string; name: string }[],
  contracts: { id: string; contract_number: string; client_id: string; total_value: number }[],
  existing: string[],
  onSaved: () => Promise<void>,
): void {
  let draft: InvoiceInput = {
    number: nextInvoiceNumber(existing),
    series: '1',
    kind: 'nfe',
    client_id: null,
    contract_id: null,
    issue_date: isoDay(),
    total_value: 0,
    status: 'draft',
    notes: null,
  }
  const patch = (part: Partial<InvoiceInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: 'Nova nota fiscal',
    subtitle: 'O Voltura registra e controla a nota. A emissão junto à SEFAZ depende da integração fiscal contratada.',
    width: '660px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      banner('warn', 'Este cadastro não emite a nota na SEFAZ. Ele controla numeração, valor e situação para conferência do contador.'),
      formRow(
        '1fr 1fr 1fr',
        selectField({
          label: 'Tipo',
          value: 'nfe',
          options: [
            { value: 'nfe', label: 'NF-e (produto)' },
            { value: 'nfse', label: 'NFS-e (serviço)' },
          ],
          onChange: (value) => patch({ kind: value as InvoiceInput['kind'] }),
        }),
        textField({ label: 'Número', required: true, value: draft.number, onInput: (value) => patch({ number: value }) }),
        textField({ label: 'Série', value: draft.series ?? '', onInput: (value) => patch({ series: value || null }) }),
      ),
      selectField({
        label: 'Contrato (opcional)',
        placeholder: 'Sem contrato',
        options: contracts.map((contract) => ({ value: contract.id, label: contract.contract_number })),
        onChange: (value) => {
          const contract = contracts.find((entry) => entry.id === value)
          patch({
            contract_id: value || null,
            client_id: contract ? contract.client_id : draft.client_id,
            total_value: contract ? Number(contract.total_value) : draft.total_value,
          })
        },
      }),
      selectField({
        label: 'Cliente',
        placeholder: 'Sem cliente',
        options: clients.map((client) => ({ value: client.id, label: client.name })),
        onChange: (value) => patch({ client_id: value || null }),
      }),
      formRow(
        '1fr 1fr',
        textField({ label: 'Data de emissão', type: 'date', value: draft.issue_date, onInput: (value) => patch({ issue_date: value }) }),
        textField({ label: 'Valor total (R$)', required: true, onInput: (value) => patch({ total_value: parseMoney(value) }) }),
      ),
      textField({ label: 'Observação', onInput: (value) => patch({ notes: value || null }) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.number.trim()) {
              toast('Informe o número da nota.', 'error')
              return
            }
            if (draft.total_value <= 0) {
              toast('Informe um valor maior que zero.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createInvoice(draft)
              await onSaved()
            }, 'Nota fiscal registrada.')
            if (ok) handle.close()
          },
        },
        'Salvar nota',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, clients, contracts] = await Promise.all([invoices(), findClients(), findContracts()])
    const clientName = (id: string | null) => clients.find((client) => client.id === id)?.name ?? '—'
    const contractNumber = (id: string | null) => contracts.find((contract) => contract.id === id)?.contract_number ?? '—'

    const activeTab = ctx.query.get('aba') ?? 'todas'
    const visible = activeTab === 'todas' ? rows : rows.filter((row) => row.status === activeTab)

    const columns: Column<Invoice>[] = [
      {
        key: 'number',
        label: 'Nota',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('b', row.kind.toUpperCase() + ' ' + row.number),
            h('div.faint', { style: { fontSize: '11.5px' } }, 'Série ' + orDash(row.series) + ' · ' + contractNumber(row.contract_id)),
          ),
      },
      { key: 'client', label: 'Cliente', sortable: true, value: (row) => clientName(row.client_id), render: (row) => clientName(row.client_id) },
      { key: 'issue_date', label: 'Emissão', sortable: true, render: (row) => date(row.issue_date) },
      {
        key: 'total_value',
        label: 'Valor',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.total_value),
        render: (row) => h('b', money(row.total_value)),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => INVOICE_LABEL[row.status],
        render: (row) => badge(INVOICE_LABEL[row.status], INVOICE_TONE[row.status]),
      },
      { key: 'notes', label: 'Observação', render: (row) => orDash(row.notes) },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '190px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            row.status === 'draft'
              ? h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px' },
                    onClick: () => {
                      void guard(async () => {
                        await setInvoiceStatus(row.id, 'issued')
                        await draw()
                      }, 'Nota marcada como emitida.')
                    },
                  },
                  'Marcar emitida',
                )
              : null,
            row.status !== 'cancelled'
              ? h(
                  'button.btn.btn-ghost',
                  {
                    style: { fontSize: '12px', padding: '4px 10px', color: 'var(--red)' },
                    onClick: () => {
                      void guard(async () => {
                        await setInvoiceStatus(row.id, 'cancelled')
                        await draw()
                      }, 'Nota cancelada.')
                    },
                  },
                  'Cancelar',
                )
              : null,
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Notas Fiscais',
        crumbs: [{ label: 'Financeiro' }, { label: 'Notas Fiscais' }],
        actions: [
          h(
            'button.btn.btn-primary',
            { onClick: () => invoiceForm(clients, contracts, rows.map((row) => row.number), draw) },
            '+ Nova nota',
          ),
        ],
      }),
      h(
        'div.stack',
        banner(
          'warn',
          'Emissão real na SEFAZ depende da integração fiscal (Administração › Integrações). Aqui você controla numeração, valor e situação — precisa de teste manual seu antes de valer como emissão oficial.',
        ),
        card(
          { flush: true },
          h(
            'div',
            { style: { padding: '0 16px' } },
            tabs({
              tabs: [
                { id: 'todas', label: 'Todas', count: rows.length },
                ...STATUSES.map((status) => ({
                  id: status,
                  label: INVOICE_LABEL[status],
                  count: rows.filter((row) => row.status === status).length,
                })),
              ],
              active: activeTab,
              onChange: (id) => setQuery({ aba: id === 'todas' ? null : id }),
            }),
          ),
          dataTable({
            columns,
            rows: visible,
            searchable: true,
            searchPlaceholder: 'Buscar nota fiscal',
            pageSize: 10,
            initialSort: { key: 'issue_date', ascending: false },
            emptyTitle: 'Nenhuma nota nesta situação',
            emptyHint: 'Registre as notas emitidas para conferência com o contador.',
            totalLabel: (total) => `${total} nota(s)`,
          }),
        ),
      ),
    )
  }

  await draw()
}
