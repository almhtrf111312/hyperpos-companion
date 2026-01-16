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

    // If not found, try with ILIKE for case-insensitive match
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

    // Check if code has reached max uses
    if (activationCode.current_uses >= activationCode.max_uses) {
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

    if (existingLicense) {
      // Update existing license
      const { error: updateError } = await supabaseAdmin
        .from('app_licenses')
        .update({
          activation_code_id: activationCode.id,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_trial: false
        })
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
          activation_code_id: activationCode.id,
          expires_at: expiresAt.toISOString(),
          is_trial: false
        })

      if (insertError) {
        console.error('Error creating license:', insertError)
        return new Response(
          JSON.stringify({ success: false, error: 'حدث خطأ أثناء إنشاء الترخيص' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Increment the usage counter
    const { error: incrementError } = await supabaseAdmin
      .from('activation_codes')
      .update({ current_uses: activationCode.current_uses + 1 })
      .eq('id', activationCode.id)

    if (incrementError) {
      console.error('Error incrementing usage:', incrementError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: expiresAt.toISOString(),
        durationDays: activationCode.duration_days
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
