/** Administração › Modelos — modelos de proposta, contrato e entrega (tela M4). */
import { h, icon, mount } from '../../ui/dom'
import { pageHead } from '../../ui/components/page'
import { tabs } from '../../ui/components/tabs'
import { badge } from '../../ui/components/badge'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, selectField, textAreaField, textField } from '../../ui/components/form'
import { emptyState, guard, toast } from '../../ui/components/feedback'
import { date } from '../../core/format'
import { setQuery, type RouteContext } from '../../core/router'
import { app, refreshTenant } from '../../core/session'
import { saveSettings, units } from '../../data/organization'
import { organizationId } from '../../data/db'

const ICON_PLUS = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M12 12v6"/><path d="M9 15h6"/>'
const ICON_DOTS = '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'

export type ModelKind = 'proposta' | 'proposta-texto' | 'contrato' | 'entrega-tecnica'

const KIND_TABS: { id: ModelKind; label: string }[] = [
  { id: 'proposta', label: 'Modelos de Proposta' },
  { id: 'proposta-texto', label: 'Modelos de Proposta em Texto' },
  { id: 'contrato', label: 'Modelos de Contrato' },
  { id: 'entrega-tecnica', label: 'Termo de Entrega Técnica' },
]

export interface DocumentModel {
  id: string
  kind: ModelKind
  name: string
  version: 'Digital' | 'Impressão'
  orientation: 'A4 Horizontal' | 'A4 Vertical'
  isDefault: boolean
  unitId: string | null
  body: string
  createdAt: string
  updatedAt: string | null
}

function stored(): DocumentModel[] {
  const raw = app.get().settings?.document_models
  return Array.isArray(raw) ? (raw as DocumentModel[]) : []
}

async function persist(models: DocumentModel[]): Promise<void> {
  const settings = app.get().settings
  await saveSettings({
    calculation: settings?.calculation ?? {},
    alerts: settings?.alerts ?? {},
    integrations: settings?.integrations ?? {},
    approval_rules: settings?.approval_rules ?? [],
    document_models: models,
  })
  await refreshTenant()
}

function modelForm(kind: ModelKind, initial: DocumentModel | null, unitOptions: { value: string; label: string }[], onSaved: () => Promise<void>): void {
  let draft: DocumentModel = initial
    ? { ...initial }
    : {
        id: 'dm-' + Date.now().toString(36),
        kind,
        name: '',
        version: 'Digital',
        orientation: 'A4 Horizontal',
        isDefault: false,
        unitId: unitOptions[0]?.value ?? null,
        body: '',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      }
  const patch = (part: Partial<DocumentModel>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar modelo' : 'Novo modelo',
    subtitle: 'Use {{cliente}}, {{potencia}}, {{valor}} e {{empresa}} como marcadores substituídos na geração.',
    width: '680px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      textField({ label: 'Nome do modelo', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
      formRow(
        '1fr 1fr 1fr',
        selectField({
          label: 'Versão',
          value: draft.version,
          options: [
            { value: 'Digital', label: 'Digital' },
            { value: 'Impressão', label: 'Impressão' },
          ],
          onChange: (value) => patch({ version: value as DocumentModel['version'] }),
        }),
        selectField({
          label: 'Orientação',
          value: draft.orientation,
          options: [
            { value: 'A4 Horizontal', label: 'A4 Horizontal' },
            { value: 'A4 Vertical', label: 'A4 Vertical' },
          ],
          onChange: (value) => patch({ orientation: value as DocumentModel['orientation'] }),
        }),
        selectField({
          label: 'Unidade de Negócio',
          value: draft.unitId ?? '',
          placeholder: 'Todas',
          options: unitOptions,
          onChange: (value) => patch({ unitId: value || null }),
        }),
      ),
      textAreaField({ label: 'Conteúdo do modelo', value: draft.body, onInput: (value) => patch({ body: value }) }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome do modelo.', 'error')
              return
            }
            const ok = await guard(async () => {
              const models = stored()
              const next = initial
                ? models.map((model) => (model.id === draft.id ? { ...draft, updatedAt: new Date().toISOString() } : model))
                : [...models, draft]
              await persist(next)
              await onSaved()
            }, initial ? 'Modelo atualizado.' : 'Modelo criado.')
            if (ok) handle.close()
          },
        },
        'Salvar modelo',
      ),
    ],
  })
}

function modelCard(model: DocumentModel, unitName: (id: string | null) => string, reload: () => Promise<void>): HTMLElement {
  const menu = h(
    'span',
    {
      title: 'Ações do modelo',
      style: { cursor: 'pointer', color: 'var(--text-faint)' },
      onClick: () => {
        const handle = openModal({
          title: model.name,
          width: '380px',
          body: h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            h('button.btn', { onClick: () => { handle.close(); modelForm(model.kind, model, [], reload) } }, 'Editar modelo'),
            h(
              'button.btn',
              {
                onClick: () => {
                  handle.close()
                  void guard(async () => {
                    await persist(stored().map((entry) => ({ ...entry, isDefault: entry.kind === model.kind ? entry.id === model.id : entry.isDefault })))
                    await reload()
                  }, 'Modelo definido como padrão.')
                },
              },
              'Definir como padrão',
            ),
            h(
              'button.btn',
              {
                style: { color: 'var(--red)', borderColor: 'var(--red)' },
                onClick: () => {
                  handle.close()
                  confirmModal('Excluir modelo', `Excluir "${model.name}"? Documentos já gerados não são afetados.`, () => {
                    void guard(async () => {
                      await persist(stored().filter((entry) => entry.id !== model.id))
                      await reload()
                    }, 'Modelo excluído.')
                  })
                },
              },
              'Excluir modelo',
            ),
          ),
        })
      },
    },
    icon(ICON_DOTS, 16),
  )

  return h(
    'article.card',
    { style: { overflow: 'hidden' } },
    h(
      'div',
      {
        style: {
          height: '120px',
          background: 'linear-gradient(140deg,#132234,#0d1826)',
          borderBottom: '1px solid var(--border)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-faint)',
          fontSize: '12px',
          textAlign: 'center',
          padding: '12px',
        },
      },
      h('div', h('div', { style: { fontSize: '15px', fontWeight: '650', color: 'var(--text-muted)' } }, 'Proposta'), h('div', 'Sistema Solar')),
    ),
    h(
      'div',
      { style: { padding: '14px 16px' } },
      h(
        'div.row',
        { style: { gap: '6px', flexWrap: 'wrap', marginBottom: '10px' } },
        badge('Versão: ' + model.version, model.version === 'Digital' ? 'blue' : 'amber'),
        badge('Orientação: ' + model.orientation, 'gray'),
        model.isDefault ? badge('Padrão', 'green') : null,
      ),
      h('div.row', h('b', { style: { flex: '1' } }, model.name), menu),
      h('div.faint', { style: { fontSize: '11.5px', marginTop: '8px' } }, 'Criado em: ' + date(model.createdAt)),
      h('div.faint', { style: { fontSize: '11.5px' } }, 'Atualizado em: ' + (model.updatedAt ? date(model.updatedAt) : 'Data não definida')),
      h('div.faint', { style: { fontSize: '11.5px', marginTop: '4px' } }, 'Unidade: ' + unitName(model.unitId)),
    ),
  )
}

export async function render(host: HTMLElement, ctx: RouteContext): Promise<void> {
  void organizationId

  async function draw(): Promise<void> {
    const businessUnits = await units()
    const unitOptions = businessUnits.map((unit) => ({ value: unit.id, label: unit.name }))
    const unitName = (id: string | null) => businessUnits.find((unit) => unit.id === id)?.name ?? 'Todas as unidades'

    const activeTab = (ctx.query.get('aba') as ModelKind | null) ?? 'proposta'
    const all = stored()
    const rows = all.filter((model) => model.kind === activeTab)

    mount(
      host,
      pageHead({
        title: 'Modelos',
        crumbs: [{ label: 'Administração', path: '/administracao/visao-geral' }, { label: 'Modelos' }],
      }),
      h(
        'div',
        { style: { marginBottom: '18px' } },
        tabs({
          tabs: KIND_TABS.map((tab) => ({ id: tab.id, label: tab.label, count: all.filter((model) => model.kind === tab.id).length })),
          active: activeTab,
          onChange: (id) => setQuery({ aba: id === 'proposta' ? null : id }),
        }),
      ),
      h(
        'div.grid',
        { style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
        h(
          'article.card',
          {
            style: {
              border: '1px dashed var(--border-strong)',
              display: 'grid',
              placeItems: 'center',
              padding: '32px 20px',
              cursor: 'pointer',
              textAlign: 'center',
            },
            onClick: () => modelForm(activeTab, null, unitOptions, draw),
          },
          h(
            'div',
            h('div.kpi-icon', { style: { background: 'var(--surface-2)', color: 'var(--text-muted)', margin: '0 auto' } }, icon(ICON_PLUS, 18)),
            h('div', { style: { fontSize: '14px', fontWeight: '650', marginTop: '12px' } }, 'Novo Modelo'),
            h('div.faint', { style: { fontSize: '12px', marginTop: '4px' } }, 'Construtor por blocos'),
            h('button.btn.btn-primary', { style: { marginTop: '14px' } }, '+ Criar modelo'),
          ),
        ),
        rows.map((model) => modelCard(model, unitName, draw)),
      ),
      rows.length ? null : h('div', { style: { marginTop: '18px' } }, emptyState({ title: 'Nenhum modelo nesta aba', hint: 'Crie o primeiro modelo pelo cartão à esquerda.' })),
    )
  }

  await draw()
}
