/** Graficos em SVG puro: barras, linha, rosca e barra empilhada. */
import { h, type Child } from '../dom'

export interface Series {
  label: string
  value: number
  color?: string
}

export const PALETTE = ['#f6a623', '#38bdf8', '#22c55e', '#a78bfa', '#f472b6', '#fb7185', '#2dd4bf']

function legend(items: Series[]): HTMLElement {
  return h(
    'div.row',
    { style: { gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px', fontSize: '12px' } },
    items.map((item, index) =>
      h(
        'span.row',
        { style: { gap: '6px' } },
        h('span', {
          style: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: item.color ?? PALETTE[index % PALETTE.length],
          },
        }),
        h('span.muted', item.label),
        h('b', String(item.value)),
      ),
    ),
  )
}

function axisLabels(labels: string[]): HTMLElement {
  return h(
    'div',
    { style: { display: 'flex', gap: '8px', marginTop: '8px', fontSize: '10.5px', color: 'var(--text-faint)' } },
    labels.map((label) =>
      h('span', { style: { flex: '1', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' } }, label),
    ),
  )
}

export interface BarChartOptions {
  data: Series[]
  height?: number
  format?: (value: number) => string
  showLegend?: boolean
}

export function barChart(options: BarChartOptions): HTMLElement {
  const height = options.height ?? 180
  const max = Math.max(1, ...options.data.map((item) => item.value))
  const format = options.format ?? ((value: number) => String(value))

  return h(
    'div',
    h(
      'div',
      { style: { display: 'flex', alignItems: 'flex-end', gap: '10px', height: height + 'px' } },
      options.data.map((item, index) =>
        h(
          'div',
          {
            style: {
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '6px',
              height: '100%',
            },
            title: item.label + ': ' + format(item.value),
          },
          item.value > 0 ? h('span', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, format(item.value)) : null,
          h('div', {
            style: {
              width: '100%',
              maxWidth: '46px',
              height: Math.max(item.value > 0 ? 4 : 0, (item.value / max) * (height - 26)) + 'px',
              borderRadius: '6px 6px 2px 2px',
              background: item.color ?? PALETTE[index % PALETTE.length],
            },
          }),
        ),
      ),
    ),
    axisLabels(options.data.map((item) => item.label)),
    options.showLegend ? legend(options.data) : null,
  )
}

export interface LinePoint {
  label: string
  value: number
}

export interface LineChartOptions {
  series: { name: string; color: string; points: LinePoint[] }[]
  height?: number
}

export function lineChart(options: LineChartOptions): HTMLElement {
  const height = options.height ?? 170
  const width = 560
  const all = options.series.flatMap((entry) => entry.points.map((point) => point.value))
  const max = Math.max(1, ...all)
  const count = Math.max(1, options.series[0]?.points.length ?? 1)
  const stepX = count > 1 ? width / (count - 1) : width

  const svg = h('svg', {
    viewBox: '0 0 ' + width + ' ' + height,
    width: '100%',
    height: height + 'px',
    preserveAspectRatio: 'none',
  })
  const parts: string[] = []

  for (let i = 0; i <= 4; i += 1) {
    const y = (height - 14) * (i / 4) + 7
    parts.push('<line x1="0" y1="' + y + '" x2="' + width + '" y2="' + y + '" stroke="#1c2b3d" stroke-dasharray="3 5"/>')
  }

  for (const entry of options.series) {
    const coords = entry.points.map((point, index) => {
      const x = index * stepX
      const y = height - 7 - (point.value / max) * (height - 21)
      return { x, y }
    })
    parts.push(
      '<polyline fill="none" stroke="' +
        entry.color +
        '" stroke-width="2" stroke-linejoin="round" points="' +
        coords.map((point) => point.x + ',' + point.y).join(' ') +
        '"/>',
    )
    for (const point of coords) {
      parts.push('<circle cx="' + point.x + '" cy="' + point.y + '" r="2.6" fill="' + entry.color + '"/>')
    }
  }

  svg.innerHTML = parts.join('')

  return h(
    'div',
    h(
      'div.row',
      { style: { gap: '16px', justifyContent: 'center', fontSize: '12px', marginBottom: '10px' } },
      options.series.map((entry) =>
        h(
          'span.row',
          { style: { gap: '6px' } },
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: entry.color } }),
          h('span.muted', entry.name),
        ),
      ),
    ),
    svg,
    axisLabels(options.series[0]?.points.map((point) => point.label) ?? []),
  )
}

export interface DonutOptions {
  data: Series[]
  total?: number
  totalLabel?: string
  size?: number
}

export function donutChart(options: DonutOptions): HTMLElement {
  const size = options.size ?? 190
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const total = options.total ?? options.data.reduce((sum, item) => sum + item.value, 0)

  const svg = h('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size + 'px', height: size + 'px' })
  let offset = 0
  const arcs = options.data.map((item, index) => {
    const fraction = total > 0 ? item.value / total : 0
    const dash = fraction * circumference
    const arc =
      '<circle cx="' + center + '" cy="' + center + '" r="' + radius +
      '" fill="none" stroke="' + (item.color ?? PALETTE[index % PALETTE.length]) +
      '" stroke-width="' + stroke +
      '" stroke-dasharray="' + dash + ' ' + (circumference - dash) +
      '" stroke-dashoffset="' + -offset +
      '" transform="rotate(-90 ' + center + ' ' + center + ')"/>'
    offset += dash
    return arc
  })

  svg.innerHTML =
    '<circle cx="' + center + '" cy="' + center + '" r="' + radius +
    '" fill="none" stroke="#16263a" stroke-width="' + stroke + '"/>' + arcs.join('')

  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
    h(
      'div',
      { style: { position: 'relative', width: size + 'px', height: size + 'px' } },
      svg,
      h(
        'div',
        { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', pointerEvents: 'none' } },
        h(
          'div',
          { style: { textAlign: 'center' } },
          h('div.muted', { style: { fontSize: '12px' } }, options.totalLabel ?? 'Total'),
          h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '650' } }, String(total)),
        ),
      ),
    ),
    legend(options.data),
  )
}

/** Barra empilhada horizontal com legenda, como "Obras por status". */
export function stackedBar(data: Series[]): HTMLElement {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const segments: Child[] = total
    ? data
        .filter((item) => item.value > 0)
        .map((item, index) =>
          h('span', {
            title: item.label + ': ' + item.value,
            style: {
              width: (item.value / total) * 100 + '%',
              background: item.color ?? PALETTE[index % PALETTE.length],
            },
          }),
        )
    : [h('span', { style: { width: '100%', background: 'var(--surface-3)' } })]

  return h(
    'div',
    h('div', { style: { display: 'flex', height: '13px', borderRadius: '6px', overflow: 'hidden', gap: '2px' } }, segments),
    legend(data),
  )
}
