/** Administração › Regras de Aprovação — alçadas por valor e desconto. */
import { h, mount } from '../../ui/dom'
import { card } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { dataTable, type Column } from '../../ui/components/table'
import { badge } from '../../ui/components/badge'
import { confirmModal, openModal } from '../../ui/components/modal'
import { formRow, selectField, textField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { money, parseMoney, percent } from '../../core/format'
import { app, refreshTenant, ROLE_LABEL } from '../../core/session'
import { saveSettings } from '../../data/organization'
import type { Role } from '../../core/types'

export type Trigger = 'valor-contrato' | 'desconto' | 'margem-minima'

const TRIGGER_LABEL: Record<Trigger, string> = {
  'valor-contrato': 'Valor do contrato acima de',
  desconto: 'Desconto acima de',
  'margem-minima': 'Margem abaixo de',
}

const TRIGGER_UNIT: Record<Trigger, 'moeda' | 'percentual'> = {
  'valor-contrato': 'moeda',
  desconto: 'percentual',
  'margem-minima': 'percentual',
}

export interface ApprovalRule {
  id: string
  name: string
  trigger: Trigger
  threshold: number
  approverRole: Role
  quorum: number
  active: boolean
}

const ROLES: Role[] = ['admin', 'commercial', 'engineering', 'finance']

function stored(): ApprovalRule[] {
  const raw = app.get().settings?.approval_rules
  return Array.isArray(raw) ? (raw as ApprovalRule[]) : []
}

async function persist(rules: ApprovalRule[]): Promise<void> {
  const settings = app.get().settings
  await saveSettings({
    calculation: settings?.calculation ?? {},
    alerts: settings?.alerts ?? {},
    integrations: settings?.integrations ?? {},
    document_models: settings?.document_models ?? [],
    approval_rules: rules,
  })
  await refreshTenant()
}

function ruleForm(initial: ApprovalRule | null, onSaved: () => Promise<void>): void {
  let draft: ApprovalRule = initial
    ? { ...initial }
    : {
        id: 'ar-' + Date.now().toString(36),
        name: '',
        trigger: 'valor-contrato',
        threshold: 0,
        approverRole: 'admin',
        quorum: 1,
        active: true,
      }
  const patch = (part: Partial<ApprovalRule>) => {
    draft = { ...draft, ...part }
  }

  const handle = openModal({
    title: initial ? 'Editar regra' : 'Nova regra de aprovação',
    subtitle: 'Quando a condição bater, o documento fica retido até o quórum aprovar.',
    width: '600px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      textField({ label: 'Nome da regra', required: true, value: draft.name, onInput: (value) => patch({ name: value }) }),
      formRow(
        '2fr 1fr',
        selectField({
          label: 'Condição',
          value: draft.trigger,
          options: (Object.keys(TRIGGER_LABEL) as Trigger[]).map((key) => ({ value: key, label: TRIGGER_LABEL[key] })),
          onChange: (value) => patch({ trigger: value as Trigger }),
        }),
        textField({
          label: 'Limite',
          value: draft.threshold ? String(draft.threshold) : '',
          onInput: (value) => patch({ threshold: parseMoney(value) }),
        }),
      ),
      formRow(
        '2fr 1fr',
        selectField({
          label: 'Perfil aprovador',
          value: draft.approverRole,
          options: ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] })),
          onChange: (value) => patch({ approverRole: value as Role }),
        }),
        textField({
          label: 'Quórum (aprovações)',
          value: String(draft.quorum),
          onInput: (value) => patch({ quorum: Math.max(1, Math.round(parseMoney(value)) || 1) }),
        }),
      ),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            if (!draft.name.trim()) {
              toast('Informe o nome da regra.', 'error')
              return
            }
            if (draft.threshold <= 0) {
              toast('Informe um limite maior que zero.', 'error')
              return
            }
            const ok = await guard(async () => {
              const rules = stored()
              await persist(initial ? rules.map((rule) => (rule.id === draft.id ? draft : rule)) : [...rules, draft])
              await onSaved()
            }, initial ? 'Regra atualizada.' : 'Regra criada.')
            if (ok) handle.close()
          },
        },
        'Salvar regra',
      ),
    ],
  })
}

export function render(host: HTMLElement): void {
  function draw(): void {
    const rules = stored()

    const columns: Column<ApprovalRule>[] = [
      { key: 'name', label: 'Regra', sortable: true, render: (row) => h('b', row.name) },
      {
        key: 'trigger',
        label: 'Condição',
        value: (row) => TRIGGER_LABEL[row.trigger],
        render: (row) =>
          h(
            'span',
            TRIGGER_LABEL[row.trigger] + ' ',
            h('b', TRIGGER_UNIT[row.trigger] === 'moeda' ? money(row.threshold) : percent(row.threshold, 0)),
          ),
      },
      { key: 'approverRole', label: 'Aprovador', value: (row) => ROLE_LABEL[row.approverRole], render: (row) => ROLE_LABEL[row.approverRole] },
      { key: 'quorum', label: 'Quórum', align: 'right', render: (row) => String(row.quorum) },
      {
        key: 'active',
        label: 'Situação',
        value: (row) => (row.active ? 'Ativa' : 'Inativa'),
        render: (row) => badge(row.active ? 'Ativa' : 'Inativa', row.active ? 'green' : 'gray'),
      },
      {
        key: 'actions',
        label: 'Ações',
        align: 'right',
        width: '170px',
        render: (row) =>
          h(
            'div.row',
            { style: { justifyContent: 'flex-end', gap: '8px' } },
            h(
              'button.btn.btn-ghost',
              {
                style: { fontSize: '12px', padding: '4px 10px' },
                onClick: () => {
                  void guard(async () => {
                    await persist(stored().map((rule) => (rule.id === row.id ? { ...rule, active: !rule.active } : rule)))
                    draw()
                  }, row.active ? 'Regra desativada.' : 'Regra ativada.')
                },
              },
              row.active ? 'Desativar' : 'Ativar',
            ),
            h('button.btn.btn-ghost', { style: { fontSize: '12px', padding: '4px 10px' }, onClick: () => ruleForm(row, async () => draw()) }, 'Editar'),
            h(
              'button.btn.btn-ghost',
              {
                style: { fontSize: '12px', padding: '4px 10px', color: 'var(--red)' },
                onClick: () =>
                  confirmModal('Excluir regra', `Excluir "${row.name}"? Documentos já aprovados não são afetados.`, () => {
                    void guard(async () => {
                      await persist(stored().filter((rule) => rule.id !== row.id))
                      draw()
                    }, 'Regra excluída.')
                  }),
              },
              'Excluir',
            ),
          ),
      },
    ]

    mount(
      host,
      pageHead({
        title: 'Regras de Aprovação',
        crumbs: [{ label: 'Administração', path: '/administracao/visao-geral' }, { label: 'Regras de Aprovação' }],
        actions: [h('button.btn.btn-primary', { onClick: () => ruleForm(null, async () => draw()) }, '+ Nova regra')],
      }),
      h(
        'div.stack',
        banner(
          'info',
          'As regras definem quando um contrato ou proposta precisa de aprovação antes de seguir. O bloqueio efetivo é aplicado nos módulos Comercial e Contratos conforme forem migrados.',
        ),
        card(
          { flush: true },
          dataTable({
            columns,
            rows: rules,
            searchable: true,
            searchPlaceholder: 'Buscar regra',
            emptyTitle: 'Nenhuma regra cadastrada',
            emptyHint: 'Sem regras, propostas e contratos seguem direto, sem retenção.',
            totalLabel: (total) => `${total} regra(s)`,
          }),
        ),
      ),
    )
  }

  draw()
}
