/** Store observavel minimo. Atualizacoes sao imutaveis: sempre um objeto novo. */

export type Listener<T> = (state: T) => void

export interface Store<T> {
  get(): T
  set(patch: Partial<T>): void
  subscribe(listener: Listener<T>): () => void
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<Listener<T>>()

  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch }
      const changed = (Object.keys(patch) as (keyof T)[]).some((key) => state[key] !== next[key])
      if (!changed) return
      state = next
      for (const listener of listeners) listener(state)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
