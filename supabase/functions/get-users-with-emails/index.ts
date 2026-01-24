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

    // Create user-scoped client
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

    const userId = claims.claims.sub

    // Check if user is boss
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (roleError || roleData?.role !== 'boss') {
      console.error('Role check failed:', roleError, roleData)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Boss access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client to access auth.users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get all users from auth.users
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authError) {
      console.error('Error fetching auth users:', authError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('user_id, full_name')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
    }

    // Get all user roles
    const { data: roles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('user_id, role, owner_id, is_active, created_at')

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
    }

    // Get all licenses
    const { data: licenses, error: licensesError } = await adminClient
      .from('app_licenses')
      .select('user_id, expires_at, is_revoked, license_tier, max_cashiers, device_id, allow_multi_device, is_trial')
      .eq('is_revoked', false)

    if (licensesError) {
      console.error('Error fetching licenses:', licensesError)
    }

    // Create lookup maps
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]))
    const roleMap = new Map((roles || []).map(r => [r.user_id, r]))
    const licenseMap = new Map((licenses || []).map(l => [l.user_id, l]))

    // Count cashiers per owner
    const cashierCounts = new Map<string, number>()
    for (const role of (roles || [])) {
      if (role.role === 'cashier' && role.owner_id && role.is_active) {
        cashierCounts.set(role.owner_id, (cashierCounts.get(role.owner_id) || 0) + 1)
      }
    }

    // Combine all data
    const usersWithDetails = authUsers.users.map(user => {
      const profile = profileMap.get(user.id)
      const role = roleMap.get(user.id)
      const license = licenseMap.get(user.id)
      
      return {
        user_id: user.id,
        email: user.email,
        full_name: profile?.full_name || null,
        role: role?.role || null,
        owner_id: role?.owner_id || null,
        is_active: role?.is_active ?? true,
        role_created_at: role?.created_at || user.created_at,
        license_expires: license?.expires_at || null,
        license_revoked: license?.is_revoked || false,
        license_tier: license?.license_tier || null,
        max_cashiers: license?.max_cashiers || null,
        device_id: license?.device_id || null,
        allow_multi_device: license?.allow_multi_device || false,
        is_trial: license?.is_trial || false,
        cashier_count: cashierCounts.get(user.id) || 0,
        created_at: user.created_at,
      }
    })

    // Filter to only show owners (admin role) and their data - exclude boss and cashiers from main list
    const owners = usersWithDetails.filter(u => u.role === 'admin' || u.role === 'boss')

    console.log(`Returning ${owners.length} owners with emails`)

    return new Response(
      JSON.stringify({ users: owners }),
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