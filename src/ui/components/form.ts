/** Campos de formulario com rotulo flutuante, como no ASTER. */
import { h, type Child } from '../dom'

export interface FieldOptions {
  label?: string
  value?: string
  placeholder?: string
  type?: string
  required?: boolean
  disabled?: boolean
  onInput?: (value: string) => void
  onEnter?: () => void
}

export function textField(options: FieldOptions): HTMLElement {
  const input = h('input.input', {
    type: options.type ?? 'text',
    value: options.value ?? '',
    placeholder: options.placeholder ?? options.label ?? '',
    disabled: options.disabled,
    onInput: (event: Event) => options.onInput?.((event.target as HTMLInputElement).value),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter') options.onEnter?.()
    },
  })
  return h(
    'label.field',
    options.label ? h('span.field-label', options.label + (options.required ? ' *' : '')) : null,
    input,
  )
}

export function textAreaField(options: FieldOptions): HTMLElement {
  return h(
    'label.field',
    options.label ? h('span.field-label', options.label) : null,
    h('textarea.textarea', {
      placeholder: options.placeholder ?? options.label ?? '',
      disabled: options.disabled,
      onInput: (event: Event) => options.onInput?.((event.target as HTMLTextAreaElement).value),
    }, options.value ?? ''),
  )
}

export interface Option {
  value: string
  label: string
}

export interface SelectOptions {
  label?: string
  value?: string
  options: Option[]
  placeholder?: string
  disabled?: boolean
  onChange?: (value: string) => void
}

export function selectField(options: SelectOptions): HTMLElement {
  const select = h(
    'select.select',
    {
      disabled: options.disabled,
      onChange: (event: Event) => options.onChange?.((event.target as HTMLSelectElement).value),
    },
    options.placeholder ? h('option', { value: '' }, options.placeholder) : null,
    options.options.map((option) =>
      h('option', { value: option.value, selected: option.value === options.value }, option.label),
    ),
  )
  return h(
    'label.field',
    options.label ? h('span.field-label', options.label) : null,
    select,
  )
}

export function toggleField(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const knob = h('span', {
    style: {
      position: 'absolute',
      top: '2px',
      left: checked ? '19px' : '2px',
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: '#fff',
      transition: 'left .14s ease',
    },
  })
  return h(
    'label.row',
    {
      style: { cursor: 'pointer', gap: '9px', userSelect: 'none' },
      role: 'switch',
      'aria-checked': checked ? 'true' : 'false',
      onClick: () => onChange(!checked),
    },
    h(
      'span',
      {
        style: {
          position: 'relative',
          width: '35px',
          height: '18px',
          borderRadius: '99px',
          background: checked ? 'var(--accent)' : 'var(--surface-3)',
          flexShrink: '0',
          transition: 'background .14s ease',
        },
      },
      knob,
    ),
    h('span', { style: { fontSize: '13px' } }, label),
  )
}

/** Linha de campos em grade. */
export function formRow(template: string, ...fields: Child[]): HTMLElement {
  return h('div', { style: { display: 'grid', gridTemplateColumns: template, gap: '14px' } }, fields)
}

/** Titulo de secao com linha, como "Produtos"/"Preço" em Criar Contrato. */
export function formSection(title: string): HTMLElement {
  return h(
    'div.row',
    { style: { gap: '14px', margin: '10px 0 2px' } },
    h('span', { style: { fontSize: '14px', fontWeight: '650' } }, title),
    h('span', { style: { flex: '1', height: '1px', background: 'var(--border)' } }),
  )
}
