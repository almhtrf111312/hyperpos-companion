import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allowed origins for CORS
const allowedOrigins = [
  'https://propos.lovable.app',
  'https://id-preview--f922b973-c15b-4c58-86ca-0f04c8a8dada.lovable.app',
  'https://f922b973-c15b-4c58-86ca-0f04c8a8dada.lovableproject.com',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:8080'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with user's auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the activation code and device id from request
    const { code, device_id } = await req.json()
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'كود التفعيل مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!device_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'معرف الجهاز مطلوب لربط الترخيص' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize code input
    const sanitizedCode = code.trim().toUpperCase()
    if (sanitizedCode.length < 5 || sanitizedCode.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'كود التفعيل غير صالح' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Utility function to mask activation code (e.g. ACT-***)
    const maskCode = (c: string) => c.length > 4 ? `${c.substring(0, 4)}***` : '***';
    const maskedLogCode = maskCode(sanitizedCode);

    // Use service role to access activation_codes table
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`User ${user.email} attempting to activate code: ${maskedLogCode} on device ${device_id}`)

    // Call strict activation RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('activate_code_strict', {
      p_code: sanitizedCode,
      p_user_id: user.id,
      p_user_email: user.email,
      p_device_id: device_id
    })

    if (rpcError) {
      console.error('RPC Error:', rpcError)
      return new Response(
        JSON.stringify({ success: false, error: 'حدث خطأ في النظام أثناء تفعيل الترخيص' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The RPC returns a JSON object
    if (!rpcResult.success) {
      console.warn('Activation failed:', rpcResult.error)
      return new Response(
        JSON.stringify({ success: false, error: rpcResult.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('License activated successfully for user:', user.id)

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: rpcResult.expires_at,
        durationDays: rpcResult.duration_days,
        maxCashiers: rpcResult.max_cashiers,
        licenseTier: rpcResult.license_tier,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
