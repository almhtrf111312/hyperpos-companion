// SECURITY: Device-ID based auto-login has been permanently disabled.
// A device ID is not a secret credential, so it must never be exchanged for a
// login token. Users sign in with email/password; sessions persist locally.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ success: false, found: false, disabled: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
