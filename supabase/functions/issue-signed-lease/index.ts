// Issues an Ed25519-signed offline lease. The private key never leaves the server;
// clients hold only the public key, so a cracked client cannot forge a lease.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

let keyPromise: Promise<CryptoKey> | null = null
function getKey() {
  if (!keyPromise) {
    const b64 = Deno.env.get('LEASE_SIGNING_PRIVATE_KEY') ?? ''
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    keyPromise = crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign'])
  }
  return keyPromise
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  let deviceId = ''
  try {
    const body = await req.json()
    deviceId = typeof body?.device_id === 'string' ? body.device_id.slice(0, 200) : ''
  } catch { /* ignore */ }
  if (!deviceId) return json({ error: 'device_id required' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: claims, error: authErr } = await supabase.auth.getClaims(auth.replace('Bearer ', ''))
  if (authErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401)

  // Reuse the DB function for license + device-binding validation.
  const { data, error } = await supabase.rpc('issue_offline_lease', { p_device_id: deviceId })
  if (error) return json({ success: false, error: error.message }, 400)
  const p = data as Record<string, unknown> | null
  if (!p?.success) return json(p ?? { success: false }, 200)

  const payload = {
    v: 2,
    sub: claims.claims.sub as string,
    license_id: String(p.license_id),
    device_id: String(p.device_id ?? deviceId),
    valid_until_epoch: Number(p.valid_until_epoch),
    max_offline_invoices: Number(p.max_offline_invoices) || 100,
    issued_at_epoch: Math.floor(Date.now() / 1000),
    nonce: crypto.randomUUID(),
  }
  const canonical = JSON.stringify(payload)
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', await getKey(), new TextEncoder().encode(canonical)))
  const sigB64 = btoa(String.fromCharCode(...sig))

  return json({ success: true, payload: canonical, signature: sigB64 })
})
