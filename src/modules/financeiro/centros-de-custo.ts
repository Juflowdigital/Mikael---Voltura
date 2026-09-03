/** Financeiro › Centros de Custo — orçamento e realizado no mês. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField, toggleField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { money, parseMoney, percent } from '../../core/format'
import { costCenters, createCostCenter, saveCostCenter, transactions, type CostCenterInput } from '../../data/finance'
import type { CostCenter, FinancialTransaction } from '../../core/types'

const KINDS = [
  { value: 'both', label: 'Receita e despesa' },
  { value: 'income', label: 'Somente receita' },
  { value: 'expense', label: 'Somente despesa' },
]

function kindLabel(kind: CostCenter['kind']): string {
  const found = KINDS.find((entry) => entry.value === kind)
  return found ? found.label : kind
}

function centerForm(initial: CostCenter | null, onSaved: () => Promise<void>): void {
  let draft: CostCenterInput = {
    code: initial ? initial.code : '',
    name: initial ? initial.name : '',
    kind: initial ? initial.kind : 'both',
    monthly_budget: Number(initial ? initial.monthly_budget : 0),
    active: initial ? initial.active : true,
  }
  const patch = (part: Partial<CostCenterInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar centro de custo' : 'Novo centro de custo',
    subtitle: 'O orçamento mensal é comparado ao realizado do mês corrente.',
    width: '580px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 2fr',
        textField({ label: 'Código', required: true, value: draft.code, onInput: (value) => patch({ code: value.toUpperCase() }) }),
        textField({ label: 'Nome', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
      ),
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Tipo',
          value: draft.kind,
          options: KINDS,
          onChange: (value) => patch({ kind: value as CostCenterInput['kind'] }),
        }),
        textField({
          label: 'Orçamento mensal (R$)',
          value: String(draft.monthly_budget),
          onInput: (value) => patch({ monthly_budget: parseMoney(value) }),
        }),
      ),
      toggleField('Centro ativo', draft.active, (value) => patch({ active: value })),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.code.trim() || !draft.name.trim()) {
              toast('Informe código e nome do centro de custo.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) await saveCostCenter(initial.id, draft)
              else await createCostCenter(draft)
              await onSaved()
            }, initial ? 'Centro de custo atualizado.' : 'Centro de custo cadastrado.')
            if (ok) handle.close()
          },
        },
        'Salvar centro',
      ),
    ],
  })
}

export async function render(host: HTMLElement): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, movements] = await Promise.all([costCenters(), transactions()])
    const month = new Date().toISOString().slice(0, 7)

    const realizedOf = (center: CostCenter, direction: 'income' | 'expense') =>
      movements
        .filter(
          (row: FinancialTransaction) =>
            row.cost_center_id === center.id && row.direction === direction && row.due_date.slice(0, 7) === month,
        )
        .reduce((sum, row) => sum + Number(row.amount), 0)

    const columns: Column<CostCenter>[] = [
      {
        key: 'code',
        label: 'Centro',
        sortable: true,
        render: (row) => h('div', h('b', row.code), h('div.faint', { style: { fontSize: '11.5px' } }, row.name)),
      },
      {
        key: 'kind',
        label: 'Tipo',
        value: (row) => kindLabel(row.kind),
        render: (row) => badge(kindLabel(row.kind), row.kind === 'income' ? 'green' : row.kind === 'expense' ? 'amber' : 'blue'),
      },
      {
        key: 'income',
        label: 'Receita no mês',
        align: 'right',
        value: (row) => realizedOf(row, 'income'),
        render: (row) => h('span', { style: { color: 'var(--green)' } }, money(realizedOf(row, 'income'))),
      },
      {
        key: 'expense',
        label: 'Despesa no mês',
        align: 'right',
        value: (row) => realizedOf(row, 'expense'),
        render: (row) => h('span', { style: { color: 'var(--accent)' } }, money(realizedOf(row, 'expense'))),
      },
      {
        key: 'budget',
        label: 'Orçamento',
        align: 'right',
        value: (row) => Number(row.monthly_budget),
        render: (row) => (Number(row.monthly_budget) > 0 ? money(row.monthly_budget) : h('span.faint', 'Sem orçamento')),
      },
      {
        key: 'usage',
        label: 'Consumo do orçamento',
        align: 'right',
        sortable: true,
        value: (row) => (Number(row.monthly_budget) > 0 ? (realizedOf(row, 'expense') / Number(row.monthly_budget)) * 100 : 0),
        render: (row) => {
          const budget = Number(row.monthly_budget)
          if (budget <= 0) return h('span.faint', '—')
          const ratio = (realizedOf(row, 'expense') / budget) * 100
          const over = ratio > 100
          return h(
            'div',
            { style: { minWidth: '120px' } },
            h(
              'div.row',
              { style: { justifyContent: 'flex-end', fontSize: '12px', marginBottom: '4px', color: over ? 'var(--red)' : 'var(--text)' } },
              percent(ratio, 0),
            ),
            h('div.progress', h('span', { style: { width: Math.min(100, ratio) + '%', background: over ? 'var(--red)' : 'var(--accent)' } })),
          )
        },
      },
      {
        key: 'active',
        label: 'Situação',
        value: (row) => (row.active ? 'Ativo' : 'Inativo'),
        render: (row) => badge(row.active ? 'Ativo' : 'Inativo', row.active ? 'green' : 'gray'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '100px',
        render: (row) => h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => centerForm(row, draw) }, 'Editar'),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Centros de Custo',
        crumbs: [{ label: 'Financeiro' }, { label: 'Centros de Custo' }],
        actions: [h('button.btn.btn-primary', { onClick: () => centerForm(null, draw) }, '+ Novo centro')],
      }),
      card(
        { flush: true },
        dataTable({
          columns,
          rows,
          searchable: true,
          searchPlaceholder: 'Buscar centro de custo',
          initialSort: { key: 'code', ascending: true },
          emptyTitle: 'Nenhum centro de custo cadastrado',
          emptyHint: 'Centros de custo classificam receitas e despesas nos relatórios.',
          totalLabel: (total) => `${total} centro(s)`,
        }),
      ),
    )
  }

  await draw()
}
