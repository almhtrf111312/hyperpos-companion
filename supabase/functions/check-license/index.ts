import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with user's auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ valid: false, error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ valid: false, error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's license
    const { data: license, error: licenseError } = await supabase
      .from('app_licenses')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (licenseError || !license) {
      // No license found
      return new Response(
        JSON.stringify({ 
          valid: false, 
          hasLicense: false,
          needsActivation: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date()
    const expiresAt = new Date(license.expires_at)
    const isExpired = expiresAt < now

    if (isExpired) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          hasLicense: true,
          isExpired: true,
          isTrial: license.is_trial,
          needsActivation: true,
          expiredAt: license.expires_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate remaining days
    const remainingMs = expiresAt.getTime() - now.getTime()
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))

    return new Response(
      JSON.stringify({ 
        valid: true,
        hasLicense: true,
        isTrial: license.is_trial,
        expiresAt: license.expires_at,
        remainingDays,
        needsActivation: false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ valid: false, error: 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
