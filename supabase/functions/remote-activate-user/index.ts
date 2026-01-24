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
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify the caller is a boss
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token)
    
    if (claimsError || !claims?.claims?.sub) {
      console.error('Claims error:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bossId = claims.claims.sub

    // Check if user is boss
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', bossId)
      .maybeSingle()

    if (roleError || roleData?.role !== 'boss') {
      console.error('Role check failed:', roleError, roleData)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Boss access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { 
      target_user_id, 
      duration_days, 
      max_cashiers = 1, 
      license_tier = 'basic',
      activation_code_id = null 
    } = body

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'target_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!duration_days && !activation_code_id) {
      return new Response(
        JSON.stringify({ error: 'Either duration_days or activation_code_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client for modifications
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    let finalDurationDays = duration_days
    let finalMaxCashiers = max_cashiers
    let finalLicenseTier = license_tier
    let usedCodeId = activation_code_id

    // If using an existing activation code
    if (activation_code_id) {
      const { data: codeData, error: codeError } = await adminClient
        .from('activation_codes')
        .select('*')
        .eq('id', activation_code_id)
        .single()

      if (codeError || !codeData) {
        return new Response(
          JSON.stringify({ error: 'Activation code not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!codeData.is_active) {
        return new Response(
          JSON.stringify({ error: 'Activation code is not active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (codeData.current_uses >= codeData.max_uses) {
        return new Response(
          JSON.stringify({ error: 'Activation code has reached maximum uses' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      finalDurationDays = codeData.duration_days
      finalMaxCashiers = codeData.max_cashiers
      finalLicenseTier = codeData.license_tier

      // Increment code usage
      await adminClient
        .from('activation_codes')
        .update({ current_uses: codeData.current_uses + 1 })
        .eq('id', activation_code_id)
    }

    // Calculate expiry date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + finalDurationDays)

    // Check if user already has a license
    const { data: existingLicense } = await adminClient
      .from('app_licenses')
      .select('id')
      .eq('user_id', target_user_id)
      .eq('is_revoked', false)
      .maybeSingle()

    if (existingLicense) {
      // Update existing license
      const { error: updateError } = await adminClient
        .from('app_licenses')
        .update({
          expires_at: expiresAt.toISOString(),
          max_cashiers: finalMaxCashiers,
          license_tier: finalLicenseTier,
          activation_code_id: usedCodeId,
          is_trial: false,
          activated_at: new Date().toISOString(),
        })
        .eq('id', existingLicense.id)

      if (updateError) {
        console.error('Error updating license:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update license' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Create new license
      const { error: insertError } = await adminClient
        .from('app_licenses')
        .insert({
          user_id: target_user_id,
          expires_at: expiresAt.toISOString(),
          max_cashiers: finalMaxCashiers,
          license_tier: finalLicenseTier,
          activation_code_id: usedCodeId,
          is_trial: false,
          activated_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('Error creating license:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create license' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`Remote activation successful for user ${target_user_id}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        expires_at: expiresAt.toISOString(),
        duration_days: finalDurationDays,
        max_cashiers: finalMaxCashiers,
        license_tier: finalLicenseTier,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})