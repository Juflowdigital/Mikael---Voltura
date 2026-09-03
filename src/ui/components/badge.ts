/** Pilulas de status com cor derivada de um token. */
import { h } from '../dom'

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray'

const TONES: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: '#22c55e', bg: 'rgba(34,197,94,.13)' },
  blue: { fg: '#38bdf8', bg: 'rgba(56,189,248,.13)' },
  amber: { fg: '#f6a623', bg: 'rgba(246,166,35,.13)' },
  red: { fg: '#ef4444', bg: 'rgba(239,68,68,.13)' },
  purple: { fg: '#a78bfa', bg: 'rgba(167,139,250,.13)' },
  gray: { fg: '#8ba0b8', bg: 'rgba(100,116,139,.18)' },
}

export function badge(label: string, tone: Tone = 'gray'): HTMLElement {
  const { fg, bg } = TONES[tone]
  return h('span.badge', { style: { color: fg, background: bg, borderColor: fg + '55' } }, label)
}

export function dot(tone: Tone): HTMLElement {
  return h('span', {
    style: { width: '7px', height: '7px', borderRadius: '50%', background: TONES[tone].fg, display: 'inline-block' },
  })
}

export function toneColor(tone: Tone): string {
  return TONES[tone].fg
}
