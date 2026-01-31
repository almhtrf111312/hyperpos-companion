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

const TRIAL_DAYS = 30;

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
    if (!authHeader?.startsWith('Bearer ')) {
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

    console.log('Starting trial for user:', user.id)

    // Use service role to manage licenses
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if user has a role (only admin/owner can start trial, not cashiers)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, owner_id')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData) {
      console.log('No role found for user:', user.id)
      return new Response(
        JSON.stringify({ success: false, error: 'لم يتم العثور على دور المستخدم' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cashiers cannot start trial - they inherit from owner
    if (roleData.role === 'cashier') {
      return new Response(
        JSON.stringify({ success: false, error: 'الكاشير لا يمكنه بدء فترة تجريبية' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a license
    const { data: existingLicense, error: licenseCheckError } = await supabaseAdmin
      .from('app_licenses')
      .select('id, is_trial, expires_at, is_revoked')
      .eq('user_id', user.id)
      .single()

    if (existingLicense) {
      // If already has valid non-revoked license, don't allow new trial
      const expiresAt = new Date(existingLicense.expires_at)
      const isExpired = expiresAt < new Date()
      
      if (!isExpired && !existingLicense.is_revoked) {
        console.log('User already has valid license:', user.id)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'لديك ترخيص صالح بالفعل',
            expiresAt: existingLicense.expires_at
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If expired or revoked, and was already a trial, don't allow another trial
      if (existingLicense.is_trial && !existingLicense.is_revoked) {
        console.log('User already used trial:', user.id)
        return new Response(
          JSON.stringify({ success: false, error: 'لقد استخدمت الفترة التجريبية مسبقاً' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Calculate trial expiry
    const trialExpiresAt = new Date()
    trialExpiresAt.setDate(trialExpiresAt.getDate() + TRIAL_DAYS)

    // Create or update license as TRIAL
    // Server-side enforces is_trial: true - cannot be overridden by client
    const licenseData = {
      user_id: user.id,
      expires_at: trialExpiresAt.toISOString(),
      is_trial: true, // ALWAYS true for this endpoint
      is_revoked: false,
      revoked_at: null,
      revoked_reason: null,
      max_cashiers: 1,
      license_tier: 'trial',
      activated_at: new Date().toISOString(),
      activation_code_id: null, // No activation code for trials
    }

    if (existingLicense) {
      // Update existing (expired/revoked) license to trial
      const { error: updateError } = await supabaseAdmin
        .from('app_licenses')
        .update(licenseData)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating to trial license:', updateError)
        return new Response(
          JSON.stringify({ success: false, error: 'حدث خطأ أثناء بدء الفترة التجريبية' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Create new trial license
      const { error: insertError } = await supabaseAdmin
        .from('app_licenses')
        .insert(licenseData)

      if (insertError) {
        console.error('Error creating trial license:', insertError)
        return new Response(
          JSON.stringify({ success: false, error: 'حدث خطأ أثناء إنشاء الفترة التجريبية' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('Trial started successfully for user:', user.id, 'expires:', trialExpiresAt.toISOString())

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: trialExpiresAt.toISOString(),
        daysRemaining: TRIAL_DAYS,
        isTrial: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error starting trial:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
