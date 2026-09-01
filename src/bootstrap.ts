import { supabase } from './lib/supabase'

declare global {
  interface Window {
    voltuaSupabase: typeof supabase
    voltuaAuthReady: Promise<void>
  }
}

window.voltuaSupabase = supabase
window.voltuaAuthReady = Promise.resolve()

