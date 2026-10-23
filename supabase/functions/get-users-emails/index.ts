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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify caller using a user-scoped client (works with signing keys)
    const token = authHeader.replace('Bearer ', '').trim()
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    const callerId = claimsData?.claims?.sub as string | undefined

    if (claimsError || !callerId) {
      console.warn('JWT verification failed:', claimsError?.message || 'no sub')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Authenticated caller:', callerId)

    // Check if caller is admin or boss — retry on transient network errors
    let callerRole: { role: string; owner_id: string | null } | null = null
    let roleError: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await adminClient
        .from('user_roles')
        .select('role, owner_id')
        .eq('user_id', callerId)
        .maybeSingle()
      if (!res.error) { callerRole = res.data; roleError = null; break }
      roleError = res.error
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }

    if (roleError) {
      console.error('Error fetching caller role (after retries):', roleError)
      // Degrade gracefully: the UI works without emails
      return new Response(
        JSON.stringify({ emails: {}, warning: 'permissions_check_unavailable' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isBoss = callerRole?.role === 'boss'
    const isAdmin = callerRole?.role === 'admin'

    if (!isAdmin && !isBoss) {
      return new Response(
        JSON.stringify({ error: 'Only admins or boss can view user emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user_ids from request body
    const { userIds } = await req.json()
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ emails: {} }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching emails for', userIds.length, 'users')

    // For admins, only return emails of users they own or themselves
    // For boss, return all requested emails
    let allowedUserIds = userIds

    if (isAdmin && !isBoss) {
      // Get all users that belong to this admin (cashiers with owner_id = callerId)
      const { data: ownedUsers } = await adminClient
        .from('user_roles')
        .select('user_id')
        .eq('owner_id', callerId)

      const ownedUserIds = new Set((ownedUsers || []).map(u => u.user_id))
      ownedUserIds.add(callerId) // Include self

      allowedUserIds = userIds.filter((id: string) => ownedUserIds.has(id))
    }

    // Fetch users from auth.users using admin API
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

    // Build email map for allowed users
    const emailMap: Record<string, string> = {}
    for (const user of authUsers.users) {
      if (allowedUserIds.includes(user.id) && user.email) {
        emailMap[user.id] = user.email
      }
    }

    console.log('Returning', Object.keys(emailMap).length, 'emails')

    return new Response(
      JSON.stringify({ emails: emailMap }),
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
