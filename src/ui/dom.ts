/** Hiperscript minimo: cria elementos sem dependencia de framework. */

export type Attrs = Record<string, unknown>
export type Child = Node | string | number | null | undefined | false | Child[]

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'text', 'defs', 'linearGradient', 'stop', 'ellipse'])

function appendChild(parent: Element, child: Child): void {
  if (child === null || child === undefined || child === false) return
  if (Array.isArray(child)) {
    for (const item of child) appendChild(parent, item)
    return
  }
  parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)))
}

function applyAttr(node: Element, key: string, value: unknown): void {
  if (value === null || value === undefined || value === false) return

  if (key === 'class' || key === 'className') {
    node.setAttribute('class', String(value))
    return
  }
  if (key === 'style' && typeof value === 'object') {
    Object.assign((node as HTMLElement).style, value as Record<string, string>)
    return
  }
  if (key === 'dataset' && typeof value === 'object') {
    Object.assign((node as HTMLElement).dataset, value as Record<string, string>)
    return
  }
  if (key.startsWith('on') && typeof value === 'function') {
    node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    return
  }
  if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') {
    ;(node as unknown as Record<string, unknown>)[key] = value
    if (key === 'disabled' && value) node.setAttribute('disabled', '')
    return
  }
  node.setAttribute(key, value === true ? '' : String(value))
}

/** Cria um elemento. `h('div.card', { onClick }, 'texto')` */
export function h(selector: string, attrs?: Attrs | Child, ...children: Child[]): HTMLElement {
  const match = selector.match(/^([a-zA-Z][a-zA-Z0-9-]*)?((?:[.#][^.#]+)*)$/)
  if (!match) throw new Error('Seletor invalido: ' + selector)

  const tag = match[1] || 'div'
  const node = SVG_TAGS.has(tag)
    ? (document.createElementNS(SVG_NS, tag) as unknown as HTMLElement)
    : document.createElement(tag)

  const classes: string[] = []
  for (const token of (match[2] || '').match(/[.#][^.#]+/g) || []) {
    if (token[0] === '.') classes.push(token.slice(1))
    else node.id = token.slice(1)
  }

  const isAttrs = attrs && !Array.isArray(attrs) && !(attrs instanceof Node) && typeof attrs === 'object'
  const props = (isAttrs ? attrs : {}) as Attrs
  const rest = isAttrs ? children : [attrs as Child, ...children]

  const extraClass = props.class ?? props.className
  if (extraClass) classes.push(String(extraClass))
  if (classes.length) node.setAttribute('class', classes.join(' '))

  for (const [key, value] of Object.entries(props)) {
    if (key === 'class' || key === 'className') continue
    applyAttr(node, key, value)
  }

  for (const child of rest) appendChild(node, child)
  return node
}

/** Fragmento para retornar varios nos de uma vez. */
export function frag(...children: Child[]): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const child of children) appendChild(fragment as unknown as Element, child)
  return fragment
}

/** Substitui todo o conteudo de um container. */
export function mount(container: Element, ...children: Child[]): void {
  container.replaceChildren()
  for (const child of children) appendChild(container, child)
}

/** Icone SVG inline a partir de um path do conjunto Lucide (stroke). */
export function icon(path: string, size = 16, strokeWidth = 2): HTMLElement {
  const svg = h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })
  svg.innerHTML = path
  return svg
}
