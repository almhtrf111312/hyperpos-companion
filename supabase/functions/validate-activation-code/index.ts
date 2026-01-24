import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allowed origins for CORS
const allowedOrigins = [
  'https://propos.lovable.app',
  'https://id-preview--f922b973-c15b-4c58-86ca-0f04c8a8dada.lovable.app',
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

    // Get the activation code from request
    const { code } = await req.json()
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'كود التفعيل مطلوب' }),
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

    // Use service role to access activation_codes table
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Looking for code:', sanitizedCode)

    // Find the activation code - try exact match first
    let { data: activationCode, error: codeError } = await supabaseAdmin
      .from('activation_codes')
      .select('*')
      .eq('code', sanitizedCode)
      .eq('is_active', true)
      .single()

    // If not found, try with case-insensitive match
    if (codeError || !activationCode) {
      console.log('Exact match failed, trying case-insensitive search')
      const { data: codes } = await supabaseAdmin
        .from('activation_codes')
        .select('*')
        .eq('is_active', true)
      
      console.log('Available codes:', codes?.map(c => c.code))
      
      // Find matching code case-insensitively
      activationCode = codes?.find(c => 
        c.code.toUpperCase().replace(/[-\s]/g, '') === sanitizedCode.replace(/[-\s]/g, '')
      ) || null
    }

    if (!activationCode) {
      console.log('No matching code found for:', sanitizedCode)
      return new Response(
        JSON.stringify({ success: false, error: 'كود التفعيل غير صالح أو غير موجود' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Found activation code:', activationCode.id)

    // Check if code has expired
    if (activationCode.expires_at && new Date(activationCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'كود التفعيل منتهي الصلاحية' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ATOMIC UPDATE: Increment usage counter and check max_uses in one operation
    // This prevents race condition where multiple requests can pass the check
    const { data: updatedCode, error: atomicUpdateError } = await supabaseAdmin
      .rpc('increment_activation_code_usage', { 
        code_id: activationCode.id,
        max_allowed: activationCode.max_uses
      })

    // If RPC doesn't exist, fall back to optimistic update with check
    if (atomicUpdateError?.message?.includes('function') || atomicUpdateError?.code === '42883') {
      console.log('Falling back to optimistic update')
      
      // Check current uses first
      if (activationCode.current_uses >= activationCode.max_uses) {
        return new Response(
          JSON.stringify({ success: false, error: 'كود التفعيل تم استخدامه بالكامل' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Try to increment with a WHERE clause to prevent race condition
      const { data: updateResult, error: updateErr } = await supabaseAdmin
        .from('activation_codes')
        .update({ current_uses: activationCode.current_uses + 1 })
        .eq('id', activationCode.id)
        .lt('current_uses', activationCode.max_uses)
        .select()
        .single()

      if (updateErr || !updateResult) {
        console.log('Race condition detected or code exhausted:', updateErr)
        return new Response(
          JSON.stringify({ success: false, error: 'كود التفعيل تم استخدامه بالكامل' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (atomicUpdateError) {
      console.error('Atomic update error:', atomicUpdateError)
      return new Response(
        JSON.stringify({ success: false, error: 'حدث خطأ أثناء التحقق من الكود' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (updatedCode === false || updatedCode === null) {
      // RPC returned false meaning code was exhausted
      return new Response(
        JSON.stringify({ success: false, error: 'كود التفعيل تم استخدامه بالكامل' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate license expiry date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + activationCode.duration_days)

    // Check if user already has a license
    const { data: existingLicense } = await supabaseAdmin
      .from('app_licenses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const licenseData = {
      activation_code_id: activationCode.id,
      activated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      is_trial: false,
      is_revoked: false,
      revoked_at: null,
      revoked_reason: null,
      max_cashiers: activationCode.max_cashiers || 1,
      license_tier: activationCode.license_tier || 'basic',
    }

    if (existingLicense) {
      // Update existing license
      const { error: updateError } = await supabaseAdmin
        .from('app_licenses')
        .update(licenseData)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating license:', updateError)
        return new Response(
          JSON.stringify({ success: false, error: 'حدث خطأ أثناء تحديث الترخيص' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Create new license
      const { error: insertError } = await supabaseAdmin
        .from('app_licenses')
        .insert({
          user_id: user.id,
          ...licenseData,
        })

      if (insertError) {
        console.error('Error creating license:', insertError)
        return new Response(
          JSON.stringify({ success: false, error: 'حدث خطأ أثناء إنشاء الترخيص' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('License activated successfully for user:', user.id)

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: expiresAt.toISOString(),
        durationDays: activationCode.duration_days,
        maxCashiers: activationCode.max_cashiers || 1,
        licenseTier: activationCode.license_tier || 'basic',
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
