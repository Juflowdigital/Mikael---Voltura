/**
 * Tabela de dados com busca, ordenacao, paginacao e estado vazio,
 * reproduzindo o comportamento das listas do ASTER.
 */
import { h, icon, mount, type Child } from '../dom'
import { emptyState } from './feedback'

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  width?: string
  sortable?: boolean
  /** Valor usado para ordenar e buscar. Padrao: `row[key]`. */
  value?: (row: T) => string | number | null | undefined
  render?: (row: T) => Child
}

export interface TableOptions<T> {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  /** Texto do estado vazio. */
  emptyTitle?: string
  emptyHint?: string
  /** Mostra a barra de busca acima da tabela. */
  searchable?: boolean
  searchPlaceholder?: string
  /** Paginacao. `0` desliga. */
  pageSize?: number
  pageSizes?: number[]
  /** Rodape alternativo, ex.: "5 registro(s)". */
  totalLabel?: (total: number) => string
  initialSort?: { key: string; ascending: boolean }
}

const SEARCH_ICON =
  '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'

function cellValue<T>(column: Column<T>, row: T): string | number | null | undefined {
  if (column.value) return column.value(row)
  return (row as Record<string, unknown>)[column.key] as string | number | null | undefined
}

export function dataTable<T>(options: TableOptions<T>): HTMLElement {
  const host = h('div')
  const state = {
    term: '',
    sort: options.initialSort ?? null,
    page: 0,
    pageSize: options.pageSize ?? 0,
  }

  function visibleRows(): T[] {
    let rows = options.rows
    if (state.term) {
      const term = state.term.toLowerCase()
      rows = rows.filter((row) =>
        options.columns.some((column) => String(cellValue(column, row) ?? '').toLowerCase().includes(term)),
      )
    }
    if (state.sort) {
      const column = options.columns.find((entry) => entry.key === state.sort!.key)
      if (column) {
        const direction = state.sort.ascending ? 1 : -1
        rows = [...rows].sort((a, b) => {
          const left = cellValue(column, a) ?? ''
          const right = cellValue(column, b) ?? ''
          if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction
          return String(left).localeCompare(String(right), 'pt-BR', { numeric: true }) * direction
        })
      }
    }
    return rows
  }

  function toggleSort(key: string): void {
    state.sort = state.sort?.key === key ? { key, ascending: !state.sort.ascending } : { key, ascending: true }
    state.page = 0
    draw()
  }

  function header(): HTMLElement {
    return h(
      'thead',
      h(
        'tr',
        options.columns.map((column) =>
          h(
            'th',
            {
              class: (column.align === 'right' ? 'col-right' : '') + (column.sortable ? ' is-sortable' : ''),
              style: column.width ? { width: column.width } : {},
              onClick: column.sortable ? () => toggleSort(column.key) : undefined,
            },
            column.label,
            column.sortable && state.sort?.key === column.key
              ? h('span', { style: { marginLeft: '5px' } }, state.sort.ascending ? '↑' : '↓')
              : null,
          ),
        ),
      ),
    )
  }

  function body(rows: T[]): HTMLElement {
    return h(
      'tbody',
      rows.map((row) =>
        h(
          'tr',
          {
            class: options.onRowClick ? 'is-clickable' : '',
            onClick: options.onRowClick ? () => options.onRowClick!(row) : undefined,
          },
          options.columns.map((column) =>
            h(
              'td',
              { class: column.align === 'right' ? 'col-right' : '' },
              column.render ? column.render(row) : String(cellValue(column, row) ?? '—'),
            ),
          ),
        ),
      ),
    )
  }

  function footer(total: number): HTMLElement | null {
    if (!state.pageSize) {
      return options.totalLabel
        ? h('div.table-foot', h('span.spacer'), options.totalLabel(total), h('span.spacer'))
        : null
    }
    const pages = Math.max(1, Math.ceil(total / state.pageSize))
    const from = total === 0 ? 0 : state.page * state.pageSize + 1
    const to = Math.min(total, (state.page + 1) * state.pageSize)
    const sizes = options.pageSizes ?? [5, 10, 25, 50]

    return h(
      'div.table-foot',
      h('span.spacer'),
      'Linhas por página:',
      h(
        'select.page-size',
        {
          onChange: (event: Event) => {
            state.pageSize = Number((event.target as HTMLSelectElement).value)
            state.page = 0
            draw()
          },
        },
        sizes.map((size) => h('option', { value: String(size), selected: size === state.pageSize }, String(size))),
      ),
      h('span.mono-num', `${from}-${to} de ${total}`),
      h(
        'button.btn.btn-ghost.btn-icon',
        {
          disabled: state.page === 0,
          onClick: () => {
            state.page -= 1
            draw()
          },
        },
        '‹',
      ),
      h(
        'button.btn.btn-ghost.btn-icon',
        {
          disabled: state.page >= pages - 1,
          onClick: () => {
            state.page += 1
            draw()
          },
        },
        '›',
      ),
    )
  }

  function draw(): void {
    const all = visibleRows()
    const rows = state.pageSize ? all.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize) : all

    mount(
      host,
      options.searchable
        ? h(
            'div',
            { style: { padding: '14px 16px 4px' } },
            h(
              'div.search-box',
              h('span.faint', icon(SEARCH_ICON, 15)),
              h('input', {
                placeholder: options.searchPlaceholder ?? 'Buscar…',
                value: state.term,
                onInput: (event: Event) => {
                  state.term = (event.target as HTMLInputElement).value
                  state.page = 0
                  draw()
                },
              }),
            ),
          )
        : null,
      all.length
        ? h('div.table-wrap', h('table.data', header(), body(rows)))
        : emptyState({ title: options.emptyTitle ?? 'Sem conteúdo', hint: options.emptyHint }),
      all.length ? footer(all.length) : null,
    )
  }

  draw()
  return host
}

export { SEARCH_ICON }
