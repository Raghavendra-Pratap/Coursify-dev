/** Supabase client for Node scripts (Node <22 needs ws; see @supabase/realtime-js). */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export function createNodeSupabaseClient(url, key) {
  return createClient(url, key, {
    global: { WebSocket: ws },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
