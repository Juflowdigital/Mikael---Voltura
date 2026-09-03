/** Suprimentos › Patrimônio e Frota — ativos e manutenções. */
import { h, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { kpiCard, KPI_ICONS } from '../../ui/components/kpi'
import { tabs } from '../../ui/components/tabs'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { guard, toast } from '../../ui/components/feedback'
import { date, money, orDash, parseMoney } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import {
  ASSET_STATUS,
  assets,
  CATEGORIES,
  completeMaintenance,
  createAsset,
  createMaintenance,
  isMaintenanceLate,
  maintenances,
  needsMaintenance,
  nextTag,
  saveAsset,
  statusLabel,
  statusTone,
  type AssetInput,
} from '../../data/assets'
import { members, nameOf, type Member } from '../../data/team'
import type { Asset, AssetMaintenance } from '../../core/types'

function assetForm(initial: Asset | null, team: Member[], existing: string[], onSaved: () => Promise<void>): void {
  let draft: AssetInput = {
    asset_tag: initial ? initial.asset_tag : nextTag(existing),
    name: initial ? initial.name : '',
    category: initial ? initial.category : CATEGORIES[0],
    serial_number: initial ? initial.serial_number : null,
    status: initial ? initial.status : 'available',
    responsible_id: initial ? initial.responsible_id : null,
    location: initial ? initial.location : null,
    acquisition_date: initial ? initial.acquisition_date : null,
    acquisition_value: initial ? Number(initial.acquisition_value ?? 0) || null : null,
    next_maintenance_at: initial ? initial.next_maintenance_at : null,
  }
  const patch = (part: Partial<AssetInput>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar item de patrimônio' : 'Novo item de patrimônio',
    width: '660px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      formRow(
        '1fr 2fr',
        textField({ label: 'Patrimônio', value: draft.asset_tag, onInput: (value) => patch({ asset_tag: value }) }),
        textField({ label: 'Nome', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
      ),
      formRow(
        '1fr 1fr 1fr',
        selectField({
          label: 'Categoria',
          value: draft.category,
          options: CATEGORIES.map((entry) => ({ value: entry, label: entry })),
          onChange: (value) => patch({ category: value }),
        }),
        selectField({
          label: 'Situação',
          value: draft.status,
          options: ASSET_STATUS.map((entry) => ({ value: entry.id, label: entry.label })),
          onChange: (value) => patch({ status: value }),
        }),
        textField({ label: 'Nº de série', value: draft.serial_number ?? '', onInput: (value) => patch({ serial_number: value || null }) }),
      ),
      formRow(
        '1fr 1fr',
        selectField({
          label: 'Responsável',
          value: draft.responsible_id ?? '',
          placeholder: 'Sem responsável',
          options: team.map((member) => ({ value: member.userId, label: member.name })),
          onChange: (value) => patch({ responsible_id: value || null }),
        }),
        textField({ label: 'Localização', value: draft.location ?? '', onInput: (value) => patch({ location: value || null }) }),
      ),
      formRow(
        '1fr 1fr 1fr',
        textField({ label: 'Aquisição', type: 'date', value: draft.acquisition_date ?? '', onInput: (value) => patch({ acquisition_date: value || null }) }),
        textField({
          label: 'Valor de aquisição (R$)',
          value: draft.acquisition_value ? String(draft.acquisition_value) : '',
          onInput: (value) => patch({ acquisition_value: value.trim() ? parseMoney(value) : null }),
        }),
        textField({ label: 'Próxima revisão', type: 'date', value: draft.next_maintenance_at ?? '', onInput: (value) => patch({ next_maintenance_at: value || null }) }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome do item.', 'error')
              return
            }
            const ok = await guard(async () => {
              if (initial) await saveAsset(initial.id, draft)
              else await createAsset(draft)
              await onSaved()
            }, initial ? 'Item atualizado.' : 'Item cadastrado.')
            if (ok) handle.close()
          },
        },
        'Salvar item',
      ),
    ],
  })
}

function maintenanceForm(asset: Asset, onSaved: () => Promise<void>): void {
  let description = ''
  let scheduledAt = new Date().toISOString().slice(0, 10)
  let provider = ''
  let cost = 0

  const handle = openModal({
    title: 'Agendar manutenção',
    subtitle: asset.asset_tag + ' · ' + asset.name,
    width: '580px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      textField({ label: 'Descrição', required: true, onInput: (value) => (description = value) }),
      formRow(
        '1fr 1fr 1fr',
        textField({ label: 'Agendada para', type: 'date', value: scheduledAt, onInput: (value) => (scheduledAt = value) }),
        textField({ label: 'Fornecedor', onInput: (value) => (provider = value) }),
        textField({ label: 'Custo previsto (R$)', onInput: (value) => (cost = parseMoney(value)) }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!description.trim()) {
              toast('Descreva a manutenção.', 'error')
              return
            }
            const ok = await guard(async () => {
              await createMaintenance({
                asset_id: asset.id,
                description: description.trim(),
                status: 'pending',
                scheduled_at: scheduledAt || null,
                cost: cost || null,
                provider: provider.trim() || null,
              })
              await saveAsset(asset.id, { status: 'maintenance', next_maintenance_at: scheduledAt || null })
              await onSaved()
            }, 'Manutenção agendada.')
            if (ok) handle.close()
          },
        },
        'Agendar',
      ),
    ],
  })
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  async function draw(): Promise<void> {
    const [rows, repairs, team] = await Promise.all([assets(), maintenances(), members()])
    const assetOf = (id: string) => rows.find((asset) => asset.id === id)
    const activeTab = ctx.query.get('aba') ?? 'ativos'

    const inUse = rows.filter((asset) => asset.status === 'in_use')
    const inMaintenance = rows.filter((asset) => asset.status === 'maintenance')
    const dueSoon = rows.filter(needsMaintenance)
    const totalValue = rows.reduce((sum, asset) => sum + Number(asset.acquisition_value ?? 0), 0)

    const assetColumns: Column<Asset>[] = [
      {
        key: 'asset_tag',
        label: 'Item',
        sortable: true,
        render: (row) =>
          h(
            'div',
            h('div.row', h('b', row.name), needsMaintenance(row) ? badge('Revisão próxima', 'amber') : null),
            h('div.faint', { style: { fontSize: '11.5px', marginTop: '2px' } }, row.asset_tag + ' · ' + row.category),
          ),
      },
      { key: 'serial_number', label: 'Nº de série', render: (row) => orDash(row.serial_number) },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => statusLabel(row.status),
        render: (row) => badge(statusLabel(row.status), statusTone(row.status)),
      },
      { key: 'responsible', label: 'Responsável', value: (row) => nameOf(team, row.responsible_id), render: (row) => nameOf(team, row.responsible_id) },
      { key: 'location', label: 'Localização', render: (row) => orDash(row.location) },
      {
        key: 'acquisition_value',
        label: 'Valor',
        align: 'right',
        sortable: true,
        value: (row) => Number(row.acquisition_value ?? 0),
        render: (row) => (row.acquisition_value ? money(row.acquisition_value) : '—'),
      },
      {
        key: 'next_maintenance_at',
        label: 'Próxima revisão',
        sortable: true,
        value: (row) => row.next_maintenance_at ?? '',
        render: (row) =>
          row.next_maintenance_at
            ? h('span', { style: { color: needsMaintenance(row) ? 'var(--accent)' : 'var(--text)' } }, date(row.next_maintenance_at))
            : h('span.faint', '—'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '180px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '6px' } },
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => maintenanceForm(row, draw) }, 'Manutenção'),
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => assetForm(row, team, rows.map((entry) => entry.asset_tag), draw) }, 'Editar'),
          ),
      },
    ]

    const repairColumns: Column<AssetMaintenance>[] = [
      {
        key: 'asset',
        label: 'Item',
        value: (row) => assetOf(row.asset_id)?.name ?? '',
        render: (row) => {
          const asset = assetOf(row.asset_id)
          return h('div', h('b', asset ? asset.name : '—'), h('div.faint', { style: { fontSize: '11.5px' } }, asset ? asset.asset_tag : ''))
        },
      },
      { key: 'description', label: 'Descrição', sortable: true },
      { key: 'provider', label: 'Fornecedor', render: (row) => orDash(row.provider) },
      {
        key: 'scheduled_at',
        label: 'Agendada para',
        sortable: true,
        value: (row) => row.scheduled_at ?? '',
        render: (row) =>
          row.scheduled_at
            ? h(
                'div.row',
                h('span', { style: { color: isMaintenanceLate(row) ? 'var(--red)' : 'var(--text)' } }, date(row.scheduled_at)),
                isMaintenanceLate(row) ? badge('Vencida', 'red') : null,
              )
            : h('span.faint', '—'),
      },
      {
        key: 'cost',
        label: 'Custo',
        align: 'right',
        value: (row) => Number(row.cost ?? 0),
        render: (row) => (row.cost ? money(row.cost) : '—'),
      },
      {
        key: 'status',
        label: 'Situação',
        value: (row) => row.status,
        render: (row) => badge(row.status === 'completed' ? 'Concluída' : 'Pendente', row.status === 'completed' ? 'green' : 'amber'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '120px',
        render: (row) =>
          row.status === 'completed'
            ? h('span.faint', { style: { fontSize: '12px' } }, row.completed_at ? date(row.completed_at) : '—')
            : h(
                'button.btn.btn-ghost',
                {
                  style: { fontSize: '12px', padding: '4px 10px' },
                  onClick: () => {
                    void guard(async () => {
                      await completeMaintenance(row.id)
                      await saveAsset(row.asset_id, { status: 'available' })
                      await draw()
                    }, 'Manutenção concluída.')
                  },
                },
                'Concluir',
              ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Patrimônio e Frota',
        crumbs: [{ label: 'Suprimentos e Patrimônio' }, { label: 'Patrimônio e Frota' }],
        actions: [h('button.btn.btn-primary', { onClick: () => assetForm(null, team, rows.map((entry) => entry.asset_tag), draw) }, '+ Novo item')],
      }),
      h(
        'div.stack',
        gridCols(
          4,
          kpiCard({ label: 'Itens cadastrados', value: String(rows.length), mark: KPI_ICONS.box, color: '#4ade80', soft: 'rgba(74,222,128,.14)' }),
          kpiCard({ label: 'Em uso', value: String(inUse.length), mark: KPI_ICONS.users, color: '#38bdf8', soft: 'rgba(56,189,248,.14)' }),
          kpiCard({ label: 'Em manutenção', value: String(inMaintenance.length), hint: dueSoon.length + ' com revisão próxima', mark: KPI_ICONS.alert, color: '#f6a623', soft: 'rgba(246,166,35,.14)' }),
          kpiCard({ label: 'Valor do patrimônio', value: money(totalValue), mark: KPI_ICONS.money, color: '#22c55e', soft: 'rgba(34,197,94,.14)' }),
        ),
        card(
          { flush: true },
          h(
            'div',
            { style: { padding: '0 16px' } },
            tabs({
              tabs: [
                { id: 'ativos', label: 'Itens', count: rows.length },
                { id: 'manutencoes', label: 'Manutenções', count: repairs.filter((row) => row.status !== 'completed').length },
              ],
              active: activeTab,
              onChange: (id) => setQuery({ aba: id === 'ativos' ? null : id }),
            }),
          ),
          activeTab === 'manutencoes'
            ? dataTable({
                columns: repairColumns,
                rows: repairs,
                searchable: true,
                searchPlaceholder: 'Buscar manutenção',
                pageSize: 10,
                initialSort: { key: 'scheduled_at', ascending: true },
                emptyTitle: 'Nenhuma manutenção registrada',
                totalLabel: (total) => `${total} manutenção(ões)`,
              })
            : dataTable({
                columns: assetColumns,
                rows,
                searchable: true,
                searchPlaceholder: 'Buscar item de patrimônio',
                pageSize: 10,
                initialSort: { key: 'asset_tag', ascending: true },
                emptyTitle: 'Nenhum item cadastrado',
                emptyHint: 'Cadastre veículos, ferramentas e equipamentos da operação.',
                totalLabel: (total) => `${total} item(ns)`,
              }),
        ),
      ),
    )
  }

  await draw()
}
