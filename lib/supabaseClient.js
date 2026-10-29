'use client';

import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function getSupabaseClient() {
  if (client) return client;
  const config = getSupabaseConfig();
  if (!config) return null;
  client = createClient(config.url, config.key, {
    // Whiteboard strokes are batched by the signaling layer, so a modest
    // ceiling is enough while keeping presence updates responsive.
    realtime: { params: { eventsPerSecond: 30 } },
  });
  return client;
}
