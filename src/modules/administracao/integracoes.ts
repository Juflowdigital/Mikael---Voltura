/** Administração › Integrações — serviços externos e chaves. */
import { h, icon, mount } from '../../ui/dom'
import { card, gridCols } from '../../ui/components/card'
import { pageHead } from '../../ui/components/page'
import { badge } from '../../ui/components/badge'
import { openModal } from '../../ui/components/modal'
import { textField, toggleField } from '../../ui/components/form'
import { banner, guard, toast } from '../../ui/components/feedback'
import { app, refreshTenant } from '../../core/session'
import { saveSettings } from '../../data/organization'

interface Integration {
  id: string
  title: string
  description: string
  mark: string
  color: string
  soft: string
  /** Campo de credencial exibido no modal. */
  credentialLabel: string
}

const CATALOG: Integration[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    description: 'Envio de propostas e avisos de obra pelo WhatsApp Business.',
    mark: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
    color: '#22c55e',
    soft: 'rgba(34,197,94,.14)',
    credentialLabel: 'Token da API',
  },
  {
    id: 'email',
    title: 'E-mail transacional',
    description: 'Disparo de propostas, contratos e cobranças por e-mail.',
    mark: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>',
    color: '#38bdf8',
    soft: 'rgba(56,189,248,.14)',
    credentialLabel: 'Chave de API',
  },
  {
    id: 'assinatura',
    title: 'Assinatura eletrônica',
    description: 'Coleta de assinatura em contratos e termos de entrega.',
    mark: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="m9 15 2 2 4-4"/>',
    color: '#a78bfa',
    soft: 'rgba(167,139,250,.14)',
    credentialLabel: 'Token de integração',
  },
  {
    id: 'nfe',
    title: 'Nota fiscal eletrônica',
    description: 'Emissão de NF-e e NFS-e a partir dos contratos faturados.',
    mark: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    color: '#f6a623',
    soft: 'rgba(246,166,35,.14)',
    credentialLabel: 'Certificado / token',
  },
  {
    id: 'monitoramento',
    title: 'Monitoramento de geração',
    description: 'Leitura da geração dos inversores para o pós-vendas.',
    mark: '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-6"/>',
    color: '#2dd4bf',
    soft: 'rgba(45,212,191,.14)',
    credentialLabel: 'Chave do portal',
  },
  {
    id: 'contabil',
    title: 'Exportação contábil',
    description: 'Envio periódico dos lançamentos financeiros ao contador.',
    mark: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/>',
    color: '#fb7185',
    soft: 'rgba(251,113,133,.14)',
    credentialLabel: 'Endpoint de destino',
  },
]

interface StoredIntegration {
  enabled: boolean
  credential: string
}

function current(): Record<string, StoredIntegration> {
  const raw = app.get().settings?.integrations ?? {}
  const out: Record<string, StoredIntegration> = {}
  for (const entry of CATALOG) {
    const value = (raw as Record<string, unknown>)[entry.id] as Partial<StoredIntegration> | undefined
    out[entry.id] = { enabled: Boolean(value?.enabled), credential: String(value?.credential ?? '') }
  }
  return out
}

async function persist(next: Record<string, StoredIntegration>): Promise<void> {
  const settings = app.get().settings
  const integrations = { ...(settings?.integrations ?? {}), ...next }
  await saveSettings({
    calculation: settings?.calculation ?? {},
    alerts: settings?.alerts ?? {},
    document_models: settings?.document_models ?? [],
    approval_rules: settings?.approval_rules ?? [],
    integrations,
  })
  await refreshTenant()
}

function credentialModal(entry: Integration, value: StoredIntegration, reload: () => Promise<void>): void {
  let credential = value.credential

  const handle = openModal({
    title: entry.title,
    subtitle: entry.description,
    width: '520px',
    body: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      banner('info', 'A credencial fica guardada nas configurações da organização e nunca aparece em relatórios ou exportações.'),
      textField({
        label: entry.credentialLabel,
        type: 'password',
        value: credential,
        placeholder: 'Cole a credencial aqui',
        onInput: (input) => (credential = input),
      }),
    ),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.close() }, 'Cancelar'),
      h(
        'button.btn.btn-primary',
        {
          onClick: async () => {
            const ok = await guard(async () => {
              await persist({ [entry.id]: { enabled: value.enabled, credential: credential.trim() } })
              await reload()
            }, 'Credencial salva.')
            if (ok) handle.close()
          },
        },
        'Salvar credencial',
      ),
    ],
  })
}

export function render(host: HTMLElement): void {
  function draw(): void {
    const state = current()

    mount(
      host,
      pageHead({
        title: 'Integrações',
        crumbs: [{ label: 'Administração', path: '/administracao/visao-geral' }, { label: 'Integrações' }],
      }),
      h(
        'div.stack',
        banner(
          'warn',
          'Ligar uma integração aqui apenas guarda a configuração. O envio real (e-mail, WhatsApp, NF-e) depende da contratação do serviço externo e precisa ser testado por você em produção.',
        ),
        gridCols(
          3,
          ...CATALOG.map((entry) => {
            const value = state[entry.id]
            return card(
              {},
              h(
                'div.row',
                h('div.kpi-icon', { style: { background: entry.soft, color: entry.color } }, icon(entry.mark, 17)),
                h('span.spacer'),
                value.enabled ? badge('Ativa', 'green') : badge('Inativa', 'gray'),
              ),
              h('div', { style: { fontSize: '15px', fontWeight: '650', marginTop: '14px' } }, entry.title),
              h('div.muted', { style: { fontSize: '12.5px', marginTop: '6px', lineHeight: '1.55' } }, entry.description),
              h(
                'div',
                { style: { marginTop: '14px' } },
                toggleField('Habilitar integração', value.enabled, (enabled) => {
                  if (enabled && !value.credential) {
                    toast('Cadastre a credencial antes de habilitar.', 'error')
                    credentialModal(entry, value, async () => draw())
                    return
                  }
                  void guard(async () => {
                    await persist({ [entry.id]: { ...value, enabled } })
                    draw()
                  }, enabled ? 'Integração habilitada.' : 'Integração desabilitada.')
                }),
              ),
              h(
                'div.row',
                { style: { marginTop: '12px', gap: '8px' } },
                h('button.btn', { style: { fontSize: '12.5px' }, onClick: () => credentialModal(entry, value, async () => draw()) }, value.credential ? 'Alterar credencial' : 'Cadastrar credencial'),
                value.credential ? h('span.faint', { style: { fontSize: '11.5px' } }, 'Credencial salva') : null,
              ),
            )
          }),
        ),
      ),
    )
  }

  draw()
}
