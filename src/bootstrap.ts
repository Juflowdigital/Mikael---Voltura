import { supabase } from './lib/supabase'

declare global {
  interface Window {
    voltuaSupabase: typeof supabase
    voltuaAuthReady: Promise<void>
  }
}

window.voltuaSupabase = supabase
window.voltuaAuthReady = Promise.resolve()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined))
}
