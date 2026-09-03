/** Tela de acesso. Mantem o discurso de marca do app anterior. */
import { h, mount } from '../ui/dom'
import { app, signIn } from '../core/session'
import { brandMark } from './sidebar'

export function renderLogin(host: HTMLElement): void {
  const state = app.get()
  let email = state.authEmail
  let password = ''

  const button = h('button.btn.btn-primary', { style: { width: '100%', justifyContent: 'center', marginTop: '8px' } },
    state.authLoading ? 'Entrando…' : 'Entrar') as HTMLButtonElement

  async function submit(): Promise<void> {
    app.set({ authEmail: email })
    await signIn(email, password)
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') void submit()
  }

  button.disabled = state.authLoading
  button.addEventListener('click', () => void submit())

  mount(
    host,
    h(
      'div.login-shell',
      h(
        'div.login-brand',
        h(
          'div.row',
          h('div.sidebar-brand-mark', brandMark()),
          h('div', { style: { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '20px', letterSpacing: '.12em' } }, 'VOLTURA'),
          h(
            'span',
            { style: { fontSize: '11px', color: 'var(--text-faint)', border: '1px solid var(--border-strong)', borderRadius: '99px', padding: '2px 9px' } },
            'ERP Solar',
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '540px' } },
          h('div', { style: { width: '44px', height: '3px', borderRadius: '99px', background: 'var(--accent)' } }),
          h(
            'div',
            { style: { fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: '600', lineHeight: '1.08', letterSpacing: '-.035em' } },
            'Toda a operação solar.',
            h('br'),
            'Uma única plataforma.',
          ),
          h(
            'div.muted',
            { style: { fontSize: '15px', lineHeight: '1.7', maxWidth: '480px' } },
            'Gestão comercial, engenharia, obras, estoque e financeiro conectados para sua empresa crescer com controle.',
          ),
        ),
        h('div.faint', { style: { fontSize: '12px' } }, 'Voltura Energia · Sistema de gestão para integradores fotovoltaicos'),
      ),
      h(
        'div.login-panel',
        h(
          'div.login-card',
          h(
            'div',
            h(
              'div',
              { style: { fontSize: '10px', fontWeight: '700', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)' } },
              'Acesso seguro',
            ),
            h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '650', marginTop: '6px' } }, 'Bem-vindo de volta'),
            h('div.muted', { style: { fontSize: '13px', margin: '5px 0 18px' } }, 'Entre com as credenciais da sua empresa.'),
          ),
          h('label.field-label', 'E-mail'),
          h('input.input', {
            type: 'email',
            value: email,
            autocomplete: 'email',
            placeholder: 'voce@empresa.com.br',
            onInput: (event: Event) => (email = (event.target as HTMLInputElement).value),
            onKeyDown: onKey,
          }),
          h('label.field-label', { style: { marginTop: '6px' } }, 'Senha'),
          h('input.input', {
            type: 'password',
            autocomplete: 'current-password',
            placeholder: 'Digite sua senha',
            onInput: (event: Event) => (password = (event.target as HTMLInputElement).value),
            onKeyDown: onKey,
          }),
          state.authError ? h('div', { style: { fontSize: '12.5px', color: 'var(--red)' } }, state.authError) : null,
          button,
          h(
            'div.row',
            { style: { justifyContent: 'center', gap: '7px', marginTop: '14px', fontSize: '11.5px', color: 'var(--text-faint)' } },
            h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' } }),
            'Ambiente protegido e monitorado',
          ),
          h(
            'div',
            { style: { marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '11px', color: 'var(--text-faint)' } },
            'Criado por ',
            h('b', { style: { color: 'var(--text-muted)' } }, 'JuFlow Digital'),
          ),
        ),
      ),
    ),
  )
}
