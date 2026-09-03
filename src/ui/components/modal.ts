/** Modal centralizado com backdrop, fechamento por Esc e clique fora. */
import { h, type Child } from '../dom'

export interface ModalOptions {
  title: string
  subtitle?: string
  width?: string
  body: Child
  footer?: Child[]
  onClose?: () => void
}

export interface ModalHandle {
  close: () => void
  element: HTMLElement
}

export function openModal(options: ModalOptions): ModalHandle {
  const dialog = h(
    'div.modal',
    { style: options.width ? { width: options.width } : {} },
    h(
      'div.modal-head',
      h(
        'div',
        h('div.modal-title', options.title),
        options.subtitle ? h('div.modal-sub', options.subtitle) : null,
      ),
      h('div.modal-close', { onClick: () => close() }, '✕'),
    ),
    h('div.modal-body', options.body),
    options.footer?.length ? h('div.modal-foot', options.footer) : null,
  )

  const backdrop = h(
    'div.modal-backdrop',
    {
      onClick: (event: MouseEvent) => {
        if (event.target === backdrop) close()
      },
    },
    dialog,
  )

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') close()
  }

  function close(): void {
    document.removeEventListener('keydown', onKey)
    backdrop.remove()
    options.onClose?.()
  }

  document.addEventListener('keydown', onKey)
  document.body.appendChild(backdrop)
  return { close, element: dialog }
}

/** Confirmacao simples para acoes destrutivas. */
export function confirmModal(title: string, message: string, onConfirm: () => void): ModalHandle {
  const handle: { current: ModalHandle | null } = { current: null }
  handle.current = openModal({
    title,
    width: '440px',
    body: h('p.muted', { style: { margin: '0', fontSize: '13.5px' } }, message),
    footer: [
      h('button.btn.btn-ghost', { onClick: () => handle.current?.close() }, 'Cancelar'),
      h(
        'button.btn',
        {
          style: { background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' },
          onClick: () => {
            handle.current?.close()
            onConfirm()
          },
        },
        'Confirmar',
      ),
    ],
  })
  return handle.current
}
